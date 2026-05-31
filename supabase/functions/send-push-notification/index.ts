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

// ---------------- FCM HTTP v1 OAuth (Service Account) ----------------
interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedServiceAccount: ServiceAccount | null = null;

function getServiceAccount(): ServiceAccount | null {
  if (cachedServiceAccount) return cachedServiceAccount;
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    cachedServiceAccount = JSON.parse(raw) as ServiceAccount;
    return cachedServiceAccount;
  } catch (e) {
    console.error("Invalid FCM_SERVICE_ACCOUNT_JSON:", e);
    return null;
  }
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sig))}`;

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OAuth token exchange failed: ${res.status} ${txt}`);
  }
  const json = await res.json();
  cachedToken = {
    token: json.access_token as string,
    expiresAt: Date.now() + (json.expires_in as number) * 1000,
  };
  return cachedToken.token;
}

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

    // ---------------- Native Push (FCM HTTP v1, Android app) ----------------
    let nativeSent = 0;
    const expiredTokenIds: string[] = [];
    const sa = getServiceAccount();

    if (sa) {
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("id, token, platform")
        .eq("user_id", payload.user_id);

      if (tokens && tokens.length > 0) {
        let accessToken: string;
        try {
          accessToken = await getAccessToken(sa);
        } catch (e) {
          console.error("FCM v1 auth failed:", e);
          accessToken = "";
        }

        if (accessToken) {
          const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

          // FCM v1 only accepts string values in data payload
          const dataStrings: Record<string, string> = {};
          for (const [k, v] of Object.entries(notificationData)) {
            if (v !== undefined && v !== null) dataStrings[k] = String(v);
          }

          await Promise.all(
            tokens.map(async (t) => {
              try {
                const res = await fetch(fcmUrl, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    message: {
                      token: t.token,
                      notification: {
                        title: payload.title,
                        body: payload.message,
                      },
                      data: dataStrings,
                      android: {
                        priority: "HIGH",
                        notification: { sound: "default" },
                      },
                    },
                  }),
                });

                if (res.ok) {
                  nativeSent++;
                } else {
                  const errBody = await res.json().catch(() => ({}));
                  const errCode = errBody?.error?.details?.[0]?.errorCode || errBody?.error?.status;
                  if (
                    res.status === 404 ||
                    errCode === "UNREGISTERED" ||
                    errCode === "INVALID_ARGUMENT" ||
                    errCode === "NOT_FOUND"
                  ) {
                    expiredTokenIds.push(t.id);
                  } else {
                    console.warn("FCM v1 error", res.status, errBody);
                  }
                }
              } catch (err) {
                console.error("FCM v1 send error", err);
              }
            }),
          );

          if (expiredTokenIds.length > 0) {
            await supabase.from("push_tokens").delete().in("id", expiredTokenIds);
          }
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
