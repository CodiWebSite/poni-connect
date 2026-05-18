// Internal alert dispatcher — replaces Telegram notifications.
// Inserts in-app notifications (which auto-trigger Web Push via DB trigger)
// for the configured target audience. No external services.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Severity = "info" | "warning" | "critical";
type Target = "super_admin" | "hr" | "super_admin_and_hr" | "user_ids";

interface Payload {
  title: string;
  message: string;
  severity?: Severity;
  target: Target;
  user_ids?: string[];
  related_type?: string;
  related_id?: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function isAuthorized(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  if (token === serviceRoleKey) return true;
  // Anon JWT (DB triggers via pg_net) is acceptable for this internal helper
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload?.iss === "supabase" && (payload?.role === "anon" || payload?.role === "service_role")) {
      return true;
    }
  } catch { /* not a JWT */ }
  // Authenticated super_admin
  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await admin.auth.getUser();
    if (!user) return false;
    const service = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await service.from("user_roles")
      .select("role").eq("user_id", user.id).eq("role", "super_admin").limit(1);
    return !!(data && data.length > 0);
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!(await isAuthorized(req))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body?.title || !body?.message || !body?.target) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const severity: Severity = body.severity ?? "info";
    const notifType = severity === "critical" || severity === "warning" ? "warning" : "info";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check feature flag
    const { data: flag } = await supabase
      .from("feature_flags").select("enabled").eq("key", "internal_alerts_enabled").maybeSingle();
    if (flag && flag.enabled === false) {
      return new Response(JSON.stringify({ skipped: "flag_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve target user_ids
    let targetIds: string[] = [];
    if (body.target === "user_ids") {
      targetIds = (body.user_ids ?? []).filter(Boolean);
    } else {
      const roles =
        body.target === "super_admin" ? ["super_admin"] :
        body.target === "hr" ? ["hr", "sef_srus"] :
        ["super_admin", "hr", "sef_srus"];
      const { data: rows } = await supabase
        .from("user_roles").select("user_id").in("role", roles);
      targetIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    }

    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_targets" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = targetIds.map((uid) => ({
      user_id: uid,
      title: body.title,
      message: body.message,
      type: notifType,
      related_type: body.related_type ?? "system_alert",
      related_id: body.related_id ?? null,
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) throw error;

    // Audit
    await supabase.from("audit_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      action: "internal_alert_dispatched",
      entity_type: "notification",
      entity_id: body.related_id ?? null,
      details: {
        target: body.target, severity, recipients: targetIds.length,
        title: body.title, related_type: body.related_type,
      },
    });

    return new Response(JSON.stringify({ sent: targetIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-internal-alert error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
