// Service Worker PWA pour MonBudget
// Version: 1.0.1

const CACHE_NAME = "monbudget-cache-v2";
const CORE_STATIC_ASSETS = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

// Installation : mise en cache des ressources statiques indispensables
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        CORE_STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`Pré-cache ignoré pour ${url}:`, err);
          })
        )
      );
    })
  );
});

// Activation : suppression des anciens caches obsolètes
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
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes réseau (Fetch)
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les requêtes chrome-extension / analytiques
  if (request.method !== "GET" || url.protocol.startsWith("chrome-extension")) {
    return;
  }

  // Requêtes vers Supabase API : stratégie Réseau d'abord (la synchro locale gère le hors-ligne)
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ offline: true, error: "Network unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // Requêtes de navigation (pages HTML)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          // Essayer de renvoyer la page en cache, sinon repli sur /offline.html
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;
          return new Response("Application hors ligne. Veuillez vous reconnecter.", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        })
    );
    return;
  }

  // Fichiers statiques (_next/static, css, js, icons, images, fonts)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Stale-While-Revalidate en arrière-plan
          fetch(request)
            .then((res) => {
              if (res && res.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, res));
              }
            })
            .catch(() => {});
          return cached;
        }

        return fetch(request).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        }).catch(() => {
          return new Response("", { status: 408 });
        });
      })
    );
    return;
  }

  // Comportement par défaut : fetch réseau direct
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
