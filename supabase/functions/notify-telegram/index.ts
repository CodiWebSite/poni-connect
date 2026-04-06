import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type NotificationType =
  | "security_alert"
  | "maintenance_on"
  | "maintenance_off"
  | "account_request"
  | "system_alert";

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  severity?: "info" | "warning" | "critical";
  details?: Record<string, string>;
}

function buildTelegramMessage(payload: NotificationPayload): string {
  const icons: Record<NotificationType, string> = {
    security_alert: "🔐",
    maintenance_on: "🔧",
    maintenance_off: "✅",
    account_request: "👤",
    system_alert: "⚙️",
  };

  const severityIcons: Record<string, string> = {
    info: "ℹ️",
    warning: "⚠️",
    critical: "🔴",
  };

  const icon = icons[payload.type] || "📢";
  const sevIcon = payload.severity ? severityIcons[payload.severity] || "" : "";

  let text = `${icon} <b>${escapeHtml(payload.title)}</b>\n\n`;
  text += `${sevIcon} ${escapeHtml(payload.message)}\n`;

  if (payload.details && Object.keys(payload.details).length > 0) {
    text += "\n<b>Detalii:</b>\n";
    for (const [key, value] of Object.entries(payload.details)) {
      text += `• <b>${escapeHtml(key)}</b>: ${escapeHtml(value)}\n`;
    }
  }

  text += `\n🕐 ${new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}`;

  return text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!botToken || !chatId) {
      console.error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured");
      return new Response(
        JSON.stringify({ error: "Telegram not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check — allow service role, DB triggers (anon key), or authenticated admins
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    let isAuthorized = false;

    if (authHeader?.includes(serviceRoleKey)) {
      // Service role — always allowed
      isAuthorized = true;
    } else if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      // Check if it's the anon key (DB trigger via pg_net)
      if (token === anonKey) {
        isAuthorized = true;
      } else {
        // Check if authenticated user is super_admin
        const supabaseAuth = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (user) {
          const supabase = createClient(supabaseUrl, serviceRoleKey);
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "super_admin")
            .limit(1);
          isAuthorized = (roles && roles.length > 0);
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: NotificationPayload = await req.json();

    if (!payload.type || !payload.title || !payload.message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = buildTelegramMessage(payload);

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error("Telegram API error:", telegramResult);
      return new Response(
        JSON.stringify({ error: "Failed to send Telegram message" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: telegramResult.result?.message_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
