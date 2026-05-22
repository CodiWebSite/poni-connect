import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

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

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const requestId = form.get("request_id") as string | null;
    const isDemo = form.get("is_demo") === "true";

    if (!file || !requestId) {
      return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: "file_too_large" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (file.type && !ALLOWED.has(file.type)) {
      return new Response(JSON.stringify({ error: "mime_not_allowed", mime: file.type }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(url, service);

    // Verify request belongs to user (or super_admin) and is draft/submitted
    const { data: reqRow, error: reqErr } = await admin
      .from("registry_requests")
      .select("id, submitted_by, status, source_department_key, is_demo")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr || !reqRow) {
      return new Response(JSON.stringify({ error: "request_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roleRow ?? []).some((r) => r.role === "super_admin");
    if (reqRow.submitted_by !== userId && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!["draft", "submitted"].includes(reqRow.status)) {
      return new Response(JSON.stringify({ error: "invalid_status" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const path = `${reqRow.source_department_key}/${requestId}/${Date.now()}_${safeName}`;
    const buf = await file.arrayBuffer();

    const { error: upErr } = await admin.storage
      .from("registry-attachments")
      .upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) {
      console.error("[registry-upload] storage err:", upErr.message);
      return new Response(JSON.stringify({ error: "upload_failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: attId, error: regErr } = await admin.rpc("_register_attachment_verified", {
      _request_id: requestId,
      _storage_path: path,
      _file_name: file.name,
      _mime_type: file.type || null,
      _size_bytes: file.size,
      _actor_user_id: userId,
      _is_demo: isDemo || reqRow.is_demo,
    });
    if (regErr) {
      // rollback storage
      await admin.storage.from("registry-attachments").remove([path]);
      return new Response(JSON.stringify({ error: "register_failed", detail: regErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ attachment_id: attId, storage_path: path }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[registry-upload] unexpected", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
