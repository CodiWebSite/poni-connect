import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
    if (!roles?.some(r => r.role === 'super_admin')) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const BUCKET = 'registry-attachments';
    const allPaths: string[] = [];

    async function walk(prefix: string) {
      const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
      if (error) return;
      for (const item of data || []) {
        const full = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) allPaths.push(full);
        else await walk(full);
      }
    }
    await walk('');

    if (allPaths.length > 0) {
      for (let i = 0; i < allPaths.length; i += 100) {
        await admin.storage.from(BUCKET).remove(allPaths.slice(i, i + 100));
      }
    }

    const { error: delErr } = await admin.storage.deleteBucket(BUCKET);

    return new Response(JSON.stringify({
      ok: true,
      files_removed: allPaths.length,
      bucket_deleted: !delErr,
      bucket_error: delErr?.message,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
