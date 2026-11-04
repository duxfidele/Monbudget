"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/store/ui-store";

export function PWARegister() {
  const { setOnlineStatus, setDeferredPrompt, setAppInstalled, syncPendingQueue } = useUIStore();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Enregistrement immédiat du Service Worker sans attendre un onload qui a pu déjà passer
    if ("serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
          console.log("Service Worker MonBudget actif avec succès :", registration.scope);
        } catch (error) {
          console.warn("Échec d'enregistrement du Service Worker :", error);
        }
      };

      if (document.readyState === "complete" || document.readyState === "interactive") {
        registerSW();
      } else {
        window.addEventListener("DOMContentLoaded", registerSW, { once: true });
        window.addEventListener("load", registerSW, { once: true });
      }
    }

    // 2. Détection de l'état réseau en temps réel
    setOnlineStatus(navigator.onLine);

    const handleOnline = () => {
      setOnlineStatus(true);
      // Déclencher la synchronisation des actions mises en file d'attente
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
      (window as any).deferredInstallPrompt = e;
      setDeferredPrompt(e);
      console.log("Événement beforeinstallprompt capturé par MonBudget");
    };

    const handleAppInstalled = () => {
      setAppInstalled();
      console.log("Application MonBudget installée avec succès");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // 4. Vérifier si l'application est déjà exécutée en mode autonome (PWA / Standalone)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setAppInstalled();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [setOnlineStatus, setDeferredPrompt, setAppInstalled, syncPendingQueue]);

  return null;
}
