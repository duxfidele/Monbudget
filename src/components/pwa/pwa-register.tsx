"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";
import {
  checkServerReachability,
  requestBackgroundSync,
} from "@/lib/offline/sync-engine";

export function PWARegister() {
  const {
    userId,
    isOnline,
    pendingSyncCount,
    setOnlineStatus,
    setDeferredPrompt,
    setAppInstalled,
    syncPendingQueue,
    refreshOfflineDiagnostics,
    initStore,
  } = useUIStore();
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "BACKGROUND_SYNC_COMPLETED") {
        void refreshOfflineDiagnostics();
        const count = Number(data.syncedCount) || 0;
        if (count > 0) {
          void initStore();
        }
      } else if (data.type === "BACKGROUND_SYNC_AUTH_EXPIRED") {
        void refreshOfflineDiagnostics();
      }
    };

    // 1. Enregistrement du Service Worker + détection propre des mises à jour
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleControllerChange
      );
      navigator.serviceWorker.addEventListener("message", handleSwMessage);

      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });

          if (registration.waiting) {
            toast.info("Une nouvelle version de MonBudget est prête.", {
              duration: 10000,
              action: {
                label: "Mettre à jour",
                onClick: () => {
                  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
                },
              },
            });
          }

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                toast.info("Nouvelle mise à jour de MonBudget disponible.", {
                  duration: 10000,
                  action: {
                    label: "Actualiser",
                    onClick: () => {
                      newWorker.postMessage({ type: "SKIP_WAITING" });
                    },
                  },
                });
              }
            });
          });
        } catch (error) {
          console.warn("Échec d'enregistrement du Service Worker :", error);
        }
      };

      if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
      ) {
        registerSW();
      } else {
        window.addEventListener("DOMContentLoaded", registerSW, { once: true });
        window.addEventListener("load", registerSW, { once: true });
      }
    }

    // 2. Détection réelle de la connectivité (navigateur + sonde /api/health)
    const verifyAndSync = async () => {
      if (!navigator.onLine) {
        setOnlineStatus(false);
        return;
      }
      const probe = await checkServerReachability(3500);
      setOnlineStatus(probe.reachable);
      if (probe.reachable) {
        void syncPendingQueue();
      }
    };

    setOnlineStatus(navigator.onLine);
    void verifyAndSync();

    const handleOnline = () => {
      void verifyAndSync();
    };

    const handleOffline = () => {
      setOnlineStatus(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void verifyAndSync();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 3. Interception de l'événement d'installation PWA
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).deferredInstallPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setAppInstalled();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // 4. Détection du mode autonome installé
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setAppInstalled();
    }

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange
        );
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      }
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [
    setOnlineStatus,
    setDeferredPrompt,
    setAppInstalled,
    syncPendingQueue,
    refreshOfflineDiagnostics,
    initStore,
  ]);

  // 5. Enregistrer l'utilisateur actif dans le registre du Service Worker & planifier BackgroundSync hors ligne
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const prevUid = prevUserIdRef.current;
    navigator.serviceWorker.ready
      .then((reg) => {
        if (prevUid && !userId) {
          reg.active?.postMessage({ type: "UNREGISTER_OFFLINE_USER", userId: prevUid });
        } else if (userId) {
          reg.active?.postMessage({ type: "REGISTER_OFFLINE_USER", userId });
        }
      })
      .catch(() => {});
    prevUserIdRef.current = userId;

    if (!isOnline && pendingSyncCount > 0) {
      void requestBackgroundSync();
    }
  }, [userId, isOnline, pendingSyncCount]);

  // 6. Planificateur de reprise automatique (backoff) tant que des opérations restent en attente
  useEffect(() => {
    if (!isOnline || pendingSyncCount <= 0) return;
    const retryInterval = setInterval(() => {
      void syncPendingQueue();
    }, 15_000);
    return () => clearInterval(retryInterval);
  }, [isOnline, pendingSyncCount, syncPendingQueue]);

  return null;
}
