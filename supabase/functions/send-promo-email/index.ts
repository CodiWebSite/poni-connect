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
      <h1 style="color:#ffffff;font-size:26px;margin:0 0 8px;">Bine ai venit pe Intranet ICMPP!</h1>
      <p style="color:#bee3f8;font-size:15px;margin:0;">Platforma digitală a Institutului de Chimie Macromoleculară „Petru Poni" Iași</p>
    </div>

    <!-- Content -->
    <div style="padding:32px;">
      <p style="font-size:16px;color:#2d3748;line-height:1.7;">Dragă coleg,</p>
      
      <p style="font-size:15px;color:#4a5568;line-height:1.7;">
        Suntem bucuroși să îți prezentăm <strong>Intranet ICMPP</strong> — noua platformă digitală internă 
        a institutului, creată pentru a simplifica procesele administrative și a centraliza informațiile utile într-un singur loc.
      </p>

      <!-- Cum te înregistrezi -->
      <h2 style="color:#1a365d;font-size:18px;margin:28px 0 16px;border-left:4px solid #38a169;padding-left:12px;">
        🔐 Cum te înregistrezi și te conectezi?
      </h2>

      <div style="background:#f0fff4;border:1px solid #c6f6d5;border-radius:8px;padding:16px;margin-bottom:24px;">
        <ol style="margin:0;padding-left:20px;color:#2d3748;line-height:2.2;font-size:14px;">
          <li>Accesează platforma la <a href="https://intranet.icmpp.ro" style="color:#2b6cb0;font-weight:bold;">intranet.icmpp.ro</a></li>
          <li>Apasă pe <strong>„Înregistrare"</strong></li>
          <li>Folosește adresa ta de email instituțională (<strong>@icmpp.ro</strong>)</li>
          <li>Alege o parolă sigură (min. 6 caractere)</li>
          <li>Verifică email-ul și apasă pe link-ul de confirmare</li>
          <li>Gata! Te poți autentifica cu email-ul și parola aleasă</li>
        </ol>
      </div>

      <div style="background:#ebf8ff;border:1px solid #bee3f8;border-radius:8px;padding:14px;margin-bottom:24px;">
        <p style="margin:0;color:#2b6cb0;font-size:13px;">
          💡 <strong>Datele tale profesionale</strong> (departament, funcție, sold concediu) se preiau automat din baza de date HR — nu trebuie să completezi nimic manual!
        </p>
      </div>

      <!-- Ce găsești pe platformă -->
      <h2 style="color:#1a365d;font-size:18px;margin:28px 0 16px;border-left:4px solid #3182ce;padding-left:12px;">
        📋 Ce poți face pe platformă?
      </h2>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:12px 16px;background:#ebf8ff;border-radius:8px 8px 0 0;border-bottom:1px solid #bee3f8;">
            <strong style="color:#2b6cb0;">📝 Cereri de concediu online</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Depune și urmărește cererile de concediu digital, cu semnătură electronică și aprobare automată de către șeful de compartiment.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#f7fafc;border-bottom:1px solid #e2e8f0;">
            <strong style="color:#2b6cb0;">📊 Dashboard personal</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Vizualizează soldul de concediu, anunțurile, evenimentele și informații utile într-un singur loc.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#ebf8ff;border-bottom:1px solid #bee3f8;">
            <strong style="color:#2b6cb0;">📂 Documente și formulare</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Accesează toate formularele instituționale: delegații, decont cheltuieli, declarații, fișe de analize.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#f7fafc;border-bottom:1px solid #e2e8f0;">
            <strong style="color:#2b6cb0;">📢 Anunțuri interne</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Rămâi la curent cu noutățile și comunicările interne ale institutului.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#ebf8ff;border-bottom:1px solid #bee3f8;">
            <strong style="color:#2b6cb0;">👤 Profilul Meu</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Vizualizează datele personale, istoricul concediilor și soldul disponibil.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#f7fafc;border-bottom:1px solid #e2e8f0;">
            <strong style="color:#2b6cb0;">💬 Mesagerie internă</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Comunică rapid cu colegii prin chat direct sau grupuri de departament.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#ebf8ff;border-radius:0 0 8px 8px;">
            <strong style="color:#2b6cb0;">🔔 Notificări în timp real</strong>
            <p style="margin:4px 0 0;color:#4a5568;font-size:13px;">Primește notificări instant pe platformă și pe email când o cerere necesită atenție.</p>
          </td>
        </tr>
      </table>

      <!-- Acces rapid -->
      <h2 style="color:#1a365d;font-size:18px;margin:28px 0 16px;border-left:4px solid #ed8936;padding-left:12px;">
        🌐 Cum accesezi platforma?
      </h2>

      <div style="background:#fffaf0;border:1px solid #fbd38d;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 10px;color:#2d3748;font-size:14px;line-height:1.7;">
          <strong>Direct:</strong> Accesează <a href="https://intranet.icmpp.ro" style="color:#2b6cb0;font-weight:bold;">intranet.icmpp.ro</a> din orice browser.
        </p>
        <p style="margin:0 0 10px;color:#2d3748;font-size:14px;line-height:1.7;">
          <strong>De pe site-ul ICMPP:</strong> Intră pe <a href="https://www.icmpp.ro" style="color:#2b6cb0;">www.icmpp.ro</a> și apasă pe butonul <strong>„Intranet (new)"</strong> din meniul principal.
        </p>
        <p style="margin:0;color:#2d3748;font-size:14px;line-height:1.7;">
          <strong>Funcționează pe orice dispozitiv:</strong> calculator, telefon mobil, tabletă — optimizat pentru toate.
        </p>
      </div>

      <!-- Instalare ca aplicație -->
      <h2 style="color:#1a365d;font-size:18px;margin:28px 0 16px;border-left:4px solid #805ad5;padding-left:12px;">
        📲 Instalează ca aplicație!
      </h2>

      <div style="background:#faf5ff;border:1px solid #d6bcfa;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 10px;color:#2d3748;font-size:14px;line-height:1.7;">
          Intranetul se poate <strong>instala ca o aplicație reală</strong> pe telefon sau desktop — fără a trece prin browser de fiecare dată!
        </p>
        <p style="margin:0 0 6px;color:#4a5568;font-size:13px;">
          📱 <strong>Android:</strong> Deschide în Chrome → „Adaugă pe ecranul principal"
        </p>
        <p style="margin:0 0 6px;color:#4a5568;font-size:13px;">
          🍎 <strong>iPhone/iPad:</strong> Deschide în Safari → butonul Partajare → „Adaugă pe ecranul principal"
        </p>
        <p style="margin:0 0 6px;color:#4a5568;font-size:13px;">
          💻 <strong>Desktop:</strong> În Chrome/Edge, apasă iconița de instalare din bara de adrese
        </p>
        <p style="margin:8px 0 0;color:#805ad5;font-size:13px;font-weight:bold;">
          ✨ Avantaje: acces instant, notificări, funcționare rapidă — ca o aplicație nativă!
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="https://intranet.icmpp.ro" 
           style="display:inline-block;background:linear-gradient(135deg,#2b6cb0,#3182ce);color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:10px;font-size:17px;font-weight:bold;box-shadow:0 4px 16px rgba(49,130,206,0.3);">
          🚀 Accesează Intranet ICMPP
        </a>
      </div>

      <p style="font-size:15px;color:#4a5568;line-height:1.7;">
        Pentru orice întrebare sau problemă tehnică:
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
      subject: "🏛️ Bine ai venit pe Intranet ICMPP — Ghid de utilizare",
      html: htmlBody,
    });

    console.log(`Welcome email sent to: ${to}`);

    return new Response(
      JSON.stringify({ success: true, sent_to: to }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
