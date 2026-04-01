import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TABLES_TO_EXPORT = [
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
  "announcement_publishers",
  "events",
  "event_publishers",
  "documents",
  "notifications",
  "audit_logs",
  "app_settings",
  "suggestions",
  "custom_holidays",
  "custom_roles",
  "library_books",
  "library_magazines",
  "library_borrow_history",
  "equipment_items",
  "equipment_history",
  "equipment_software",
  "equipment_pin_settings",
  "backup_logs",
  "system_incidents",
  "data_correction_requests",
  "account_requests",
  "pre_assigned_roles",
  "user_onboarding",
  "auth_login_logs",
  "maintenance_subscribers",
  "health_check_logs",
  "chat_conversations",
  "chat_participants",
  "chat_messages",
  "chat_reactions",
  "notification_rules",
  "approval_workflows",
  "approval_workflow_steps",
  "archive_documents",
  "archive_access_log",
  "medical_records",
  "medical_consultations",
  "medical_documents",
  "medical_dossier_data",
  "medical_scheduled_exams",
  "helpdesk_tickets",
  "ip_bypass_users",
  "activity_organizers",
  "activity_responses",
  "recreational_activities",
  "analytics_events",
  "changelog_entries",
  "room_bookings",
  "salarizare_documents",
];

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function generateInsertSQL(table: string, rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return `-- No data in ${table}\n`;

  const columns = Object.keys(rows[0]);
  const lines: string[] = [];
  lines.push(`-- Table: ${table} (${rows.length} rows)`);

  for (const row of rows) {
    const values = columns.map((col) => escapeSQL(row[col]));
    lines.push(
      `INSERT INTO public.${table} (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING;`
    );
  }

  lines.push("");
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleData?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden — super_admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "sql"; // sql or json
    const schemaOnly = url.searchParams.get("schema_only") === "true";

    const sqlParts: string[] = [];
    sqlParts.push("-- ============================================");
    sqlParts.push("-- PONI Connect Hub — Database Export");
    sqlParts.push(`-- Generated: ${new Date().toISOString()}`);
    sqlParts.push(`-- Format: ${schemaOnly ? "Schema only" : "Schema + Data"}`);
    sqlParts.push("-- ============================================\n");

    // ── Part 1: Schema via pg_catalog ──
    // Try to get schema using direct DB connection if available
    let schemaSQL = "";

    if (dbUrl) {
      try {
        // Use Deno's built-in postgres
        const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
        const client = new Client(dbUrl);
        await client.connect();

        // Get all table definitions
        const tableQuery = await client.queryObject<{ table_name: string }>(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);

        for (const row of tableQuery.rows) {
          const colQuery = await client.queryObject<{
            column_name: string;
            data_type: string;
            udt_name: string;
            is_nullable: string;
            column_default: string | null;
            character_maximum_length: number | null;
          }>(`
            SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = '${row.table_name}'
            ORDER BY ordinal_position
          `);

          schemaSQL += `\n-- Table: ${row.table_name}\n`;
          schemaSQL += `CREATE TABLE IF NOT EXISTS public.${row.table_name} (\n`;

          const colDefs = colQuery.rows.map((col) => {
            let typeName = col.data_type === "USER-DEFINED" ? `public.${col.udt_name}` : col.data_type;
            if (col.data_type === "character varying" && col.character_maximum_length) {
              typeName = `varchar(${col.character_maximum_length})`;
            }
            if (col.data_type === "ARRAY") {
              typeName = `${col.udt_name.replace(/^_/, "")}[]`;
            }
            let def = `  "${col.column_name}" ${typeName}`;
            if (col.is_nullable === "NO") def += " NOT NULL";
            if (col.column_default) def += ` DEFAULT ${col.column_default}`;
            return def;
          });

          schemaSQL += colDefs.join(",\n");
          schemaSQL += "\n);\n";
        }

        // Get enums
        const enumQuery = await client.queryObject<{ typname: string; enumlabel: string }>(`
          SELECT t.typname, e.enumlabel
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          JOIN pg_namespace n ON t.typnamespace = n.oid
          WHERE n.nspname = 'public'
          ORDER BY t.typname, e.enumsortorder
        `);

        const enums: Record<string, string[]> = {};
        for (const row of enumQuery.rows) {
          if (!enums[row.typname]) enums[row.typname] = [];
          enums[row.typname].push(row.enumlabel);
        }

        if (Object.keys(enums).length > 0) {
          let enumSQL = "\n-- ── Enums ──\n";
          for (const [name, labels] of Object.entries(enums)) {
            enumSQL += `CREATE TYPE public.${name} AS ENUM (${labels.map(l => `'${l}'`).join(", ")});\n`;
          }
          // Enums should come before tables
          schemaSQL = enumSQL + schemaSQL;
        }

        // Get indexes
        const idxQuery = await client.queryObject<{ indexdef: string }>(`
          SELECT indexdef FROM pg_indexes
          WHERE schemaname = 'public'
          ORDER BY tablename, indexname
        `);
        if (idxQuery.rows.length > 0) {
          schemaSQL += "\n-- ── Indexes ──\n";
          for (const row of idxQuery.rows) {
            schemaSQL += `${row.indexdef};\n`;
          }
        }

        // Get RLS policies
        const rlsQuery = await client.queryObject<{
          tablename: string; policyname: string; cmd: string; qual: string | null; with_check: string | null; roles: string;
        }>(`
          SELECT tablename, policyname, cmd, qual, with_check, roles::text
          FROM pg_policies WHERE schemaname = 'public'
          ORDER BY tablename, policyname
        `);
        if (rlsQuery.rows.length > 0) {
          schemaSQL += "\n-- ── RLS Policies ──\n";
          const rlsTables = new Set<string>();
          for (const row of rlsQuery.rows) {
            rlsTables.add(row.tablename);
            schemaSQL += `CREATE POLICY "${row.policyname}" ON public.${row.tablename}`;
            schemaSQL += ` FOR ${row.cmd}`;
            if (row.roles && row.roles !== "{}" ) schemaSQL += ` TO ${row.roles.replace(/[{}]/g, "")}`;
            if (row.qual) schemaSQL += ` USING (${row.qual})`;
            if (row.with_check) schemaSQL += ` WITH CHECK (${row.with_check})`;
            schemaSQL += ";\n";
          }
          // Enable RLS
          schemaSQL += "\n";
          for (const t of rlsTables) {
            schemaSQL += `ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;\n`;
          }
        }

        // Get functions
        const fnQuery = await client.queryObject<{ function_def: string }>(`
          SELECT pg_get_functiondef(p.oid) as function_def
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
          ORDER BY p.proname
        `);
        if (fnQuery.rows.length > 0) {
          schemaSQL += "\n-- ── Functions ──\n";
          for (const row of fnQuery.rows) {
            schemaSQL += `${row.function_def};\n\n`;
          }
        }

        await client.end();
      } catch (dbErr) {
        console.error("Direct DB connection failed, falling back to API:", dbErr);
        schemaSQL = `-- Direct DB schema export failed: ${dbErr.message}\n-- Falling back to data-only export via API\n`;
      }
    } else {
      schemaSQL = "-- SUPABASE_DB_URL not configured — schema export unavailable\n-- Only data export is included below\n";
    }

    sqlParts.push(schemaSQL);

    // ── Part 2: Data export ──
    if (!schemaOnly) {
      sqlParts.push("\n-- ============================================");
      sqlParts.push("-- DATA EXPORT");
      sqlParts.push("-- ============================================\n");

      const errors: string[] = [];
      let totalRows = 0;

      for (const table of TABLES_TO_EXPORT) {
        try {
          const { data, error } = await supabase.from(table).select("*").limit(50000);
          if (error) {
            errors.push(`-- ERROR ${table}: ${error.message}`);
            sqlParts.push(`-- ERROR exporting ${table}: ${error.message}`);
          } else if (data && data.length > 0) {
            sqlParts.push(generateInsertSQL(table, data));
            totalRows += data.length;
          } else {
            sqlParts.push(`-- ${table}: empty`);
          }
        } catch (e) {
          sqlParts.push(`-- ${table}: export failed — ${e.message}`);
        }
      }

      sqlParts.push(`\n-- Total rows exported: ${totalRows}`);
      if (errors.length > 0) {
        sqlParts.push(`-- Errors: ${errors.length}`);
        sqlParts.push(errors.join("\n"));
      }
    }

    if (format === "json") {
      return new Response(JSON.stringify({
        generated_at: new Date().toISOString(),
        sql: sqlParts.join("\n"),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sqlContent = sqlParts.join("\n");
    const filename = `poni_export_${new Date().toISOString().slice(0, 10)}.sql`;

    return new Response(sqlContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
