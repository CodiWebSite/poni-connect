import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BL1EtUd_2wmVQDPg7amSSCdIKVc7J8wWiAH0rS-TS-nRZyTOecN9Nw85Q5zg9CXU74UazHWGTYR0wO6H085IYd8";

const SW_URL = "/push-sw.js";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) view[i] = rawData.charCodeAt(i);
  return buffer;
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function subscriptionMatchesCurrentKey(sub: PushSubscription): boolean {
  const key = sub.options?.applicationServerKey;
  if (!key) return true; // cannot verify — assume valid
  return bufferToBase64Url(key as ArrayBuffer) === VAPID_PUBLIC_KEY;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
  } catch {
    /* very old browsers */
  }
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * On iPhone, push works only from the installed app. Detecting that up front
 * turns a cryptic browser failure into a one-line instruction.
 */
function isIosOutsideInstalledApp(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos =
    /iP(hone|ad|od)/.test(ua) ||
    (ua.includes("Macintosh") && typeof document !== "undefined" && "ontouchend" in document);
  return isIos && !isStandalone();
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

async function registerPushSW(): Promise<ServiceWorkerRegistration> {
  // Reuse whichever worker owns scope "/" (the app worker imports the push
  // handlers), so registering push never replaces the app worker.
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isPushSupported()) return { ok: false, error: "Browserul nu suportă notificări push." };

    if (isIosOutsideInstalledApp()) {
      return {
        ok: false,
        error:
          "Pe iPhone notificările merg doar din aplicația instalată: deschide intranet.icmpp.ro în Safari, apasă Partajare, apoi „Adaugă pe ecranul principal”, și pornește notificările de acolo.",
      };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, error: "Permisiunea pentru notificări a fost refuzată." };
    }

    const reg = await registerPushSW();
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (sub && !subscriptionMatchesCurrentKey(sub)) {
      // Subscription created with an older VAPID key — recreate it.
      try {
        await sub.unsubscribe();
      } catch {
        /* ignore */
      }
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }


    const json = sub.toJSON();
    const endpoint = json.endpoint!;
    const p256dh_key = json.keys?.p256dh!;
    const auth_key = json.keys?.auth!;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, error: "Trebuie să fii autentificat." };

    const { error } = await supabase.from("push_subscriptions").upsert(
      [{
        user_id: userData.user.id,
        endpoint,
        p256dh_key,
        auth_key,
        device_name: navigator.userAgent.slice(0, 200),
      }],
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

    const reg = await navigator.serviceWorker.getRegistration("/");
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
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub && subscriptionMatchesCurrentKey(sub);
}

/**
 * Keeps the server's device list in step with what the browser actually holds.
 *
 * Browsers rotate their push address from time to time. When that happens the
 * stored row points at an address nobody listens to any more, and notifications
 * quietly stop arriving. This silent pass re-registers the address the browser
 * is using right now, whenever notifications are already allowed.
 */
export async function ensurePushSubscription(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isPushSupported()) return { ok: false, error: "unsupported" };
    if (Notification.permission !== "granted") return { ok: false, error: "no-permission" };

    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return { ok: false, error: "no-worker" };

    const sub = await reg.pushManager.getSubscription();
    if (!sub || !subscriptionMatchesCurrentKey(sub)) {
      return { ok: false, error: "no-subscription" };
    }

    const json = sub.toJSON();
    const endpoint = json.endpoint;
    const p256dh_key = json.keys?.p256dh;
    const auth_key = json.keys?.auth;
    if (!endpoint || !p256dh_key || !auth_key) return { ok: false, error: "incomplete" };

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, error: "signed-out" };

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        [
          {
            user_id: userData.user.id,
            endpoint,
            p256dh_key,
            auth_key,
            device_name: navigator.userAgent.slice(0, 200),
          },
        ],
        { onConflict: "user_id,endpoint" },
      );

    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Eroare necunoscută" };
  }
}
