import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Running HR reminders check...');

    // Find pending requests older than 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: pendingRequests, error: requestsError } = await supabase
      .from('hr_requests')
      .select('id, user_id, request_type, details, created_at, department_head_id')
      .eq('status', 'pending')
      .lt('created_at', threeDaysAgo.toISOString());

    if (requestsError) {
      console.error('Error fetching pending requests:', requestsError);
      throw requestsError;
    }

    console.log(`Found ${pendingRequests?.length || 0} pending requests older than 3 days`);

    const notificationsSent: string[] = [];

    for (const request of pendingRequests || []) {
      // Check if we already sent a reminder for this request today
      const today = new Date().toISOString().split('T')[0];
      
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('related_id', request.id)
        .eq('type', 'reminder')
        .gte('created_at', `${today}T00:00:00Z`)
        .maybeSingle();

      if (existingNotification) {
        console.log(`Reminder already sent today for request ${request.id}`);
        continue;
      }

      // Calculate days pending
      const daysPending = Math.floor(
        (new Date().getTime() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      const requestTypeLabels: Record<string, string> = {
        concediu: 'Cerere de concediu',
        delegatie: 'Ordin de delegație',
        adeverinta: 'Adeverință',
        demisie: 'Cerere de demisie'
      };

      const typeName = requestTypeLabels[request.request_type] || request.request_type;
      const employeeName = request.details?.employeeName || 'Angajat';

      // Send reminder to department head if assigned
      if (request.department_head_id) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: request.department_head_id,
            title: '⏰ Reminder: Cerere în așteptare',
            message: `${typeName} de la ${employeeName} așteaptă aprobare de ${daysPending} zile.`,
            type: 'reminder',
            related_id: request.id,
            related_type: 'hr_request'
          });

        if (notifError) {
          console.error('Error creating notification for dept head:', notifError);
        } else {
          notificationsSent.push(`dept_head_${request.department_head_id}`);
          console.log(`Reminder sent to department head for request ${request.id}`);
        }
      }

      // Also notify HR/Admin users for requests pending > 5 days
      if (daysPending >= 5) {
        const { data: hrUsers } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['hr', 'admin', 'super_admin']);

        for (const hrUser of hrUsers || []) {
          // Don't send duplicate if already sent to dept head
          if (hrUser.user_id === request.department_head_id) continue;

          const { error: hrNotifError } = await supabase
            .from('notifications')
            .insert({
              user_id: hrUser.user_id,
              title: '⚠️ Cerere întârziată',
              message: `${typeName} de la ${employeeName} așteaptă de ${daysPending} zile și necesită atenție.`,
              type: 'warning',
              related_id: request.id,
              related_type: 'hr_request'
            });

          if (!hrNotifError) {
            notificationsSent.push(`hr_${hrUser.user_id}`);
          }
        }
      }
    }

    console.log(`HR reminders completed. ${notificationsSent.length} notifications sent.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pendingRequestsChecked: pendingRequests?.length || 0,
        notificationsSent: notificationsSent.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('HR reminders error:', error);
    return new Response(
      JSON.stringify({ error: 'Eroare la procesarea reminder-elor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
