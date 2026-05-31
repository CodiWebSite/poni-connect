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

    // ---------------- Web Push (VAPID, browsers + PWA) ----------------
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh_key, auth_key")
      .eq("user_id", payload.user_id);

    if (error) throw error;

    const notificationData = {
      url: getUrlForNotification(payload.related_type, payload.related_id, payload.type),
      type: payload.type,
      related_id: payload.related_id,
      related_type: payload.related_type,
      notification_id: payload.notification_id,
    };

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.message,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: payload.notification_id || `notif-${Date.now()}`,
      data: notificationData,
    });

    let webSent = 0;
    const expiredIds: string[] = [];

    if (subs && subs.length > 0) {
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
            webSent++;
          } catch (err: any) {
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
    }

    // ---------------- Native Push (FCM, Android app) ----------------
    let nativeSent = 0;
    const expiredTokenIds: string[] = [];
    const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");

    if (FCM_SERVER_KEY) {
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("id, token, platform")
        .eq("user_id", payload.user_id);

      if (tokens && tokens.length > 0) {
        await Promise.all(
          tokens.map(async (t) => {
            try {
              const res = await fetch("https://fcm.googleapis.com/fcm/send", {
                method: "POST",
                headers: {
                  Authorization: `key=${FCM_SERVER_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  to: t.token,
                  notification: {
                    title: payload.title,
                    body: payload.message,
                    sound: "default",
                  },
                  data: notificationData,
                  priority: "high",
                }),
              });
              const json = await res.json();
              if (json.success === 1) {
                nativeSent++;
              } else if (
                json.results?.[0]?.error === "NotRegistered" ||
                json.results?.[0]?.error === "InvalidRegistration"
              ) {
                expiredTokenIds.push(t.id);
              } else {
                console.warn("FCM error", json);
              }
            } catch (err) {
              console.error("FCM send error", err);
            }
          })
        );

        if (expiredTokenIds.length > 0) {
          await supabase.from("push_tokens").delete().in("id", expiredTokenIds);
        }
      }
    }

    return new Response(
      JSON.stringify({
        web_sent: webSent,
        native_sent: nativeSent,
        expired_web: expiredIds.length,
        expired_native: expiredTokenIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-push-notification error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getUrlForNotification(
  relatedType?: string | null,
  relatedId?: string | null,
  _type?: string
): string {
  if (!relatedType) return "/";
  switch (relatedType) {
    case "leave_request":
    case "leave_approval":
      return relatedId
        ? `/leave-request?request=${relatedId}`
        : "/leave-request";
    case "chat_message":
    case "chat":
    case "chat_conversation":
      return relatedId ? `/chat?conversation=${relatedId}` : "/chat";
    case "announcement":
      return relatedId ? `/announcements?id=${relatedId}` : "/announcements";
    case "hr_request":
      return "/hr-management";
    case "suggestion":
      return relatedId ? `/sugestii?id=${relatedId}` : "/sugestii";
    case "helpdesk_ticket":
      return relatedId ? `/admin?panel=helpdesk&ticket=${relatedId}` : "/admin";
    case "account_request":
      return relatedId ? `/admin?panel=accounts&request=${relatedId}` : "/admin";
    case "incident_report":
      return relatedId
        ? `/admin?panel=incidents&id=${relatedId}`
        : "/admin?panel=incidents";
    case "gdpr_request":
      return relatedId
        ? `/admin?panel=gdpr&id=${relatedId}`
        : "/admin?panel=gdpr";
    default:
      return "/";
  }
}
