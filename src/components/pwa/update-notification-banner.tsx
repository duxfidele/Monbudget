"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  RefreshCw,
  Download,
  X,
  CheckCircle2,
  TrendingUp,
  Layers,
  FileText,
  Smartphone,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUIStore } from "@/lib/store/ui-store";
import { CURRENT_APP_VERSION, APP_CHANGELOG } from "@/lib/app-version";

export function UpdateNotificationBanner() {
  const {
    isUpdateAvailable,
    updateDismissed,
    isNewFeatureModalOpen,
    canInstallPwa,
    isPwaInstalled,
    setUpdateDismissed,
    setIsNewFeatureModalOpen,
    applyAppUpdate,
    installPwa,
  } = useUIStore();

  const [installDismissed, setInstallDismissed] = useState<boolean>(false);
  const [hasNewVersionNotice, setHasNewVersionNotice] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const lastSeen = localStorage.getItem("monbudget_last_seen_version");
      if (!lastSeen || lastSeen !== CURRENT_APP_VERSION) {
        setHasNewVersionNotice(true);
      }
      const dismissedInstall = sessionStorage.getItem("monbudget_install_banner_dismissed");
      if (dismissedInstall === "true") {
        setInstallDismissed(true);
      }
    } catch {
      // Ignorer si localStorage est restreint
    }
  }, []);

  const handleDismissInstall = () => {
    setInstallDismissed(true);
    try {
      sessionStorage.setItem("monbudget_install_banner_dismissed", "true");
    } catch {}
  };

  const handleOpenChangelog = () => {
    setIsNewFeatureModalOpen(true);
    try {
      localStorage.setItem("monbudget_last_seen_version", CURRENT_APP_VERSION);
      setHasNewVersionNotice(false);
    } catch {}
  };

  const latestRelease = APP_CHANGELOG[0];

  return (
    <>
      {/* 1. Bannière Haute Priorité : Nouvelle version / Service Worker prêt à installer */}
      {isUpdateAvailable && !updateDismissed && (
        <div
          data-testid="pwa-update-banner"
          className="relative z-30 mx-3 sm:mx-4 md:mx-6 lg:mx-8 my-2.5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#0F233F] via-[#1E3A5F] to-[#2B5489] text-white border border-sky-400/40 shadow-lg animate-in slide-in-from-top-2 duration-300"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                <RefreshCw className="h-5 w-5 animate-spin" style={{ animationDuration: "6s" }} />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
                    <span>Nouvelle version {CURRENT_APP_VERSION} disponible</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-400 text-slate-950 uppercase">
                      Prête
                    </span>
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  De nouvelles fonctionnalités et améliorations ont été ajoutées. Installez la mise à jour pour en profiter immédiatement.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenChangelog}
                className="cursor-pointer bg-white/10 hover:bg-white/20 text-white border-white/25 text-xs rounded-xl"
              >
                <span>Nouveautés</span>
              </Button>

              <Button
                size="sm"
                onClick={applyAppUpdate}
                className="cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl gap-1.5 shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Installer la mise à jour</span>
              </Button>

              <button
                type="button"
                onClick={() => setUpdateDismissed(true)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Fermer la notification de mise à jour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Bannière de découverte des nouvelles fonctionnalités si nouvelle version déployée */}
      {!isUpdateAvailable && hasNewVersionNotice && (
        <div
          data-testid="new-features-banner"
          className="relative z-30 mx-3 sm:mx-4 md:mx-6 lg:mx-8 my-2.5 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-blue-900/90 via-indigo-900/90 to-slate-900/90 text-white border border-indigo-500/40 shadow-sm animate-in fade-in"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-white truncate">
                  Nouveautés MonBudget ({latestRelease.version}) : {latestRelease.title}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                  Découvrez les dernières fonctionnalités ajoutées à votre espace.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Button
                size="sm"
                onClick={handleOpenChangelog}
                className="cursor-pointer bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs rounded-xl gap-1 shadow-xs"
              >
                <span>Découvrir</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <button
                type="button"
                onClick={() => {
                  setHasNewVersionNotice(false);
                  try {
                    localStorage.setItem("monbudget_last_seen_version", CURRENT_APP_VERSION);
                  } catch {}
                }}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Fermer la bannière de nouveautés"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Bannière d'installation PWA si l'utilisateur consulte l'app dans un navigateur non installé */}
      {!isUpdateAvailable && !hasNewVersionNotice && !isPwaInstalled && canInstallPwa && !installDismissed && (
        <div
          data-testid="pwa-install-banner"
          className="relative z-30 mx-3 sm:mx-4 md:mx-6 lg:mx-8 my-2.5 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-sky-200 dark:border-slate-800 shadow-xs animate-in fade-in"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-[#1E3A5F] dark:bg-sky-500 text-white dark:text-slate-950 shrink-0">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  Installez MonBudget sur votre appareil
                </p>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
                  Accès instantané depuis votre écran d&apos;accueil, mode hors-ligne et notifications.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Button
                size="sm"
                onClick={() => void installPwa()}
                className="cursor-pointer bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-bold text-xs rounded-xl gap-1.5 shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Installer</span>
              </Button>
              <button
                type="button"
                onClick={handleDismissInstall}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                aria-label="Fermer la suggestion d'installation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modale Interactive des Nouveautés de la Version */}
      <Dialog open={isNewFeatureModalOpen} onOpenChange={setIsNewFeatureModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader className="space-y-2 pb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold w-fit">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nouveautés de MonBudget — Version {CURRENT_APP_VERSION}</span>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {latestRelease.title}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Mise à jour officielle publiée le {latestRelease.releaseDate}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {latestRelease.highlights.map((item, index) => (
              <div
                key={index}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                    {item.title}
                  </span>
                  {item.category && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 uppercase">
                      {item.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 pl-6 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400">
              MonBudget • Application Web Progressive (PWA)
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {isUpdateAvailable && (
                <Button
                  onClick={applyAppUpdate}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Installer maintenant</span>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setIsNewFeatureModalOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Fermer
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
