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
 * - Checks for updates on load, every 30 min and when the connection returns.
 * - NEVER reloads on its own: a new version is applied only when the user
 *   clicks "Actualizează" in the toast, so in-progress data is never lost.
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
  // Restore any form data saved right before an automatic post-deploy reload.
  restoreFormSnapshot(() =>
    toast.info("Aplicația a fost actualizată", {
      description: "Datele completate în formular au fost restaurate.",
    }),
  );

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

  // No silent auto-reload: the page never refreshes by itself while the user
  // is filling in data. A new version is only applied when the user asks.
  let promptShown = false;

  const applyUpdate = async (update: (reload?: boolean) => Promise<void>) => {
    saveFormSnapshot();
    await update(true);
    window.location.reload();
  };

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (promptShown) return;
      promptShown = true;
      toast.info("Versiune nouă disponibilă", {
        duration: Infinity,
        description:
          "Poți continua ce lucrezi. Actualizează când ești gata — datele din formular vor fi păstrate.",
        action: {
          label: "Actualizează",
          onClick: () => {
            void applyUpdate(updateSW);
          },
        },
        onDismiss: () => {
          promptShown = false;
        },
      });
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const check = () => {
        if (document.visibilityState === "hidden") return;
        registration.update().catch(() => {});
      };

      // Rare, cheap freshness checks — they never reload the page on their own.
      setInterval(check, 30 * 60 * 1000);
      window.addEventListener("online", check);
    },
  });
}
