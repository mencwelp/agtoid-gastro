const CACHE_NAME = "gastro-compras-pwa-v1.3";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon_512.png",
  "./icon_192.png",
  "./icon_96.png",
  "./screenshot_mobile.png",
  "./screenshot_desktop.png"
];

// Install Service Worker and cache essential shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate & Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Request Interceptor
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // CRITICAL RULE: Never cache Google Apps Script endpoints, Google APIs, or any non-GET requests!
  // This guarantees synchronization stays in real-time, bypassing caching.
  if (
    event.request.method !== "GET" || 
    url.hostname.includes("script.google") || 
    url.hostname.includes("googleusercontent") || 
    url.hostname.includes("googleapis.com") ||
    url.pathname.includes("/exec")
  ) {
    return; // Let browser process natively
  }

  // Network-First, Cache-Fallback Strategy for application assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If valid response, clone and cache it dynamically for offline usage
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If network is down or failed (offline), serve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache, let the request fail gracefully
        });
      })
  );
});
