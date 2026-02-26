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

    if (approver_user_id) {
      // Send to the designated approver only
      const { data: { user: approverUser } } = await supabaseAdmin.auth.admin.getUserById(approver_user_id);
      if (approverUser?.email) {
        recipientEmails.push(approverUser.email);
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
            }
          }
        }
      }
    }

    if (recipientEmails.length === 0) {
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

    const subject = `Cerere concediu nouă — ${employee_name} (${request_number})`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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
        <p>Vă rugăm să accesați platforma pentru a verifica și aproba cererea.</p>
        <p style="color: #718096; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          Acest email a fost trimis automat de sistemul Intranet ICMPP. Nu răspundeți la acest mesaj.
        </p>
      </div>
    `;

    // Send to all recipients
    for (const email of recipientEmails) {
      await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject,
        html: htmlBody,
      });
      console.log(`Email sent to: ${email}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_to: recipientEmails.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in notify-leave-email:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
