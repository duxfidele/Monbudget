"use client";

import { useUIStore } from "@/lib/store/ui-store";
import Link from "next/link";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

function formatSyncTime(iso?: string | null): string {
  if (!iso) return "En attente de première synchro";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Synchronisé";
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Synchronisé";
  }
}

export function NetworkStatus() {
  const {
    isOnline,
    syncStatus,
    pendingSyncCount,
    lastSyncedAt,
    lastSyncError,
    unresolvedConflictsCount,
    syncPendingQueue,
  } = useUIStore();

  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const effectiveSyncing = isManualSyncing || syncStatus === "syncing";
  const isOfflineState = !isOnline || syncStatus === "offline";
  const isAuthExpired = !isOfflineState && syncStatus === "auth_expired";
  const isErrorState = !isOfflineState && !isAuthExpired && syncStatus === "error";

  const handleManualSync = async () => {
    if (effectiveSyncing) return;
    setIsManualSyncing(true);
    try {
      await syncPendingQueue(true);
    } finally {
      setIsManualSyncing(false);
    }
  };

  let pillClasses =
    "bg-emerald-500/12 border-emerald-500/25 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20";
  let label = "En ligne";
  let icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;

  if (isOfflineState) {
    pillClasses =
      "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20";
    label = "Hors-ligne";
    icon = <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />;
  } else if (effectiveSyncing) {
    pillClasses =
      "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20";
    label = "Synchronisation…";
    icon = <RefreshCw className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />;
  } else if (isAuthExpired) {
    pillClasses =
      "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20";
    label = "Session expirée";
    icon = <Lock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />;
  } else if (isErrorState) {
    pillClasses =
      "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20";
    label = "Erreur de synchro";
    icon = <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />;
  } else if (pendingSyncCount > 0) {
    pillClasses =
      "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20";
    label = "En attente";
    icon = <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />;
  }

  return (
    <div ref={containerRef} className="relative inline-block" data-testid="network-status-container">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        data-testid="network-status-pill"
        data-sync-state={
          isOfflineState
            ? "offline"
            : effectiveSyncing
            ? "syncing"
            : isAuthExpired
            ? "auth_expired"
            : isErrorState
            ? "error"
            : "online"
        }
        className={`inline-flex items-center justify-center gap-1.5 h-9 sm:h-8 px-2.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${pillClasses}`}
        title={`État de connexion : ${label}`}
        aria-label={`État de connexion : ${label}${pendingSyncCount > 0 ? ` (${pendingSyncCount} en attente)` : ""}`}
      >
        {icon}
        <span className="sr-only sm:not-sr-only">{label}</span>
        {pendingSyncCount > 0 && (
          <span
            data-testid="network-pending-count"
            className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/15 text-[10px] font-extrabold"
          >
            {pendingSyncCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="network-status-popover"
          className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-[6.25rem] sm:top-full sm:mt-2 w-auto sm:w-72 rounded-xl border border-border bg-card text-card-foreground shadow-xl p-3.5 z-50 text-xs space-y-2.5"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-1.5 font-semibold">
              {isOfflineState ? (
                <WifiOff className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span>
                {isOfflineState ? "Mode Hors-Ligne Actif" : "Connexion Serveur Active"}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {formatSyncTime(lastSyncedAt)}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {isOfflineState
              ? "Vos ajouts, modifications et suppressions sont conservés en sécurité dans la base locale IndexedDB et seront synchronisés automatiquement au retour d'Internet."
              : isAuthExpired
              ? "Votre session a expiré pendant l'utilisation hors-ligne. Aucune donnée n'est perdue : reconnectez-vous pour finaliser l'envoi."
              : isErrorState
              ? "Une erreur temporaire a interrompu la synchronisation. Nouvelle tentative automatique planifiée."
              : pendingSyncCount > 0
              ? `${pendingSyncCount} opération(s) locale(s) en file d'attente de confirmation serveur.`
              : "Toutes vos données locales sont parfaitement synchronisées."}
          </p>

          <div className="flex items-center justify-between text-[11px] bg-muted/50 rounded-lg px-2.5 py-1.5">
            <span className="text-muted-foreground">Opérations en attente</span>
            <span className="font-bold">{pendingSyncCount}</span>
          </div>

          {unresolvedConflictsCount > 0 && (
            <Link
              href="/settings?tab=security#conflicts-review"
              onClick={() => {
                setOpen(false);
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("monbudget:open-conflicts-review"));
                }
              }}
              data-testid="network-conflicts-link"
              className="flex items-center justify-between text-[11px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <span className="font-medium inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {unresolvedConflictsCount} conflit{unresolvedConflictsCount > 1 ? "s" : ""} à réviser
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            </Link>
          )}

          {lastSyncError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-[11px] text-rose-700 dark:text-rose-300 break-words">
              {lastSyncError}
            </div>
          )}

          <button
            type="button"
            onClick={handleManualSync}
            disabled={effectiveSyncing}
            data-testid="network-manual-sync-btn"
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-[11px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${effectiveSyncing ? "animate-spin" : ""}`} />
            <span>
              {effectiveSyncing ? "Synchronisation en cours…" : "Synchroniser maintenant"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
