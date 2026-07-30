import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";
import { restoreFormSnapshot, saveFormSnapshot } from "./formStateSnapshot";

/**
 * Guarded service-worker registration with aggressive update checks.
 *
 * Goal: after a Publish, users get the new version on a normal F5 (or even
 * automatically, while the tab stays open) — never a CTRL+SHIFT+R.
 *
 * - Never registers in dev, inside an iframe (Lovable preview) or on
 *   Lovable preview hosts; unregisters any stale SW there.
 * - `?sw=off` kill switch unregisters and skips registration.
 * - Checks for updates on load, every 60s, on tab focus / visibility change
 *   and when the connection comes back.
 * - Applies the new SW immediately and reloads once when it takes control.
 */

const SW_URL = "/sw.js";

function isPreviewHost(host: string) {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

function inIframe() {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

async function unregisterAppSw() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => (r.active?.scriptURL || r.waiting?.scriptURL || "").includes(SW_URL))
        .map((r) => r.unregister().catch(() => {})),
    );
  } catch {
    /* noop */
  }
}

export function initPwa() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const params = new URLSearchParams(window.location.search);
  const refuse =
    !import.meta.env.PROD ||
    inIframe() ||
    isPreviewHost(window.location.hostname) ||
    params.get("sw") === "off";

  if (refuse) {
    void unregisterAppSw();
    return;
  }

  // Reload exactly once when a new SW takes control of the page.
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    // Persist in-progress form data before the automatic refresh.
    saveFormSnapshot();
    window.location.reload();
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // autoUpdate normally handles this, but force it just in case.
      void updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const check = () => {
        if (document.visibilityState === "hidden") return;
        registration.update().catch(() => {});
      };

      // Frequent, cheap freshness checks so a Publish lands without hard refresh.
      setInterval(check, 60 * 1000);
      window.addEventListener("focus", check);
      window.addEventListener("online", check);
      document.addEventListener("visibilitychange", check);

      // If a new worker is already waiting, activate it now.
      if (registration.waiting) void updateSW(true);
    },
  });
}
