// Basic "app shell" caching — makes the viewer app open instantly on
// repeat visits and stay usable (minus live streams, which need network)
// if the connection drops briefly. Bump CACHE_NAME whenever you change
// index.html/manifest.json so returning visitors get the new version
// instead of a stale cached one.
const CACHE_NAME = "ott-app-shell-v3";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache streaming media or cross-origin requests (CDN scripts,
  // .m3u8/.mpd/.mp4 stream segments) — only the app shell itself.
  if (url.origin !== self.location.origin) return;

  const isHtmlPage = event.request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/";

  if (isHtmlPage) {
    // Network-first for HTML: always try to get the latest deploy first,
    // so a redeploy shows up immediately on next reload without needing
    // a CACHE_NAME bump every time. Only fall back to the cached copy if
    // the network request fails (e.g. offline).
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (icons, manifest) — these change
  // rarely, so serving instantly from cache is worth it here.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
