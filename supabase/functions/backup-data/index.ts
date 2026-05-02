import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TABLES_TO_BACKUP = [
  "profiles",
  "user_roles",
  "employee_personal_data",
  "employee_records",
  "employee_documents",
  "leave_requests",
  "leave_approvers",
  "leave_department_approvers",
  "leave_bonus",
  "leave_carryover",
  "leave_approval_delegates",
  "hr_requests",
  "procurement_requests",
  "announcements",
  "events",
  "documents",
  "notifications",
  "audit_logs",
  "app_settings",
  "suggestions",
  "custom_holidays",
  "library_books",
  "library_magazines",
  "library_borrow_history",
  "equipment_items",
  "equipment_history",
  "backup_logs",
  "system_incidents",
  "data_correction_requests",
  "account_requests",
  "pre_assigned_roles",
  "user_onboarding",
  "auth_login_logs",
  "maintenance_subscribers",
  "health_check_logs",
];

const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const DRIVE_UPLOAD_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3";
const BACKUP_FOLDER_NAME = "ICMPP Backups";

async function uploadToGoogleDrive(filename: string, jsonStr: string): Promise<{ fileId?: string; webViewLink?: string; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY) {
    return { error: "Google Drive nu este conectat" };
  }
  const headers = {
    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
  };

  try {
    // 1. Find or create folder
    const searchUrl = `${DRIVE_GATEWAY}/files?q=${encodeURIComponent(`name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)`;
    const searchRes = await fetch(searchUrl, { headers });
    const searchData = await searchRes.json();
    let folderId: string | undefined = searchData?.files?.[0]?.id;

    if (!folderId) {
      const createFolderRes = await fetch(`${DRIVE_GATEWAY}/files`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
      });
      const folderData = await createFolderRes.json();
      if (!createFolderRes.ok) {
        return { error: `Eroare creare folder: ${JSON.stringify(folderData)}` };
      }
      folderId = folderData.id;
    }

    // 2. Multipart upload
    const boundary = "----LovableBackup" + Math.random().toString(36).slice(2);
    const metadata = { name: filename, parents: [folderId], mimeType: "application/json" };
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${jsonStr}\r\n` +
      `--${boundary}--`;

    const uploadRes = await fetch(`${DRIVE_UPLOAD_GATEWAY}/files?uploadType=multipart&fields=id,webViewLink`, {
      method: "POST",
      headers: { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      return { error: `Eroare upload: ${JSON.stringify(uploadData)}` };
    }
    return { fileId: uploadData.id, webViewLink: uploadData.webViewLink };
  } catch (e: any) {
    return { error: e.message || String(e) };
  }
}

async function sendBackupEmail(supabase: any, userId: string, status: string, totalRows: number, sizeMB: string, errors: string[], driveLink?: string) {
  // Get super_admin email
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  if (!user?.email) return;

  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = Deno.env.get("SMTP_PORT");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpFrom = Deno.env.get("SMTP_FROM");

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) return;

  const statusLabel = status === "success" ? "✅ Succes" : "⚠️ Parțial";
  const errorSection = errors.length > 0 
    ? `<p style="color:#d97706;"><strong>Erori:</strong><br/>${errors.join("<br/>")}</p>` 
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#1e3a5f;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <h2 style="margin:0;">🗄️ Raport Backup Săptămânal</h2>
        <p style="margin:5px 0 0;opacity:0.9;">Intranet ICMPP</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
        <p><strong>Status:</strong> ${statusLabel}</p>
        <p><strong>Dimensiune:</strong> ${sizeMB} MB</p>
        <p><strong>Rânduri exportate:</strong> ${totalRows.toLocaleString()}</p>
        <p><strong>Tabele:</strong> ${TABLES_TO_BACKUP.length}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString("ro-RO", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        ${errorSection}
        ${driveLink ? `<p><strong>📁 Google Drive:</strong> <a href="${driveLink}" style="color:#1e3a5f;">Deschide backup-ul</a></p>` : ""}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
        <p style="color:#6b7280;font-size:13px;">Backup-ul automat a fost executat${driveLink ? " și încărcat în Google Drive (folder: ICMPP Backups)" : ""}.</p>
      </div>
    </div>
  `;

  try {
    const { SmtpClient } = await import("https://deno.land/x/smtp@v0.7.0/mod.ts");
    const client = new SmtpClient();
    await client.connectTLS({
      hostname: smtpHost,
      port: parseInt(smtpPort || "465"),
      username: smtpUser,
      password: smtpPass,
    });
    await client.send({
      from: smtpFrom,
      to: user.email,
      subject: `[PONI] Backup Săptămânal — ${statusLabel}`,
      content: "Raport backup săptămânal",
      html,
    });
    await client.close();
  } catch (e) {
    console.error("Email send failed:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if this is a cron call (no auth header) or manual call
    const authHeader = req.headers.get("Authorization");
    let userId: string;

    if (authHeader && !authHeader.includes(Deno.env.get("SUPABASE_ANON_KEY") || "___none___")) {
      // Manual call - verify super_admin
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (roleData?.role !== "super_admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    } else {
      // Cron call - find a super_admin to attribute the backup to
      const { data: adminRole } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin").limit(1).maybeSingle();
      if (!adminRole) {
        return new Response(JSON.stringify({ error: "No super_admin found" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = adminRole.user_id;
    }

    // Export all tables
    const backup: Record<string, unknown[]> = {};
    const errors: string[] = [];
    let totalRows = 0;

    for (const table of TABLES_TO_BACKUP) {
      const { data, error } = await supabase.from(table).select("*").limit(50000);
      if (error) {
        errors.push(`${table}: ${error.message}`);
        backup[table] = [];
      } else {
        backup[table] = data || [];
        totalRows += (data || []).length;
      }
    }

    const backupPayload = {
      metadata: {
        created_at: new Date().toISOString(),
        created_by: userId,
        tables_count: TABLES_TO_BACKUP.length,
        total_rows: totalRows,
        errors: errors.length > 0 ? errors : undefined,
      },
      data: backup,
    };

    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const sizeBytes = new TextEncoder().encode(jsonStr).length;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    const backupStatus = errors.length > 0 ? "partial" : "success";
    const filename = `backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;

    // Upload to Google Drive
    const driveResult = await uploadToGoogleDrive(filename, jsonStr);
    if (driveResult.error) {
      console.error("[Drive Upload] Failed:", driveResult.error);
      errors.push(`Google Drive: ${driveResult.error}`);
    } else {
      console.log("[Drive Upload] Success:", driveResult.fileId);
    }

    // Log this backup
    await supabase.from("backup_logs").insert({
      type: "backup",
      status: backupStatus,
      size_info: `${sizeMB} MB, ${totalRows} rânduri`,
      notes: `Backup — ${TABLES_TO_BACKUP.length} tabele${driveResult.webViewLink ? ` · Drive: ${driveResult.webViewLink}` : ""}${errors.length > 0 ? `. Erori: ${errors.join("; ")}` : ""}`,
      performed_by: userId,
    });

    // Log audit event
    await supabase.rpc("log_audit_event", {
      _user_id: userId,
      _action: "data_backup",
      _entity_type: "system",
      _details: { tables: TABLES_TO_BACKUP.length, rows: totalRows, size_mb: sizeMB, drive_file_id: driveResult.fileId },
    });

    // Send email to super_admin
    await sendBackupEmail(supabase, userId, backupStatus, totalRows, sizeMB, errors, driveResult.webViewLink);

    return new Response(jsonStr, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error("[INTERNAL] Backup data error:", error);
    return new Response(JSON.stringify({ error: "Eroare internă. Te rugăm să încerci din nou." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
