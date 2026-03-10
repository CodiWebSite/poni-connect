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

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: "SMTP credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"${smtpFrom}" <${smtpUser}>`;

    console.log(`Connecting to SMTP: ${smtpHost}:${smtpPort}`);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const { type } = await req.json().then(b => ({ ...b, type: b.type || "leave" })).catch(() => ({ type: "leave", to: "" }));
    
    const isReminder = type === "reminder";
    
    const subject = isReminder
      ? `🔔 Reminder: 3 cereri de concediu așteaptă aprobare`
      : `🧪 [TEST] Cerere concediu nouă — Popescu Ion (CO-2026-TEST)`;

    const reminderHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 10px;">
          🔔 Reminder — Cereri de Concediu în Așteptare
        </h2>
        <p>Bună ziua,</p>
        <p>Aveți <strong>3</strong> cereri de concediu care necesită aprobarea dumneavoastră:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
          <thead>
            <tr style="background: #1a365d; color: white;">
              <th style="padding: 10px 12px; border: 1px solid #1a365d; text-align: left;">Nr.</th>
              <th style="padding: 10px 12px; border: 1px solid #1a365d; text-align: left;">Angajat</th>
              <th style="padding: 10px 12px; border: 1px solid #1a365d; text-align: left;">Departament</th>
              <th style="padding: 10px 12px; border: 1px solid #1a365d; text-align: left;">Perioada</th>
              <th style="padding: 10px 12px; border: 1px solid #1a365d; text-align: left;">Zile</th>
              <th style="padding: 10px 12px; border: 1px solid #1a365d; text-align: left;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">CO-2026-0042</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">Popescu Ion</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">Laborator Polimeri Funcționali</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">2026-03-10 — 2026-03-14</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">5 zile</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">Așteaptă Șef Dept.</td>
            </tr>
            <tr style="background: #f7fafc;">
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">CO-2026-0043</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">Ionescu Maria</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">Laborator Polimeri Funcționali</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">2026-03-17 — 2026-03-21</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">5 zile</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">Așteaptă Șef Dept.</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">CO-2026-0044</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">Georgescu Ana</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">Laborator Polimeri Funcționali</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">2026-03-24 — 2026-03-28</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">5 zile</td>
              <td style="padding: 8px 12px; border: 1px solid #bee3f8;">Așteaptă SRUS</td>
            </tr>
          </tbody>
        </table>
        <p>Vă rugăm să accesați platforma pentru a procesa aceste cereri.</p>
        <p style="color: #718096; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          ⚠️ Acesta este un email de test. Acest email a fost trimis automat de sistemul Intranet ICMPP.
        </p>
      </div>
    `;

    const leaveHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 10px;">
          Cerere de Concediu de Odihnă
        </h2>
        <p>Bună ziua,</p>
        <p>Angajatul <strong>Popescu Ion (TEST)</strong> din compartimentul <strong>Laborator Polimeri Funcționali</strong> a depus o cerere de concediu:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr style="background: #ebf8ff;">
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Nr. cerere</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">CO-2026-TEST</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Perioada</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">10.03.2026 — 14.03.2026</td>
          </tr>
          <tr style="background: #ebf8ff;">
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Zile lucrătoare</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">5</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Înlocuitor</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">Ionescu Maria</td>
          </tr>
        </table>
        <p>Vă rugăm să accesați platforma pentru a verifica și aproba cererea.</p>
        <p style="color: #718096; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          ⚠️ Acesta este un email de test. Nu răspundeți la acest mesaj.
        </p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: to,
      subject,
      html: leaveHtml,
    });

    console.log(`Test email sent to: ${to}, messageId: ${info.messageId}`);

    return new Response(
      JSON.stringify({ success: true, sent_to: to, messageId: info.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending test email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
