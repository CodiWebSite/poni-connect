import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to } = await req.json();

    if (!to) {
      return new Response(JSON.stringify({ error: "Missing 'to' field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";
    const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"${smtpFrom}" <${smtpUser}>`;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: "SMTP not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const htmlBody = `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:640px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2b6cb0 100%);padding:40px 32px;text-align:center;">
      <div style="display:inline-block;background:#ffffff;padding:12px;border-radius:16px;margin-bottom:16px;box-shadow:0 4px 16px rgba(0,0,0,0.15);">
        <img src="https://poni-connect-hub.lovable.app/logo-icmpp.png" alt="ICMPP Logo" style="width:72px;height:auto;display:block;" />
      </div>
      <h1 style="color:#ffffff;font-size:28px;margin:0 0 8px;">Intranet ICMPP</h1>
      <p style="color:#bee3f8;font-size:16px;margin:0;">Platforma digitală a Institutului de Chimie Macromoleculară</p>
    </div>

    <!-- Content -->
    <div style="padding:32px;">
      <p style="font-size:16px;color:#2d3748;line-height:1.7;">Dragi colegi,</p>
      
      <p style="font-size:15px;color:#4a5568;line-height:1.7;">
        Vă informăm că a fost lansată noua platformă <strong>Intranet ICMPP</strong> — un instrument digital 
        modern care centralizează și simplifică procesele administrative din institut.
      </p>

      <h2 style="color:#1a365d;font-size:18px;margin:28px 0 16px;border-left:4px solid #3182ce;padding-left:12px;">
        Ce puteți face pe platformă?
      </h2>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:12px 16px;background:#ebf8ff;border-radius:8px 8px 0 0;border-bottom:1px solid #bee3f8;">
            <strong style="color:#2b6cb0;">📋 Cereri de concediu online</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Depuneți și urmăriți cererile de concediu digital, cu semnătură electronică și aprobare automată.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#f7fafc;border-bottom:1px solid #e2e8f0;">
            <strong style="color:#2b6cb0;">📊 Dashboard personal</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Vedeți soldul de concediu, anunțuri, evenimente și informații utile într-un singur loc.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#ebf8ff;border-bottom:1px solid #bee3f8;">
            <strong style="color:#2b6cb0;">📂 Documente și formulare</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Accesați toate formularele și documentele instituționale: delegații, decont cheltuieli, declarații, fișe analize.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#f7fafc;border-bottom:1px solid #e2e8f0;">
            <strong style="color:#2b6cb0;">📢 Anunțuri interne</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Rămâneți la curent cu noutățile și comunicările interne ale institutului.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#ebf8ff;border-bottom:1px solid #bee3f8;">
            <strong style="color:#2b6cb0;">👤 Profilul Meu</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Vizualizați datele personale, istoricul concediilor și soldul disponibil.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#f7fafc;border-radius:0 0 8px 8px;">
            <strong style="color:#2b6cb0;">🔔 Notificări în timp real</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Primiți notificări instant pe platformă și pe email când o cerere este aprobată sau necesită atenție.</p>
          </td>
        </tr>
      </table>

      <h2 style="color:#1a365d;font-size:18px;margin:28px 0 16px;border-left:4px solid #38a169;padding-left:12px;">
        Cum vă creați contul?
      </h2>

      <div style="background:#f0fff4;border:1px solid #c6f6d5;border-radius:8px;padding:16px;margin-bottom:24px;">
        <ol style="margin:0;padding-left:20px;color:#2d3748;line-height:2;">
          <li>Accesați platforma la adresa de mai jos</li>
          <li>Apăsați pe <strong>„Înregistrare"</strong></li>
          <li>Folosiți adresa de email instituțională (<strong>@icmpp.ro</strong>)</li>
          <li>Verificați emailul și activați contul</li>
          <li>Datele dvs. profesionale se preiau automat din baza de date HR</li>
        </ol>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="https://intranet.icmpp.ro" 
           style="display:inline-block;background:linear-gradient(135deg,#2b6cb0,#3182ce);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:bold;box-shadow:0 4px 12px rgba(49,130,206,0.3);">
          🚀 Accesează Platforma
        </a>
      </div>

      <div style="background:#fefcbf;border:1px solid #f6e05e;border-radius:8px;padding:14px;margin-bottom:20px;">
        <p style="margin:0;color:#744210;font-size:13px;">
          <strong>💡 Notă:</strong> Platforma este optimizată pentru utilizare pe calculator și telefon mobil. 
          Recomandăm utilizarea unui browser modern (Chrome, Firefox, Edge).
        </p>
      </div>

      <p style="font-size:15px;color:#4a5568;line-height:1.7;">
        Pentru orice întrebare sau problemă tehnică, nu ezitați să contactați:
      </p>
      <p style="font-size:14px;color:#4a5568;margin-bottom:4px;">
        📧 <a href="mailto:condrea.codrin@icmpp.ro" style="color:#3182ce;">condrea.codrin@icmpp.ro</a>
      </p>
      <p style="font-size:14px;color:#4a5568;margin-bottom:0;">
        📞 Interior 330 — Departamentul IT (Codrin)
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#edf2f7;padding:20px 32px;text-align:center;">
      <p style="margin:0;color:#a0aec0;font-size:12px;">
        Institutul de Chimie Macromoleculară „Petru Poni" — Iași
      </p>
      <p style="margin:4px 0 0;color:#a0aec0;font-size:11px;">
        Acest email a fost trimis de Departamentul IT pentru informarea personalului.
      </p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: "🏛️ Lansare Intranet ICMPP — Noua platformă digitală a institutului",
      html: htmlBody,
    });

    console.log(`Promo email sent to: ${to}`);

    return new Response(
      JSON.stringify({ success: true, sent_to: to }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending promo email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
