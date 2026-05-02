import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const BACKUP_FOLDER_NAME = "ICMPP Backups";

// Tables that are safe to restore. Auth/storage/system tables are excluded.
// Order matters: parents/lookup tables first.
const RESTORABLE_TABLES = [
  "app_settings",
  "custom_holidays",
  "pre_assigned_roles",
  "announcements",
  "events",
  "documents",
  "suggestions",
  "library_books",
  "library_magazines",
  "equipment_items",
  "leave_bonus",
  "leave_carryover",
  "leave_approvers",
  "leave_department_approvers",
  "leave_approval_delegates",
  "hr_requests",
  "procurement_requests",
  "leave_requests",
];

async function driveFetch(url: string, init: RequestInit = {}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY")!;
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
    },
  });
}

async function getBackupFolderId(): Promise<string | null> {
  const q = encodeURIComponent(`name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await driveFetch(`${DRIVE_GATEWAY}/files?q=${q}&fields=files(id,name)`);
  const data = await res.json();
  return data?.files?.[0]?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth: super_admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleData?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (req.method === "GET" ? "list" : "");

    // ─── LIST backups in Drive ───────────────────────────────
    if (action === "list") {
      const folderId = await getBackupFolderId();
      if (!folderId) return new Response(JSON.stringify({ files: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and (name contains 'backup_' or name = 'latest.json')`);
      const res = await driveFetch(`${DRIVE_GATEWAY}/files?q=${q}&fields=files(id,name,size,createdTime,modifiedTime,webViewLink)&orderBy=createdTime desc&pageSize=100`);
      const data = await res.json();
      return new Response(JSON.stringify({ files: data?.files || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── PREVIEW (metadata only) ─────────────────────────────
    if (action === "preview") {
      const body = await req.json();
      const fileId = body?.fileId;
      if (!fileId) return new Response(JSON.stringify({ error: "fileId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const res = await driveFetch(`${DRIVE_GATEWAY}/files/${fileId}?alt=media`);
      if (!res.ok) return new Response(JSON.stringify({ error: "Drive fetch failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const payload = await res.json();
      const counts: Record<string, number> = {};
      for (const t of Object.keys(payload?.data || {})) counts[t] = (payload.data[t] || []).length;
      return new Response(JSON.stringify({ metadata: payload?.metadata, counts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── RESTORE ─────────────────────────────────────────────
    if (action === "restore") {
      const body = await req.json();
      const fileId: string = body?.fileId;
      const tables: string[] | undefined = body?.tables; // optional subset
      const mode: "merge" | "replace" = body?.mode === "replace" ? "replace" : "merge";
      const confirm = body?.confirm === true;
      if (!fileId || !confirm) {
        return new Response(JSON.stringify({ error: "fileId și confirm:true sunt obligatorii" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const dlRes = await driveFetch(`${DRIVE_GATEWAY}/files/${fileId}?alt=media`);
      if (!dlRes.ok) return new Response(JSON.stringify({ error: "Drive fetch failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const payload = await dlRes.json();
      const data = payload?.data || {};

      const targetTables = (tables && tables.length > 0)
        ? RESTORABLE_TABLES.filter((t) => tables.includes(t))
        : RESTORABLE_TABLES;

      const report: Array<{ table: string; restored: number; status: string; error?: string }> = [];

      for (const table of targetTables) {
        const rows: any[] = data[table] || [];
        if (rows.length === 0) {
          report.push({ table, restored: 0, status: "skipped" });
          continue;
        }
        try {
          if (mode === "replace") {
            // Wipe table (only restorable ones)
            await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
          }
          // Upsert in batches
          const BATCH = 500;
          let inserted = 0;
          for (let i = 0; i < rows.length; i += BATCH) {
            const chunk = rows.slice(i, i + BATCH);
            const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id", ignoreDuplicates: false });
            if (error) {
              report.push({ table, restored: inserted, status: "error", error: error.message });
              break;
            }
            inserted += chunk.length;
          }
          if (!report.find((r) => r.table === table && r.status === "error")) {
            report.push({ table, restored: inserted, status: "ok" });
          }
        } catch (e: any) {
          report.push({ table, restored: 0, status: "error", error: e.message });
        }
      }

      // Audit
      await supabase.rpc("log_audit_event", {
        _user_id: user.id,
        _action: "data_restore",
        _entity_type: "system",
        _details: { fileId, mode, tables: targetTables, report },
      });

      // Log in backup_logs
      await supabase.from("backup_logs").insert({
        type: "restore",
        status: report.some((r) => r.status === "error") ? "partial" : "success",
        size_info: `${report.reduce((s, r) => s + r.restored, 0)} rânduri`,
        notes: `Restore din Drive (mode: ${mode}). Sursă fileId: ${fileId}. Tabele: ${targetTables.length}.`,
        performed_by: user.id,
      });

      return new Response(JSON.stringify({ success: true, mode, report }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[restore-from-drive] error:", e);
    return new Response(JSON.stringify({ error: "Eroare internă" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
