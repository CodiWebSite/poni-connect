import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const buildReminderHtml = (name: string) => `
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
      <h1 style="color:#ffffff;font-size:24px;margin:0 0 8px;">Reminder: Contul tău pe Intranet ICMPP</h1>
      <p style="color:#bee3f8;font-size:15px;margin:0;">Platforma digitală a Institutului de Chimie Macromoleculară „Petru Poni" Iași</p>
    </div>

    <!-- Content -->
    <div style="padding:32px;">
      <p style="font-size:16px;color:#2d3748;line-height:1.7;">Dragă ${name || 'coleg'},</p>

      <p style="font-size:15px;color:#4a5568;line-height:1.7;">
        Am observat că <strong>nu ți-ai creat încă contul</strong> pe noua platformă Intranet ICMPP. 
        Platforma este deja utilizată activ de colegii tăi și îți poate simplifica semnificativ activitatea zilnică.
      </p>

      <!-- Beneficii -->
      <div style="background:#f0fff4;border:1px solid #c6f6d5;border-radius:10px;padding:20px;margin:24px 0;">
        <h3 style="color:#22543d;font-size:16px;margin:0 0 12px;">✨ Ce beneficii ai dacă îți activezi contul:</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;vertical-align:top;width:30px;">📝</td>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;"><strong>Cereri de concediu online</strong> — depune și urmărește digital, fără hârtii</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;vertical-align:top;">📊</td>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;"><strong>Dashboard personal</strong> — sold concediu, anunțuri, evenimente într-un singur loc</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;vertical-align:top;">💬</td>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;"><strong>Mesagerie internă</strong> — comunică rapid cu colegii, trimite fișiere și imagini</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;vertical-align:top;">🏛️</td>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;"><strong>Programări Săli</strong> — rezervă Sala de Conferințe sau Biblioteca online</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;vertical-align:top;">📂</td>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;"><strong>Documente & formulare</strong> — acces instant la toate formularele instituționale</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;vertical-align:top;">🔔</td>
            <td style="padding:8px 0;color:#2d3748;font-size:14px;"><strong>Notificări în timp real</strong> — fii la curent cu tot ce se întâmplă</td>
          </tr>
        </table>
      </div>

      <!-- Cum te înregistrezi -->
      <div style="background:#ebf8ff;border:1px solid #bee3f8;border-radius:10px;padding:20px;margin:24px 0;">
        <h3 style="color:#2b6cb0;font-size:16px;margin:0 0 12px;">🔐 Cum te înregistrezi? E simplu!</h3>
        <ol style="margin:0;padding-left:20px;color:#2d3748;line-height:2.2;font-size:14px;">
          <li>Accesează <a href="https://intranet.icmpp.ro" style="color:#2b6cb0;font-weight:bold;">intranet.icmpp.ro</a></li>
          <li>Apasă pe <strong>„Înregistrare"</strong></li>
          <li>Folosește emailul tău instituțional (<strong>@icmpp.ro</strong>)</li>
          <li>Alege o parolă sigură (min. 6 caractere)</li>
          <li>Gata! Te poți autentifica imediat 🎉</li>
        </ol>
      </div>

      <div style="background:#fffaf0;border:1px solid #fbd38d;border-radius:8px;padding:14px;margin-bottom:24px;">
        <p style="margin:0;color:#744210;font-size:13px;">
          💡 <strong>Datele tale profesionale</strong> (departament, funcție, sold concediu) se preiau automat din baza de date HR — nu trebuie să completezi nimic manual!
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="https://intranet.icmpp.ro/auth"
           style="display:inline-block;background:linear-gradient(135deg,#38a169,#2f855a);color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:10px;font-size:17px;font-weight:bold;box-shadow:0 4px 16px rgba(56,161,105,0.3);">
          🚀 Creează-ți contul acum
        </a>
      </div>

      <p style="font-size:14px;color:#718096;line-height:1.7;text-align:center;">
        Durează mai puțin de <strong>1 minut</strong> și vei avea acces la toate funcționalitățile platformei.
      </p>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;" />

      <p style="font-size:14px;color:#4a5568;line-height:1.7;">
        📲 <strong>Bonus:</strong> Poți instala platforma ca aplicație pe telefon sau desktop pentru acces instant!
      </p>

      <p style="font-size:15px;color:#4a5568;line-height:1.7;margin-top:20px;">
        Pentru orice întrebare sau problemă:
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
        Acest email a fost trimis de Departamentul IT ca reminder pentru activarea contului pe platforma Intranet.
      </p>
    </div>
  </div>
</body>
</html>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testEmail } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    // If testEmail is provided, just send a test to that address
    if (testEmail) {
      await transporter.sendMail({
        from: fromAddress,
        to: testEmail,
        subject: "🔔 Reminder: Activează-ți contul pe Intranet ICMPP",
        html: buildReminderHtml("Coleg"),
      });
      return new Response(
        JSON.stringify({ success: true, test: true, sent_to: testEmail }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all employee emails from employee_personal_data (not archived)
    const { data: employees, error: empError } = await supabase
      .from("employee_personal_data")
      .select("email, first_name, last_name")
      .eq("is_archived", false);

    if (empError) throw empError;

    // Get all registered user emails via auth admin API
    const allUsers: Array<{ email?: string }> = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      if (authError) throw authError;
      allUsers.push(...users);
      if (users.length < perPage) break;
      page++;
    }

    const registeredEmails = new Set(
      allUsers.map((u) => (u.email || "").toLowerCase())
    );

    // Filter: only employees who do NOT have an account
    const inactiveEmployees = (employees || []).filter(
      (emp) => !registeredEmails.has(emp.email.toLowerCase())
    );

    if (inactiveEmployees.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent_count: 0, message: "Toți angajații au cont activ!" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const emp of inactiveEmployees) {
      const name = `${emp.first_name} ${emp.last_name}`.trim();
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: emp.email,
          subject: "🔔 Reminder: Activează-ți contul pe Intranet ICMPP",
          html: buildReminderHtml(name),
        });
        sentCount++;
        console.log(`Reminder sent to: ${emp.email}`);
      } catch (err) {
        console.error(`Failed to send to ${emp.email}:`, err);
        errors.push(emp.email);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: sentCount,
        total_inactive: inactiveEmployees.length,
        failed: errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
