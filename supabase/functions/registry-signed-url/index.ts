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

    const { attachment_id } = await req.json().catch(() => ({}));
    if (!attachment_id) return new Response(JSON.stringify({ error: "missing" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(url, service);
    // Use user client for visibility — RLS will enforce policies
    const { data: att, error: attErr } = await userClient
      .from("registry_attachments")
      .select("id, bucket, storage_path, file_name")
      .eq("id", attachment_id)
      .maybeSingle();
    if (attErr || !att) {
      return new Response(JSON.stringify({ error: "forbidden_or_not_found" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: signed, error: sErr } = await admin.storage
      .from(att.bucket)
      .createSignedUrl(att.storage_path, 300, { download: att.file_name });
    if (sErr || !signed) {
      return new Response(JSON.stringify({ error: "sign_failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("audit_logs").insert({
      user_id: userId, action: "registry_attachment_accessed",
      entity_type: "registry_attachments", entity_id: attachment_id,
      details: { file_name: att.file_name },
    });

    return new Response(JSON.stringify({ url: signed.signedUrl, expires_in: 300 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[registry-signed-url] unexpected", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
