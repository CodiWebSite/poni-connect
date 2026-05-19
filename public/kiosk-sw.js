// Kiosk Service Worker — caches the institute presentation video for instant replay.
// Scope: only the /kiosk route. Caches a single, well-known cross-origin video URL.

const CACHE_NAME = 'kiosk-video-v1';
const VIDEO_URL = 'https://icmpp.ro/files/70/INSTITUTUL%20PP%202_final.mp4';

self.addEventListener('install', (event) => {
  // Activate immediately so the page can benefit on next reload.
  self.skipWaiting();

  // Pre-fetch the video in the background on first install (no-cors → opaque response).
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const req = new Request(VIDEO_URL, { mode: 'no-cors', credentials: 'omit' });
        const resp = await fetch(req);
        await cache.put(req, resp);
      } catch (_) {
        // Ignore — will be cached on first runtime fetch instead.
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up any older caches.
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('kiosk-video-') && n !== CACHE_NAME).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only handle the kiosk video URL — everything else passes through untouched.
  if (url !== VIDEO_URL) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(VIDEO_URL, { ignoreVary: true });
      if (cached) return cached;

      // Not cached yet — fetch from network and store for next time.
      try {
        const req = new Request(VIDEO_URL, { mode: 'no-cors', credentials: 'omit' });
        const resp = await fetch(req);
        // Clone before caching (body can only be consumed once).
        cache.put(req, resp.clone()).catch(() => {});
        return resp;
      } catch (err) {
        // Last-resort: let the browser try directly.
        return fetch(event.request);
      }
    })()
  );
});
