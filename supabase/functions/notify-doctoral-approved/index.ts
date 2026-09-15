import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { sendMailWithRetry } from "../_shared/smtp-retry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { profile_id } = await req.json().catch(() => ({}));
    if (!profile_id || typeof profile_id !== "string") return json({ error: "profile_id lipsă" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Validăm apelantul: doar persoanele care administrează zona doctorală.
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Neautorizat" }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Neautorizat" }, 401);
    const { data: canManage } = await admin.rpc("can_manage_doctoral", { _user_id: userData.user.id });
    if (!canManage) return json({ error: "Acces interzis" }, 403);

    const { data: profile } = await admin
      .from("doctoral_profiles")
      .select("id, full_name, email, thesis_title, doctoral_school, coordinator_name, study_year, status")
      .eq("id", profile_id)
      .maybeSingle();

    if (!profile) return json({ error: "Profil inexistent" }, 404);
    if (profile.status !== "active") return json({ error: "Profilul nu este activ" }, 400);
    if (!profile.email) return json({ error: "Doctorandul nu are adresă de email" }, 400);

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";
    const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"${smtpFrom}" <${smtpUser}>`;
    if (!smtpHost || !smtpUser || !smtpPass) return json({ error: "Serviciul de email nu este configurat" }, 500);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
        <h2 style="color:#1a365d; border-bottom:2px solid #3182ce; padding-bottom:10px;">Cererea ta a fost aprobată — Spațiul Doctoral ICMPP</h2>
        <p style="font-size:15px;">Bună, <strong>${escapeHtml(profile.full_name)}</strong>,</p>
        <p style="font-size:15px;">Contul tău de doctorand în Intranetul ICMPP este activ. Poți începe parcursul doctoral: îți vezi termenele, încarci documente și comunici cu colegii și coordonatorul.</p>
        <table style="width:100%; border-collapse:collapse; font-size:14px; margin:16px 0;">
          <tr><td style="padding:6px 0; color:#4a5568; width:170px;">Școala doctorală</td><td>${escapeHtml(profile.doctoral_school || "—")}</td></tr>
          <tr><td style="padding:6px 0; color:#4a5568;">Tema tezei</td><td>${escapeHtml(profile.thesis_title || "—")}</td></tr>
          <tr><td style="padding:6px 0; color:#4a5568;">Conducător doctorat</td><td>${escapeHtml(profile.coordinator_name || "Se va aloca")}</td></tr>
          <tr><td style="padding:6px 0; color:#4a5568;">An de studiu</td><td>${escapeHtml(profile.study_year ?? "—")}</td></tr>
        </table>
        <p><a href="https://intranet.icmpp.ro/doctoral" style="display:inline-block; background:#3182ce; color:#ffffff; text-decoration:none; padding:11px 20px; border-radius:6px; font-weight:bold;">Intră în Spațiul Doctoral</a></p>
        <p style="font-size:14px; color:#4a5568;">Autentificarea se face cu adresa ta @icmpp.ro și parola aleasă la înscriere.</p>
        <p style="color:#718096; font-size:12px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:10px;">Mesaj automat — Intranet ICMPP.</p>
      </div>
    `;

    await sendMailWithRetry(
      transporter,
      {
        from: fromAddress,
        to: profile.email,
        subject: "Bun venit în Spațiul Doctoral ICMPP — cererea a fost aprobată",
        html,
      },
      { label: "notify-doctoral-approved" },
    );

    return json({ success: true });
  } catch (error) {
    console.error("[INTERNAL] Error in notify-doctoral-approved:", error);
    return json({ error: "Eroare internă la notificarea doctorandului" }, 500);
  }
});
