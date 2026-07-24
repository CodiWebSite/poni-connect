// payslip-download: verify ownership + pilot whitelist, return signed URL, log audit.
import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Nu ești autentificat" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    if (!userData?.user) return jsonResp({ error: "Sesiune invalidă" }, 401);
    const userId = userData.user.id;
    const userEmail = (userData.user.email ?? "").toLowerCase();

    const admin = createClient(supabaseUrl, serviceKey);
    const { payslip_id } = await req.json();
    if (!payslip_id) return jsonResp({ error: "payslip_id lipsă" }, 400);

    // Load payslip
    const { data: payslip } = await admin
      .from("payslips")
      .select("id, employee_epd_id, file_path, file_path_encrypted, match_status, month, year, first_downloaded_at, download_count")
      .eq("id", payslip_id)
      .maybeSingle();
    if (!payslip || !payslip.file_path) return jsonResp({ error: "Fluturaș inexistent" }, 404);

    // Role check
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = roleSet.has("super_admin") || roleSet.has("salarizare");

    let action = "download";
    // Admins get the plain preview (file_path); owners get the encrypted copy when distributed.
    let pathToServe: string = payslip.file_path as string;

    if (!isAdmin) {
      // Must be pilot AND own the payslip AND status = distributed
      const { data: pilot } = await admin
        .from("payslip_pilot_users")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();
      if (!pilot) return jsonResp({ error: "Nu ai acces (pilot închis)" }, 403);

      if (payslip.match_status !== "distributed") return jsonResp({ error: "Fluturașul nu este încă distribuit" }, 403);

      // Ownership via employee_records.user_id
      const { data: epd } = await admin
        .from("employee_personal_data")
        .select("id, employee_record_id")
        .eq("id", payslip.employee_epd_id)
        .maybeSingle();
      if (!epd?.employee_record_id) return jsonResp({ error: "Nu ești proprietarul" }, 403);
      const { data: rec } = await admin
        .from("employee_records")
        .select("user_id")
        .eq("id", epd.employee_record_id)
        .maybeSingle();
      if (rec?.user_id !== userId) return jsonResp({ error: "Nu ești proprietarul" }, 403);

      // Serve the encrypted copy to owners. Fall back to file_path only if legacy
      // (older distributions before the split path was introduced encrypted file_path in place).
      pathToServe = (payslip.file_path_encrypted as string | null) ?? (payslip.file_path as string);
    } else {
      action = "admin_view";
    }

    // Signed URL, TTL 60s
    const { data: signed, error: sErr } = await admin.storage
      .from("payslips")
      .createSignedUrl(pathToServe, 60);
    if (sErr || !signed) return jsonResp({ error: "Eroare URL semnat", detail: sErr?.message }, 500);

    // Update stats + audit
    if (action === "download") {
      await admin.from("payslips").update({
        first_downloaded_at: (payslip as any).first_downloaded_at ?? new Date().toISOString(),
        download_count: ((payslip as any).download_count ?? 0) + 1,
      }).eq("id", payslip.id);
    }

    await admin.from("payslip_audit_log").insert({
      user_id: userId,
      payslip_id: payslip.id,
      action,
      ip: req.headers.get("x-forwarded-for") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
      details: { month: payslip.month, year: payslip.year },
    });

    return jsonResp({ url: signed.signedUrl });
  } catch (e) {
    console.error("payslip-download error", e);
    return jsonResp({ error: (e as Error).message }, 500);
  }
});
