import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = "BF6kyn_JW4gE8qJ9j98FSIE9jbDdxVPYQv-dw5Pxz1wpa2LE1yZBUmwUzPdeuC24rhyvXMMhnr1fMWk2V23ifu4";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:no-reply@icmpp.ro";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface Payload {
  user_id: string;
  title: string;
  message: string;
  type?: string;
  related_id?: string | null;
  related_type?: string | null;
  notification_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;

    if (!payload.user_id || !payload.title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all push subscriptions for this user
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh_key, auth_key")
      .eq("user_id", payload.user_id);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.message,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: payload.notification_id || `notif-${Date.now()}`,
      data: {
        url: getUrlForNotification(payload.related_type, payload.related_id),
        type: payload.type,
        related_id: payload.related_id,
        related_type: payload.related_type,
        notification_id: payload.notification_id,
      },
    });

    let sent = 0;
    const expiredIds: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh_key, auth: s.auth_key },
            },
            notificationPayload
          );
          sent++;
        } catch (err: any) {
          // 410 Gone or 404 -> subscription expired, remove it
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            expiredIds.push(s.id);
          } else {
            console.error("Push send error:", err?.statusCode, err?.body);
          }
        }
      })
    );

    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }

    return new Response(JSON.stringify({ sent, expired: expiredIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push-notification error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getUrlForNotification(relatedType?: string | null, relatedId?: string | null): string {
  if (!relatedType) return "/";
  switch (relatedType) {
    case "leave_request":
      return "/leave";
    case "chat_message":
    case "chat":
      return "/chat";
    case "announcement":
      return "/announcements";
    case "hr_request":
      return "/hr";
    case "helpdesk_ticket":
    case "account_request":
      return "/admin";
    default:
      return "/";
  }
}
