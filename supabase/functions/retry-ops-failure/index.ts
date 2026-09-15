import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: { role: string }) =>
      ["super_admin", "admin"].includes(r.role)
    );
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const failureId = String(body?.failure_id ?? "");
    if (!failureId) return json({ error: "failure_id lipsește" }, 400);

    const { data: failure, error: fErr } = await admin
      .from("ops_failures")
      .select("*")
      .eq("id", failureId)
      .maybeSingle();
    if (fErr || !failure) return json({ error: "Înregistrarea nu există" }, 404);

    if (!failure.retry_function) {
      return json({ error: "Această eroare nu poate fi reîncercată automat" }, 400);
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/${failure.retry_function}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify(failure.retry_body ?? {}),
    });
    const ok = res.ok;
    const text = (await res.text()).slice(0, 1000);

    await admin
      .from("ops_failures")
      .update({
        retry_count: (failure.retry_count ?? 0) + 1,
        last_retry_at: new Date().toISOString(),
        status: ok ? "resolved" : "failed",
        resolved_at: ok ? new Date().toISOString() : null,
        resolved_by: ok ? userData.user.id : null,
        error: ok ? failure.error : `reîncercare eșuată: ${text}`,
      })
      .eq("id", failureId);

    return json({ ok, detail: ok ? "Reîncercare reușită" : text }, ok ? 200 : 502);
  } catch (e) {
    console.error("[retry-ops-failure]", (e as Error)?.message);
    return json({ error: "Eroare internă" }, 500);
  }
});
