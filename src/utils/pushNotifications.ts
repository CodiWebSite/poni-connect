import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BF6kyn_JW4gE8qJ9j98FSIE9jbDdxVPYQv-dw5Pxz1wpa2LE1yZBUmwUzPdeuC24rhyvXMMhnr1fMWk2V23ifu4";

const SW_URL = "/push-sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

async function registerPushSW(): Promise<ServiceWorkerRegistration> {
  // Try to find existing registration for our SW
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isPushSupported()) return { ok: false, error: "Browserul nu suportă notificări push." };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, error: "Permisiunea pentru notificări a fost refuzată." };
    }

    const reg = await registerPushSW();
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    const endpoint = json.endpoint!;
    const p256dh = json.keys?.p256dh!;
    const auth_key = json.keys?.auth!;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, error: "Trebuie să fii autentificat." };

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userData.user.id,
        endpoint,
        p256dh,
        auth_key,
        user_agent: navigator.userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Eroare necunoscută" };
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isPushSupported()) return { ok: true };

    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();

    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userData.user.id)
          .eq("endpoint", endpoint);
      }
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Eroare necunoscută" };
  }
}

export async function isSubscribedToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}
