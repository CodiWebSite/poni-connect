import { createClient } from "npm:@supabase/supabase-js@2";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Check for test mode
    let testEmail: string | null = null;
    try {
      const body = await req.json();
      testEmail = body?.test_email || null;
    } catch { /* no body is fine for cron */ }

    // Allow both authenticated calls (manual) and cron calls (no auth)
    const authHeader = req.headers.get("Authorization");
    let isManual = false;

    if (authHeader?.startsWith("Bearer ")) {
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
      isManual = true;
    }

    // If test mode, send a demo email and return
    if (testEmail) {
      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPass = Deno.env.get("SMTP_PASS");
      const smtpFrom = Deno.env.get("SMTP_FROM") || "";
      const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"${smtpFrom}" <${smtpUser}>`;

      if (!smtpHost || !smtpUser || !smtpPass) {
        return new Response(JSON.stringify({ error: "SMTP not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost, port: smtpPort, secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const demoHtml = `
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
            ⚠️ Acesta este un email DEMO. Acest email a fost trimis automat de sistemul Intranet ICMPP.
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: fromAddress,
        to: testEmail,
        subject: `🔔 Reminder: 3 cereri de concediu așteaptă aprobare`,
        html: demoHtml,
      });

      console.log(`Demo reminder sent to: ${testEmail}`);
      return new Response(
        JSON.stringify({ success: true, sent_to: testEmail, mode: "demo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Find all pending leave requests
    const { data: pendingRequests, error: reqError } = await supabaseAdmin
      .from("leave_requests")
      .select("id, request_number, start_date, end_date, working_days, replacement_name, status, user_id, approver_id, epd_id, created_at")
      .in("status", ["pending_department_head", "pending_srus"]);

    if (reqError) {
      console.error("Error fetching pending requests:", reqError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch pending requests" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending requests", sent_to: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group requests by approver to send consolidated emails
    const approverRequests: Record<string, { email: string; requests: any[] }> = {};

    for (const req of pendingRequests) {
      // Get employee info
      let employeeName = "Angajat";
      let department = "";
      if (req.epd_id) {
        const { data: epd } = await supabaseAdmin
          .from("employee_personal_data")
          .select("first_name, last_name, department")
          .eq("id", req.epd_id)
          .maybeSingle();
        if (epd) {
          employeeName = `${epd.last_name} ${epd.first_name}`;
          department = epd.department || "";
        }
      }

      const enrichedReq = { ...req, employee_name: employeeName, department };

      // Determine who should approve
      const approverEmails: string[] = [];

      // 1. Direct approver on request
      if (req.approver_id) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(req.approver_id);
        if (user?.email) approverEmails.push(user.email);
      }

      // 2. Per-employee approver
      const { data: empApprovers } = await supabaseAdmin
        .from("leave_approvers")
        .select("approver_user_id, approver_email")
        .eq("employee_user_id", req.user_id);
      
      if (empApprovers) {
        for (const la of empApprovers) {
          if (la.approver_user_id) {
            const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(la.approver_user_id);
            if (user?.email && !approverEmails.includes(user.email)) approverEmails.push(user.email);
          } else if (la.approver_email && !approverEmails.includes(la.approver_email)) {
            approverEmails.push(la.approver_email);
          }
        }
      }

      // 3. Department-level approver
      if (department) {
        const { data: deptApprovers } = await supabaseAdmin
          .from("leave_department_approvers")
          .select("approver_user_id, approver_email")
          .eq("department", department);

        if (deptApprovers) {
          for (const da of deptApprovers) {
            if (da.approver_user_id) {
              const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(da.approver_user_id);
              if (user?.email && !approverEmails.includes(user.email)) approverEmails.push(user.email);
            } else if (da.approver_email && !approverEmails.includes(da.approver_email)) {
              approverEmails.push(da.approver_email);
            }
          }
        }
      }

      // 4. Active delegates
      if (req.approver_id) {
        const today = new Date().toISOString().split("T")[0];
        const { data: delegates } = await supabaseAdmin
          .from("leave_approval_delegates")
          .select("delegate_user_id")
          .eq("delegator_user_id", req.approver_id)
          .eq("is_active", true)
          .lte("start_date", today)
          .gte("end_date", today);

        if (delegates) {
          for (const d of delegates) {
            const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(d.delegate_user_id);
            if (user?.email && !approverEmails.includes(user.email)) approverEmails.push(user.email);
          }
        }
      }

      // 5. Fallback: department heads with sef/sef_srus roles
      if (approverEmails.length === 0 && department) {
        const { data: deptProfiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("department", department);

        if (deptProfiles) {
          for (const profile of deptProfiles) {
            const { data: roleData } = await supabaseAdmin
              .from("user_roles")
              .select("role")
              .eq("user_id", profile.user_id)
              .in("role", ["sef", "sef_srus"])
              .maybeSingle();

            if (roleData) {
              const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
              if (user?.email && !approverEmails.includes(user.email)) approverEmails.push(user.email);
            }
          }
        }
      }

      // 6. For pending_srus status, also notify HR/SRUS users
      if (req.status === "pending_srus") {
        const { data: hrUsers } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .in("role", ["hr", "sef_srus"]);

        if (hrUsers) {
          for (const hr of hrUsers) {
            const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(hr.user_id);
            if (user?.email && !approverEmails.includes(user.email)) approverEmails.push(user.email);
          }
        }
      }

      // Add to grouped map
      for (const email of approverEmails) {
        if (!approverRequests[email]) {
          approverRequests[email] = { email, requests: [] };
        }
        approverRequests[email].requests.push(enrichedReq);
      }
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    let totalSent = 0;

    for (const [email, data] of Object.entries(approverRequests)) {
      const requestRows = data.requests
        .map(
          (r: any) => `
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${r.request_number}</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${r.employee_name}</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${r.department}</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${r.start_date} — ${r.end_date}</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">${r.working_days} zile</td>
            <td style="padding: 8px 12px; border: 1px solid #bee3f8;">
              ${r.status === "pending_department_head" ? "Așteaptă Șef Dept." : "Așteaptă SRUS"}
            </td>
          </tr>`
        )
        .join("");

      const count = data.requests.length;
      const subject = `🔔 Reminder: ${count} ${count === 1 ? "cerere" : "cereri"} de concediu ${count === 1 ? "așteaptă" : "așteaptă"} aprobare`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 10px;">
            🔔 Reminder — Cereri de Concediu în Așteptare
          </h2>
          <p>Bună ziua,</p>
          <p>Aveți <strong>${count}</strong> ${count === 1 ? "cerere" : "cereri"} de concediu care ${count === 1 ? "necesită" : "necesită"} aprobarea dumneavoastră:</p>
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
              ${requestRows}
            </tbody>
          </table>
          <p>Vă rugăm să accesați platforma pentru a procesa aceste cereri.</p>
          <p style="color: #718096; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            Acest email a fost trimis automat de sistemul Intranet ICMPP. Nu răspundeți la acest mesaj.
          </p>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: email,
          subject,
          html,
        });
        console.log(`Reminder sent to: ${email} (${count} requests)`);
        totalSent++;
      } catch (mailErr) {
        console.error(`Failed to send to ${email}:`, mailErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_to: totalSent,
        pending_requests: pendingRequests.length,
        message: isManual ? "Reminder-uri trimise manual" : "Reminder-uri trimise automat",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in remind-leave-approvers:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
