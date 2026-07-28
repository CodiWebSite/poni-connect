/**
 * Auto-reload the page once when a new Service Worker takes control.
 * Combined with VitePWA's `autoUpdate + skipWaiting + clientsClaim`, this
 * makes fresh deploys visible to users without a manual CTRL+SHIFT+R.
 *
 * Safe on every environment:
 * - No-op if service workers aren't supported.
 * - No-op inside Lovable preview/iframe (SW isn't registered there anyway).
 * - Reloads at most once per page load (guarded by a module-level flag).
 */
export function installSwAutoReload() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Skip inside iframes (Lovable preview embeds the app in an iframe).
  try {
    if (window.top !== window.self) return;
  } catch {
    // Cross-origin iframe — treat as embedded, skip.
    return;
  }

  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    // Small delay lets the new SW settle before the reload navigation.
    setTimeout(() => window.location.reload(), 50);
  });
}
