import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all medical records with expiring or expired fitness
    const { data: records, error: recErr } = await supabase
      .from('medical_records')
      .select('id, epd_id, medical_fitness, fitness_valid_until')
      .not('fitness_valid_until', 'is', null);

    if (recErr) throw recErr;
    if (!records?.length) {
      return new Response(JSON.stringify({ message: 'No records to check' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const notifications: any[] = [];

    // Get doctor user IDs
    const { data: doctors } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'medic_medicina_muncii');

    // Get HR/SRUS user IDs
    const { data: hrUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['hr', 'sef_srus', 'super_admin']);

    const doctorIds = doctors?.map(d => d.user_id) || [];
    const hrIds = hrUsers?.map(h => h.user_id) || [];

    // Get employee names for notifications
    const epdIds = records.map(r => r.epd_id);
    const { data: employees } = await supabase
      .from('employee_personal_data')
      .select('id, first_name, last_name')
      .in('id', epdIds);

    const empMap: Record<string, string> = {};
    employees?.forEach(e => {
      empMap[e.id] = `${e.last_name} ${e.first_name}`;
    });

    for (const record of records) {
      const validUntil = new Date(record.fitness_valid_until);
      const daysLeft = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const empName = empMap[record.epd_id] || 'Angajat necunoscut';

      if (daysLeft < 0) {
        // EXPIRED — notify doctor + HR
        const allTargets = [...new Set([...doctorIds, ...hrIds])];
        for (const userId of allTargets) {
          notifications.push({
            user_id: userId,
            title: '🔴 Aviz medical expirat',
            message: `Avizul medical al angajatului ${empName} a expirat pe ${record.fitness_valid_until}.`,
            type: 'warning',
            related_type: 'medical_record',
            related_id: record.id,
          });
        }
      } else if (daysLeft <= 7) {
        // 7 days — notify doctor
        for (const userId of doctorIds) {
          notifications.push({
            user_id: userId,
            title: '🟡 Aviz medical expiră în 7 zile',
            message: `Avizul medical al angajatului ${empName} expiră pe ${record.fitness_valid_until} (${daysLeft} zile).`,
            type: 'warning',
            related_type: 'medical_record',
            related_id: record.id,
          });
        }
      } else if (daysLeft <= 15) {
        // 15 days — notify doctor
        for (const userId of doctorIds) {
          notifications.push({
            user_id: userId,
            title: '🟠 Aviz medical expiră în 15 zile',
            message: `Avizul medical al angajatului ${empName} expiră pe ${record.fitness_valid_until} (${daysLeft} zile).`,
            type: 'info',
            related_type: 'medical_record',
            related_id: record.id,
          });
        }
      } else if (daysLeft <= 30) {
        // 30 days — notify doctor
        for (const userId of doctorIds) {
          notifications.push({
            user_id: userId,
            title: 'ℹ️ Aviz medical expiră în 30 zile',
            message: `Avizul medical al angajatului ${empName} expiră pe ${record.fitness_valid_until} (${daysLeft} zile).`,
            type: 'info',
            related_type: 'medical_record',
            related_id: record.id,
          });
        }
      }
    }

    // Deduplicate: avoid sending the same notification twice per day
    // Check existing notifications from today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: existingToday } = await supabase
      .from('notifications')
      .select('related_id, user_id')
      .eq('related_type', 'medical_record')
      .gte('created_at', todayStart.toISOString());

    const existingSet = new Set(
      (existingToday || []).map(n => `${n.user_id}_${n.related_id}`)
    );

    const newNotifications = notifications.filter(
      n => !existingSet.has(`${n.user_id}_${n.related_id}`)
    );

    if (newNotifications.length > 0) {
      const { error: insertErr } = await supabase
        .from('notifications')
        .insert(newNotifications);
      if (insertErr) throw insertErr;
    }

    // Send email notifications for expired avize
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'no-reply@icmpp.ro';

    // Only send emails for expired records if SMTP is configured
    if (smtpHost && smtpUser && smtpPass) {
      const expiredRecords = records.filter(r => {
        const daysLeft = Math.ceil((new Date(r.fitness_valid_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysLeft < 0;
      });

      if (expiredRecords.length > 0) {
        // Get email addresses for doctor and HR
        const allTargetIds = [...new Set([...doctorIds, ...hrIds])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', allTargetIds);

        // Get auth emails
        for (const targetId of allTargetIds) {
          const { data: userData } = await supabase.auth.admin.getUserById(targetId);
          if (!userData?.user?.email) continue;

          const expiredList = expiredRecords.map(r => {
            const empName = empMap[r.epd_id] || 'Necunoscut';
            return `• ${empName} — expirat pe ${r.fitness_valid_until}`;
          }).join('\n');

          // Using fetch to send via SMTP relay would be complex,
          // so we just rely on in-app notifications for now
          // Email sending can be added via the existing notify pattern
        }
      }
    }

    return new Response(
      JSON.stringify({
        checked: records.length,
        notifications_sent: newNotifications.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
