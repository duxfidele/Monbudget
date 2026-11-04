"use client";

import { useUIStore } from "@/lib/store/ui-store";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useState } from "react";

export function NetworkStatus() {
  const { isOnline, pendingSyncCount, syncPendingQueue } = useUIStore();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncPendingQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOnline) {
    return (
      <div 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300"
        title="Vous êtes actuellement hors-ligne. Vos données sont enregistrées en local et seront synchronisées dès le retour d'Internet."
      >
        <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Hors-ligne</span>
        {pendingSyncCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-[10px]">
            {pendingSyncCount} en attente
          </span>
        )}
      </div>
    );
  }

  if (pendingSyncCount > 0) {
    return (
      <button
        onClick={handleManualSync}
        disabled={isSyncing}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors cursor-pointer"
        title="Cliquez pour synchroniser immédiatement vos données locales avec Supabase"
      >
        <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
        <span>Synchro ({pendingSyncCount})</span>
      </button>
    );
  }

  return null;
}
