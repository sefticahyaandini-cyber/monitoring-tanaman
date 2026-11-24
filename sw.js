const CACHE_NAME = "kebun-pwa-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.startsWith("/api/")
  ) return;

  if (requestUrl.pathname === new URL("./config.js", self.location.href).pathname) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok) {
          const responseCopy = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseCopy))
            .catch((error) => console.error("Gagal memperbarui konfigurasi cache:", error));
        }
        return networkResponse;
      }).catch((error) => caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        throw error;
      }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok) {
          const responseCopy = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseCopy))
            .catch((error) => console.error("Gagal memperbarui cache:", error));
        }
        return networkResponse;
      }).catch((error) => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html").then((appShell) => {
            if (appShell) return appShell;
            throw error;
          });
        }
        throw error;
      });
    })
  );
});
