"use client";

import { Button } from "@/components/ui/button";
import { Download, MonitorCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { useUIStore } from "@/lib/store/ui-store";

interface InstallButtonProps {
  variant?: "header" | "banner" | "settings";
  className?: string;
}

export function InstallButton({ variant = "header", className = "" }: InstallButtonProps) {
  const { canInstallPwa, isPwaInstalled, installPwa } = useUIStore();

  if (variant === "settings") {
    if (isPwaInstalled) {
      return (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Application MonBudget installée</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Vous utilisez actuellement MonBudget en mode application native autonome (PWA).
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-200/60 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
            Installée
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border border-blue-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#1E3A5F] text-white shrink-0">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Installer MonBudget sur votre machine</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Profitez d&apos;une fenêtre dédiée sans barre d&apos;URL, d&apos;un accès hors-ligne instantané et d&apos;une icône sur votre bureau.
            </p>
          </div>
        </div>
        <Button
          onClick={installPwa}
          disabled={!canInstallPwa}
          className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white font-semibold text-xs sm:text-sm gap-2 shrink-0 shadow-sm"
        >
          <Download className="h-4 w-4" />
          <span>{canInstallPwa ? "Installer maintenant" : "Prêt à installer"}</span>
        </Button>
      </div>
    );
  }

  // Header variant
  if (isPwaInstalled || !canInstallPwa) {
    return null;
  }

  return (
    <Button
      onClick={installPwa}
      variant="outline"
      size="sm"
      className={`border-indigo-300 dark:border-indigo-700 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold gap-1.5 h-8 text-xs animate-in fade-in transition-all ${className}`}
      title="Installer MonBudget sur votre ordinateur ou smartphone"
    >
      <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
      <span className="hidden sm:inline">Installer l&apos;app</span>
    </Button>
  );
}
