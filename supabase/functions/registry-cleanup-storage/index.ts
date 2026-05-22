import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Enforce AAL2
    const aal = (claims?.claims as { aal?: string } | undefined)?.aal;
    if (aal !== "aal2") {
      return new Response(JSON.stringify({ error: "aal2_required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(url, service);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roleRow ?? []).some((r) => r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find demo or draft-only attachments orphaned/abandoned (> 7 days old, request still draft or demo)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: candidates } = await admin
      .from("registry_attachments")
      .select("id, bucket, storage_path, request_id, is_demo, created_at, registry_requests!inner(status, is_demo)")
      .or("is_demo.eq.true,registry_requests.status.eq.draft")
      .lt("created_at", cutoff)
      .limit(500);

    let deleted = 0;
    let orphans = 0;
    for (const att of candidates ?? []) {
      const { error: rmErr } = await admin.storage.from(att.bucket).remove([att.storage_path]);
      if (rmErr) {
        await admin.rpc("_report_orphan_storage", { _bucket: att.bucket, _storage_path: att.storage_path, _reason: rmErr.message });
        orphans++;
        continue;
      }
      const { error: dbErr } = await admin.from("registry_attachments").delete().eq("id", att.id);
      if (dbErr) {
        await admin.rpc("_report_orphan_storage", { _bucket: att.bucket, _storage_path: att.storage_path, _reason: `db_delete_failed: ${dbErr.message}` });
        orphans++;
        continue;
      }
      deleted++;
    }

    await admin.from("audit_logs").insert({
      user_id: userId, action: "registry_storage_cleanup",
      entity_type: "registry_attachments", entity_id: null,
      details: { deleted, orphans, scanned: candidates?.length ?? 0 },
    });

    return new Response(JSON.stringify({ deleted, orphans, scanned: candidates?.length ?? 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[registry-cleanup] unexpected", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
