// Service Worker PWA Offline-First pour MonBudget
// Version: 4.0.0

const CACHE_NAME = "monbudget-cache-v4";
const OUTBOX_SYNC_TAG = "monbudget-outbox-sync";
const SW_REGISTRY_DB_NAME = "monbudget_sw_registry_v1";
const OFFLINE_DB_PREFIX = "monbudget_offline_v1_";
const OFFLINE_DB_VERSION = 1;
const CORE_STATIC_ASSETS = [
  "/offline.html",
  "/manifest.json",
  "/logo.png",
  "/favicon.ico",
  "/icons/icon.svg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

const APP_SHELL_ROUTES = [
  "/dashboard",
  "/transactions",
  "/budget",
  "/savings",
  "/debts",
  "/reports",
  "/settings",
];

async function warmAppShellCache(cache) {
  await Promise.allSettled(
    APP_SHELL_ROUTES.map(async (route) => {
      try {
        const res = await fetch(route, { credentials: "same-origin" });
        if (res && res.ok && res.status === 200) {
          await cache.put(route, res.clone());
        }
      } catch {
        // Ignorer silencieusement si hors-ligne pendant le préchauffage
      }
    })
  );
}

// Installation : mise en cache des ressources statiques indispensables
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        CORE_STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`Pré-cache ignoré pour ${url}:`, err);
          })
        )
      );
      await warmAppShellCache(cache);
    })
  );
});

// Activation : suppression des anciens caches obsolètes et prise de contrôle immédiate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

function sanitizeSwUserId(userId) {
  const clean = String(userId || "anon").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return clean || "anon";
}

function idbReqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB request failed"));
  });
}

function idbTxComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

function generateSwUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function openSwRegistryDb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(SW_REGISTRY_DB_NAME, 1);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("users")) {
          db.createObjectStore("users", { keyPath: "userId" });
        }
      };
      req.onsuccess = (event) => resolve(event.target.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function updateSwRegistry(userId, mode) {
  if (!userId) return;
  const db = await openSwRegistryDb();
  if (!db) return;
  try {
    const tx = db.transaction("users", "readwrite");
    const store = tx.objectStore("users");
    if (mode === "add") {
      store.put({
        userId,
        dbName: `${OFFLINE_DB_PREFIX}${sanitizeSwUserId(userId)}`,
        updatedAt: new Date().toISOString(),
      });
    } else {
      store.delete(userId);
    }
    await idbTxComplete(tx);
  } catch {
    // Ignorer silencieusement
  } finally {
    try {
      db.close();
    } catch {}
  }
}

function openOfflineUserDb(dbName) {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined" || !dbName) {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(dbName, OFFLINE_DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("months")) {
          const monthsStore = db.createObjectStore("months", { keyPath: "monthKey" });
          monthsStore.createIndex("updatedAt", "updatedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains("outbox")) {
          const outboxStore = db.createObjectStore("outbox", { keyPath: "id" });
          outboxStore.createIndex("status", "status", { unique: false });
          outboxStore.createIndex("createdAt", "createdAt", { unique: false });
          outboxStore.createIndex("nextRetryAt", "nextRetryAt", { unique: false });
          outboxStore.createIndex("entityId", "entityId", { unique: false });
        }
        if (!db.objectStoreNames.contains("conflicts")) {
          const conflictStore = db.createObjectStore("conflicts", { keyPath: "id" });
          conflictStore.createIndex("createdAt", "createdAt", { unique: false });
          conflictStore.createIndex("resolved", "resolved", { unique: false });
        }
        if (!db.objectStoreNames.contains("audit_log")) {
          const auditStore = db.createObjectStore("audit_log", { keyPath: "id" });
          auditStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
      req.onsuccess = (event) => resolve(event.target.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function discoverOfflineDbNames() {
  const names = new Set();

  if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
    try {
      const dbs = await indexedDB.databases();
      for (const info of dbs || []) {
        if (info?.name && info.name.startsWith(OFFLINE_DB_PREFIX)) {
          names.add(info.name);
        }
      }
    } catch {
      // Repli sur le registre dédié
    }
  }

  const regDb = await openSwRegistryDb();
  if (regDb) {
    try {
      if (regDb.objectStoreNames.contains("users")) {
        const tx = regDb.transaction("users", "readonly");
        const all = await idbReqToPromise(tx.objectStore("users").getAll());
        await idbTxComplete(tx);
        for (const item of all || []) {
          if (item?.dbName && String(item.dbName).startsWith(OFFLINE_DB_PREFIX)) {
            names.add(String(item.dbName));
          }
        }
      }
    } catch {
      // Ignorer
    } finally {
      try {
        regDb.close();
      } catch {}
    }
  }

  return Array.from(names);
}

async function notifyWindowClients(payload) {
  try {
    const windowClients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    for (const client of windowClients) {
      client.postMessage(payload);
    }
  } catch {
    // Aucun client ouvert (fonctionnement silencieux en arrière-plan)
  }
}

async function runBackgroundOutboxSync() {
  const dbNames = await discoverOfflineDbNames();
  if (dbNames.length === 0) return;

  let totalSynced = 0;
  let hasTransientFailure = false;
  let notifiedAuthExpired = false;
  const now = Date.now();

  for (const dbName of dbNames) {
    const db = await openOfflineUserDb(dbName);
    if (!db) continue;

    try {
      if (!db.objectStoreNames.contains("outbox")) {
        db.close();
        continue;
      }

      const readTx = db.transaction("outbox", "readonly");
      const allEntries = await idbReqToPromise(readTx.objectStore("outbox").getAll());
      await idbTxComplete(readTx);

      const dueEntries = (allEntries || [])
        .filter((e) => {
          if (!e || typeof e !== "object") return false;
          if (e.status === "auth_paused") return false;
          const isStaleSyncing =
            e.status === "syncing" && now - (e.lastAttemptAt || e.createdAt || 0) > 15000;
          const isEligibleStatus = e.status === "pending" || e.status === "failed" || isStaleSyncing;
          const isDue = !e.nextRetryAt || e.nextRetryAt <= now;
          return isEligibleStatus && isDue;
        })
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      if (dueEntries.length === 0) {
        db.close();
        continue;
      }

      const entryUserId = dueEntries[0]?.userId || "unknown";

      let response;
      try {
        response = await fetch("/api/offline/sync", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: dueEntries }),
        });
      } catch {
        hasTransientFailure = true;
        db.close();
        continue;
      }

      if (response.status === 401) {
        const storesToOpen = ["outbox"];
        if (db.objectStoreNames.contains("audit_log")) storesToOpen.push("audit_log");
        const authTx = db.transaction(storesToOpen, "readwrite");
        const outboxStore = authTx.objectStore("outbox");
        for (const entry of dueEntries) {
          outboxStore.put({
            ...entry,
            status: "auth_paused",
            lastAttemptAt: now,
            lastError: "Session expirée — reconnexion requise pour finaliser la synchronisation.",
          });
        }
        if (db.objectStoreNames.contains("audit_log")) {
          authTx.objectStore("audit_log").put({
            id: generateSwUuid(),
            userId: entryUserId,
            level: "warn",
            event: "background_sync_auth_expired",
            details: `${dueEntries.length} opération(s) mise(s) en pause sûre en arrière-plan (session expirée).`,
            timestamp: new Date().toISOString(),
          });
        }
        await idbTxComplete(authTx);
        notifiedAuthExpired = true;
        db.close();
        continue;
      }

      if (!response.ok) {
        const errTx = db.transaction("outbox", "readwrite");
        const outboxStore = errTx.objectStore("outbox");
        for (const entry of dueEntries) {
          const nextRetry = (entry.retryCount || 0) + 1;
          const backoffMs = Math.min(60000, 1500 * Math.pow(2, Math.min(nextRetry, 5)));
          outboxStore.put({
            ...entry,
            status: "failed",
            retryCount: nextRetry,
            nextRetryAt: Date.now() + backoffMs,
            lastAttemptAt: now,
            lastError: `Erreur serveur HTTP ${response.status} en arrière-plan.`,
          });
        }
        await idbTxComplete(errTx);
        hasTransientFailure = true;
        db.close();
        continue;
      }

      const result = await response.json().catch(() => null);
      const syncedIds = Array.isArray(result?.syncedIds) ? result.syncedIds : [];
      const failedItems = Array.isArray(result?.failed) ? result.failed : [];
      const failedById = new Map(failedItems.map((f) => [f.id, f]));

      const storesToOpen = ["outbox"];
      if (db.objectStoreNames.contains("meta")) storesToOpen.push("meta");
      if (db.objectStoreNames.contains("audit_log")) storesToOpen.push("audit_log");

      const writeTx = db.transaction(storesToOpen, "readwrite");
      const outboxStore = writeTx.objectStore("outbox");

      for (const id of syncedIds) {
        outboxStore.delete(id);
      }

      for (const entry of dueEntries) {
        if (syncedIds.includes(entry.id)) continue;
        const failInfo = failedById.get(entry.id);
        if (!failInfo) continue;

        if (failInfo.authExpired) {
          outboxStore.put({
            ...entry,
            status: "auth_paused",
            lastAttemptAt: now,
            lastError: failInfo.error || "Session expirée.",
          });
          notifiedAuthExpired = true;
        } else {
          const nextRetry = (entry.retryCount || 0) + 1;
          const backoffMs = Math.min(60000, 1500 * Math.pow(2, Math.min(nextRetry, 5)));
          outboxStore.put({
            ...entry,
            status: "failed",
            retryCount: nextRetry,
            nextRetryAt: Date.now() + backoffMs,
            lastAttemptAt: now,
            lastError: failInfo.error || "Erreur de synchronisation.",
          });
          if (!String(failInfo.error || "").toLowerCase().includes("isolation de sécurité")) {
            hasTransientFailure = true;
          }
        }
      }

      const nowIso = new Date().toISOString();
      if (syncedIds.length > 0 && db.objectStoreNames.contains("meta")) {
        const metaStore = writeTx.objectStore("meta");
        const snapEntry = await idbReqToPromise(metaStore.get("snapshot"));
        if (snapEntry && snapEntry.value) {
          metaStore.put({
            key: "snapshot",
            value: {
              ...snapEntry.value,
              lastSyncedAt: result?.serverTime || nowIso,
              lastSuccessfulSyncAt: nowIso,
              updatedAt: nowIso,
            },
          });
        }
      }

      if (syncedIds.length > 0 && db.objectStoreNames.contains("audit_log")) {
        writeTx.objectStore("audit_log").put({
          id: generateSwUuid(),
          userId: entryUserId,
          level: "info",
          event: "background_sync_completed",
          details: `${syncedIds.length} opération(s) synchronisée(s) en arrière-plan via Service Worker.`,
          timestamp: nowIso,
        });
      }

      await idbTxComplete(writeTx);
      totalSynced += syncedIds.length;
    } catch {
      hasTransientFailure = true;
    } finally {
      try {
        db.close();
      } catch {}
    }
  }

  if (totalSynced > 0) {
    await notifyWindowClients({
      type: "BACKGROUND_SYNC_COMPLETED",
      syncedCount: totalSynced,
    });
  } else if (notifiedAuthExpired) {
    await notifyWindowClients({
      type: "BACKGROUND_SYNC_AUTH_EXPIRED",
    });
  }

  if (hasTransientFailure) {
    throw new Error("BackgroundSync retry scheduled due to transient server or network error.");
  }
}

// Synchronisation en arrière-plan réelle (API BackgroundSync Chromium / Android PWA)
self.addEventListener("sync", (event) => {
  if (event.tag === OUTBOX_SYNC_TAG) {
    event.waitUntil(runBackgroundOutboxSync());
  }
});

// Messages depuis l'application (mise à jour contrôlée, registre utilisateur & préchauffage App Shell)
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (data.type === "WARM_APP_SHELL") {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => warmAppShellCache(cache))
    );
  } else if (data.type === "REGISTER_OFFLINE_USER" && data.userId) {
    event.waitUntil(updateSwRegistry(String(data.userId), "add"));
  } else if (data.type === "UNREGISTER_OFFLINE_USER" && data.userId) {
    event.waitUntil(updateSwRegistry(String(data.userId), "remove"));
  }
});

// Interception des requêtes réseau (Fetch)
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les extensions navigateur
  if (request.method !== "GET" || url.protocol.startsWith("chrome-extension")) {
    return;
  }

  // Requêtes API locales (/api/*) et Supabase : toujours réseau direct (jamais de cache périmé)
  if (
    url.hostname.includes("supabase.co") ||
    (url.origin === self.location.origin && url.pathname.startsWith("/api/"))
  ) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({ offline: true, error: "Network unavailable" }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            }
          )
      )
    );
    return;
  }

  // Requêtes de navigation (pages HTML) : Network-First avec repli sur route cachée puis App Shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy.clone());
              cache.put(url.pathname, copy);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedExact =
            (await caches.match(request)) ||
            (await caches.match(url.pathname, { ignoreSearch: true }));
          if (cachedExact) return cachedExact;

          // Repli sur l'App Shell /dashboard pour les routes protégées déjà initialisées
          if (APP_SHELL_ROUTES.some((r) => url.pathname.startsWith(r))) {
            const dashboardShell = await caches.match("/dashboard", {
              ignoreSearch: true,
            });
            if (dashboardShell) return dashboardShell;
          }

          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;

          return new Response(
            "Application hors ligne. Veuillez vérifier votre connexion.",
            {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          );
        })
    );
    return;
  }

  // Ressources statiques (_next/static, css, js, icons, images, fonts) : Stale-While-Revalidate
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
        const networkFetch = fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return res;
          })
          .catch(() => cached || new Response("", { status: 408 }));

        return cached || networkFetch;
      })
    );
    return;
  }

  // Comportement par défaut (ex: requêtes RSC Next.js) : Network-First avec repli cache
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response("", { status: 503 });
      })
  );
});
