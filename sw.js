self.addEventListener("install", e => {
  e.waitUntil(caches.open("gastro-v1").then(c => c.addAll([
    "./", "index.html", "style.css", "app.js",
    "framework7.bundle.min.css", "framework7.bundle.min.js"
  ])));
});

self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});