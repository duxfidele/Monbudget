"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/store/ui-store";

export function PWARegister() {
  const { setOnlineStatus, setDeferredPrompt, setAppInstalled, syncPendingQueue } = useUIStore();

  useEffect(() => {
    // 1. Enregistrement du Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Service Worker MonBudget enregistré avec succès :", registration.scope);
          })
          .catch((error) => {
            console.warn("Échec d'enregistrement du Service Worker :", error);
          });
      });
    }

    // 2. Détection de l'état réseau en temps réel
    if (typeof window !== "undefined") {
      setOnlineStatus(navigator.onLine);

      const handleOnline = () => {
        setOnlineStatus(true);
        // Déclencher la synchronisation automatique dès que le réseau revient
        syncPendingQueue();
      };

      const handleOffline = () => {
        setOnlineStatus(false);
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // 3. Interception de l'événement d'installation PWA de Chrome
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      const handleAppInstalled = () => {
        setAppInstalled();
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleAppInstalled);

      // Vérifier si déjà exécuté en mode standalone
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;

      if (isStandalone) {
        setAppInstalled();
      }

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, [setOnlineStatus, setDeferredPrompt, setAppInstalled, syncPendingQueue]);

  return null;
}
