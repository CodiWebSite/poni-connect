import nodemailer from "nodemailer";
import { sendMailWithRetry } from "../_shared/smtp-retry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POST_URL =
  "https://intranet.icmpp.ro/social?post=9f66153e-ecc7-4335-b144-57951faf8566";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"Intranet ICMPP" <${smtpUser}>`;
    let to = "condrea.codrin@icmpp.ro";
    try {
      const body = await req.json();
      if (typeof body?.to === "string" && body.to.includes("@")) to = body.to;
    } catch (_) { /* no body */ }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const subject = "Raport final evaluare ICMPP — disponibil în Intranet Social";

    const html = `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #1a202c; line-height: 1.65;">
  <div style="text-align:center; border-bottom: 2px solid #4c1d95; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color:#4c1d95; margin:0; font-size: 22px;">Intranet ICMPP — Anunț oficial</h1>
    <p style="color:#6b7280; margin: 6px 0 0; font-size: 13px;">Institutul de Chimie Macromoleculară „Petru Poni"</p>
  </div>

  <p>Stimați colegi,</p>

  <p>Vă informăm că <strong>raportul final al evaluării Institutului de Chimie Macromoleculară „Petru Poni"</strong> a fost publicat în secțiunea <strong>Intranet Social</strong> a platformei interne.</p>

  <p>În urma evaluării, institutul a obținut un punctaj de <strong>179,5 puncte</strong>, rezultat care îl încadrează în <strong>Clasa I de performanță</strong>.</p>

  <p>Raportul cuprinde atât rezultatul evaluării, cât și observațiile, criticile și recomandările formulate de Comisia de evaluare. Vă recomandăm consultarea documentului și acordarea unei atenții deosebite criteriilor și recomandărilor prezentate, acestea putând constitui repere utile pentru activitatea viitoare a institutului.</p>

  <div style="text-align:center; margin: 32px 0;">
    <a href="${POST_URL}" style="background:#4c1d95; color:#ffffff; text-decoration:none; padding: 14px 28px; border-radius: 8px; font-family: Arial, sans-serif; font-size: 15px; display:inline-block;">Deschide postarea în Intranet Social</a>
  </div>

  <p style="font-size: 13px; color:#6b7280;">Dacă butonul nu funcționează, copiați adresa în browser:<br>
  <a href="${POST_URL}" style="color:#6d28d9; word-break: break-all;">${POST_URL}</a></p>

  <p style="font-size: 13px; color:#6b7280; margin-top: 24px;">Anunțul este disponibil și în secțiunea <em>Anunțuri</em> din platformă. Accesul necesită autentificare cu contul instituțional.</p>

  <p style="margin-top: 28px;">Cu deosebită considerație,<br><strong>Echipa Intranet ICMPP</strong></p>
</div>`;

    const info = await sendMailWithRetry(transporter, { from: fromAddress, to, subject, html });

    return new Response(JSON.stringify({ success: true, messageId: info.messageId, to }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
