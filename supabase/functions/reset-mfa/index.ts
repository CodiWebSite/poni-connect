import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nu ești autentificat.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the caller is a super_admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Utilizator invalid.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check caller role
    const { data: roleData } = await callerClient.from('user_roles').select('role').eq('user_id', caller.id).single();
    if (!roleData || roleData.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Doar Super Admin poate reseta 2FA.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId este obligatoriu.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use admin client to list and unenroll MFA factors
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { factors }, error: listError } = await adminClient.auth.admin.mfa.listFactors({
      userId,
    });

    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const verifiedFactors = (factors || []).filter((f: any) => f.status === 'verified');
    if (verifiedFactors.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Utilizatorul nu are 2FA activ.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Unenroll all verified factors
    for (const factor of verifiedFactors) {
      const { error: unenrollError } = await adminClient.auth.admin.mfa.deleteFactor({
        userId,
        factorId: factor.id,
      });
      if (unenrollError) {
        return new Response(JSON.stringify({ error: `Eroare la ștergerea factorului: ${unenrollError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Audit log
    await callerClient.rpc('log_audit_event', {
      _user_id: caller.id,
      _action: 'mfa_reset',
      _entity_type: 'user',
      _entity_id: userId,
      _details: { factors_removed: verifiedFactors.length },
    });

    return new Response(JSON.stringify({ success: true, factors_removed: verifiedFactors.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Eroare internă' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
