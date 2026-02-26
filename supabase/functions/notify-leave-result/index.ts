import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      employee_user_id,
      employee_name,
      request_number,
      start_date,
      end_date,
      working_days,
      result,
      rejection_reason,
      approver_name,
      notify_hr,
    } = await req.json();

    if (!employee_user_id || !request_number || !result) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get employee email
    const { data: { user: empUser } } = await supabaseAdmin.auth.admin.getUserById(employee_user_id);

    if (!empUser?.email) {
      return new Response(
        JSON.stringify({ message: "Employee email not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SMTP config
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";
    const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"${smtpFrom}" <${smtpUser}>`;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const isApproved = result === "approved";
    const statusColor = isApproved ? "#38a169" : "#e53e3e";
    const statusIcon = isApproved ? "✅" : "❌";
    const statusText = isApproved ? "APROBATĂ" : "RESPINSĂ";

    const subject = `${statusIcon} Cerere concediu ${statusText} — ${request_number}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a365d; border-bottom: 2px solid ${statusColor}; padding-bottom: 10px;">
          Cerere de Concediu ${statusText}
        </h2>
        <p>Bună ziua, <strong>${employee_name || "angajat"}</strong>,</p>
        <p>Cererea dumneavoastră de concediu a fost <strong style="color: ${statusColor};">${statusText.toLowerCase()}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr style="background: #ebf8ff;">
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Nr. cerere</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${request_number}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Perioada</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${start_date} — ${end_date}</td>
          </tr>
          <tr style="background: #ebf8ff;">
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Zile lucrătoare</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${working_days}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Rezultat</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; color: ${statusColor}; font-weight: bold;">${statusText}</td>
          </tr>
          ${approver_name ? `<tr style="background: #ebf8ff;">
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Aprobator</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${approver_name}</td>
          </tr>` : ""}
          ${!isApproved && rejection_reason ? `<tr>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Motiv respingere</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; color: #e53e3e;">${rejection_reason}</td>
          </tr>` : ""}
        </table>
        ${isApproved 
          ? "<p>Concediul dumneavoastră a fost înregistrat. Vă dorim o vacanță plăcută!</p>" 
          : "<p>Dacă aveți întrebări, vă rugăm să contactați șeful de compartiment sau departamentul SRUS.</p>"}
        <p style="color: #718096; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          Acest email a fost trimis automat de sistemul Intranet ICMPP. Nu răspundeți la acest mesaj.
        </p>
      </div>
    `;

    // Send to employee
    await transporter.sendMail({
      from: fromAddress,
      to: empUser.email,
      subject,
      html: htmlBody,
    });
    console.log(`Leave result email sent to: ${empUser.email} (${result})`);

    // If approved and notify_hr flag is set, also send email to HR staff
    if (notify_hr && isApproved) {
      try {
        const { data: hrRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .in("role", ["hr", "sef_srus"]);

        const hrEmails: string[] = [];
        if (hrRoles) {
          for (const hr of hrRoles) {
            const { data: { user: hrUser } } = await supabaseAdmin.auth.admin.getUserById(hr.user_id);
            if (hrUser?.email) {
              hrEmails.push(hrUser.email);
            }
          }
        }

        if (hrEmails.length > 0) {
          const hrSubject = `📋 Cerere concediu aprobată — ${employee_name} (${request_number})`;
          const hrHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a365d; border-bottom: 2px solid #38a169; padding-bottom: 10px;">
                Cerere de Concediu Aprobată — De Centralizat
              </h2>
              <p>Bună ziua,</p>
              <p>Cererea de concediu a angajatului <strong>${employee_name}</strong> a fost aprobată de <strong>${approver_name || "Șef compartiment"}</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr style="background: #ebf8ff;">
                  <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Nr. cerere</td>
                  <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${request_number}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Angajat</td>
                  <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${employee_name}</td>
                </tr>
                <tr style="background: #ebf8ff;">
                  <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Perioada</td>
                  <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${start_date} — ${end_date}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Zile lucrătoare</td>
                  <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${working_days}</td>
                </tr>
                <tr style="background: #f0fff4;">
                  <td style="padding: 8px 12px; border: 1px solid #c6f6d5; font-weight: bold;">Aprobat de</td>
                  <td style="padding: 8px 12px; border: 1px solid #c6f6d5; color: #38a169; font-weight: bold;">${approver_name || "Șef compartiment"}</td>
                </tr>
              </table>
              <p>Vă rugăm să centralizați această cerere în evidența concediilor.</p>
              <p style="color: #718096; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                Acest email a fost trimis automat de sistemul Intranet ICMPP. Nu răspundeți la acest mesaj.
              </p>
            </div>
          `;

          for (const hrEmail of hrEmails) {
            await transporter.sendMail({
              from: fromAddress,
              to: hrEmail,
              subject: hrSubject,
              html: hrHtml,
            });
            console.log(`HR notification email sent to: ${hrEmail}`);
          }
        }
      } catch (hrErr) {
        console.error("Failed to send HR notification emails:", hrErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent_to: empUser.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-leave-result:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
