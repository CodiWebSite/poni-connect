import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { sendMailWithRetry } from "../_shared/smtp-retry.ts";

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
    // Auth check
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

    // Verify the caller
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

    // Parse body
    const {
      employee_name,
      department,
      request_number,
      start_date,
      end_date,
      working_days,
      replacement_name,
      approver_user_id,
      delegate_user_ids,
      request_id,
      app_origin,
    } = await req.json();

    if (!department || !employee_name || !request_number) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role to find recipients
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const recipientEmails: string[] = [];
    const delegateEmails: string[] = [];
    const recipientIds: string[] = [];
    const delegateIds: string[] = [];

    if (approver_user_id) {
      // Send to the designated approver
      const { data: { user: approverUser } } = await supabaseAdmin.auth.admin.getUserById(approver_user_id);
      if (approverUser?.email) {
        recipientEmails.push(approverUser.email);
        recipientIds.push(approver_user_id);
      }
    } else {
      // Fallback: find dept heads in same department
      const { data: deptProfiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("department", department);

      if (deptProfiles && deptProfiles.length > 0) {
        for (const profile of deptProfiles) {
          const { data: roleData } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.user_id)
            .in("role", ["sef", "sef_srus"])
            .maybeSingle();

          if (roleData) {
            const { data: { user: headUser } } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
            if (headUser?.email) {
              recipientEmails.push(headUser.email);
              recipientIds.push(profile.user_id);
            }
          }
        }
      }
    }

    // Collect delegate emails
    if (delegate_user_ids && Array.isArray(delegate_user_ids)) {
      for (const delId of delegate_user_ids) {
        const { data: { user: delUser } } = await supabaseAdmin.auth.admin.getUserById(delId);
        if (delUser?.email) {
          delegateEmails.push(delUser.email);
          delegateIds.push(delId);
        }
      }
    }

    if (recipientEmails.length === 0 && delegateEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipients found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
      console.error("SMTP credentials not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Connect to SMTP using nodemailer
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // One-click approval link (valid 7 days, single use)
    const origin = typeof app_origin === "string" && app_origin.startsWith("https://")
      ? app_origin
      : "https://intranet.icmpp.ro";

    const createApprovalLink = async (approverId: string): Promise<string | null> => {
      if (!request_id || !approverId) return null;
      try {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { error } = await supabaseAdmin.from("approval_links").insert({
          token,
          request_type: "leave",
          request_id,
          approver_user_id: approverId,
          expires_at: expires,
        });
        if (error) return null;
        return `${origin}/aprobare/${token}`;
      } catch (_e) {
        return null;
      }
    };

    const buildHtmlBody = (isDelegate: boolean, approvalUrl: string | null) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${isDelegate ? `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px;">
          <strong style="color: #92400e;">⚡ Acțiune necesară:</strong>
          <span style="color: #92400e;"> Sunteți înlocuitor activ pentru aprobarea cererilor de concediu. Vă rugăm să procesați această cerere.</span>
        </div>` : ''}
        <h2 style="color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 10px;">
          Cerere de Concediu de Odihnă
        </h2>
        <p>Bună ziua,</p>
        <p>Angajatul <strong>${employee_name}</strong> din compartimentul <strong>${department}</strong> a depus o cerere de concediu:</p>
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
            <td style="padding: 8px 12px; border: 1px solid #bee3f8; font-weight: bold;">Înlocuitor</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${replacement_name || "N/A"}</td>
          </tr>
        </table>
        ${approvalUrl ? `
        <div style="text-align:center; margin: 24px 0;">
          <a href="${approvalUrl}" style="background:#1a365d; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:bold; display:inline-block;">
            Aprobă cererea acum
          </a>
          <p style="color:#718096; font-size:12px; margin-top:10px;">
            Link personal, valabil 7 zile, o singură utilizare. Aprobarea aplică automat semnătura digitală (nume, dată, adresă IP).
          </p>
        </div>` : ''}
        <p>Puteți verifica și aproba cererea și direct din platformă.</p>
        <p style="color: #718096; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          Acest email a fost trimis automat de sistemul Intranet ICMPP. Nu răspundeți la acest mesaj.
        </p>
      </div>
    `;

    let totalSent = 0;

    // Send to approver(s) — informative email
    const approverSubject = `Cerere concediu nouă — ${employee_name} (${request_number})`;
    for (let i = 0; i < recipientEmails.length; i++) {
      const email = recipientEmails[i];
      const approvalUrl = await createApprovalLink(recipientIds[i]);
      await sendMailWithRetry(transporter, {
        from: fromAddress,
        to: email,
        subject: approverSubject,
        html: buildHtmlBody(false, approvalUrl),
      });
      console.log(`Email sent to approver: ${email}`);
      totalSent++;
    }

    // Send to delegate(s) — priority email with action banner
    const delegateSubject = `⚡ [PRIORITAR] Cerere concediu — ${employee_name} (${request_number})`;
    for (let i = 0; i < delegateEmails.length; i++) {
      const email = delegateEmails[i];
      const approvalUrl = await createApprovalLink(delegateIds[i]);
      await sendMailWithRetry(transporter, {
        from: fromAddress,
        to: email,
        subject: delegateSubject,
        html: buildHtmlBody(true, approvalUrl),
      });
      console.log(`Priority email sent to delegate: ${email}`);
      totalSent++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_to: totalSent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[INTERNAL] Error in notify-leave-email:", error);
    return new Response(
      JSON.stringify({ error: "Eroare internă. Te rugăm să încerci din nou." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
