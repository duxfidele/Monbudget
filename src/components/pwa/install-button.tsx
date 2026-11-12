"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  CheckCircle2,
  Laptop,
  Smartphone,
  Share,
  Info,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Check,
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

interface InstallButtonProps {
  variant?: "header" | "banner" | "settings" | "landing";
  className?: string;
}

export function InstallButton({ variant = "header", className = "" }: InstallButtonProps) {
  const { canInstallPwa, isPwaInstalled, installPwa } = useUIStore();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const handleInstallClick = async () => {
    if (canInstallPwa) {
      const handled = await installPwa();
      if (handled) return;
    }
    // Si l'invite native Chrome n'est pas encore disponible ou si l'OS requiert un geste manuel (Safari/iOS)
    setIsGuideOpen(true);
  };

  // 1. Variante Paramètres
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
      <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border border-blue-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#1E3A5F] dark:bg-sky-500 text-white dark:text-slate-950 shrink-0 shadow-sm">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Installer MonBudget sur votre machine
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Profitez d&apos;une fenêtre dédiée sans barre d&apos;URL, d&apos;un accès hors-ligne instantané et d&apos;une icône sur votre bureau.
              </p>
            </div>
          </div>
          <Button
            onClick={handleInstallClick}
            className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold text-xs sm:text-sm gap-2 shrink-0 shadow-sm transition-all"
          >
            <Download className="h-4 w-4" />
            <span>Installer l&apos;application</span>
          </Button>
        </div>

        {/* Modal d'instructions d'installation */}
        <InstallGuideDialog open={isGuideOpen} onOpenChange={setIsGuideOpen} />
      </>
    );
  }

  // 2. Variante Landing Page
  if (variant === "landing") {
    if (isPwaInstalled) return null;
    return (
      <>
        <Button
          onClick={handleInstallClick}
          variant="outline"
          className={`border-sky-400/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 font-semibold gap-2 rounded-xl text-sm ${className}`}
        >
          <Download className="h-4 w-4 text-sky-400" />
          <span>Installer l&apos;application</span>
        </Button>
        <InstallGuideDialog open={isGuideOpen} onOpenChange={setIsGuideOpen} />
      </>
    );
  }

  // 3. Variante En-tête (Header) par défaut : TOUJOURS visible tant que non installé
  if (isPwaInstalled) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleInstallClick}
        variant="outline"
        size="sm"
        className={`border-indigo-300 dark:border-indigo-700 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold gap-1.5 h-9 w-9 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs rounded-xl sm:rounded-lg transition-all shadow-xs ${className}`}
        title="Installer MonBudget sur votre ordinateur ou smartphone"
      >
        <Download className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span className="hidden sm:inline">Installer l&apos;app</span>
      </Button>

      <InstallGuideDialog open={isGuideOpen} onOpenChange={setIsGuideOpen} />
    </>
  );
}

// Modal d'aide et d'installation interactive multi-machines
function InstallGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { canInstallPwa, installPwa } = useUIStore();
  const [selectedDevice, setSelectedDevice] = useState<"android" | "desktop" | "ios">("android");
  const [detectedPlatform, setDetectedPlatform] = useState<"android" | "desktop" | "ios" | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  // Détection automatique de l'appareil de l'utilisateur à l'ouverture
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    let current: "android" | "desktop" | "ios" = "desktop";
    if (/android/i.test(ua)) {
      current = "android";
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      current = "ios";
    } else {
      current = "desktop";
    }
    setDetectedPlatform(current);
    setSelectedDevice(current);
  }, [open]);

  const handleDirectInstall = async () => {
    setIsInstalling(true);
    try {
      const handled = await installPwa();
      if (handled) {
        onOpenChange(false);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const devices: {
    id: "android" | "desktop" | "ios";
    title: string;
    subtitle: string;
    icon: typeof Smartphone;
    accent: string;
  }[] = [
    {
      id: "android",
      title: "Sur Android",
      subtitle: "Chrome, Samsung, Brave",
      icon: Smartphone,
      accent: "emerald",
    },
    {
      id: "desktop",
      title: "Sur Ordinateur",
      subtitle: "PC Windows, Mac, Linux",
      icon: Laptop,
      accent: "sky",
    },
    {
      id: "ios",
      title: "Sur iPhone / iPad",
      subtitle: "Navigateur Safari",
      icon: Share,
      accent: "blue",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 shadow-xs">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Installer MonBudget
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Choisissez votre machine pour lancer ou continuer l&apos;installation.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 1. Sélecteur interactif des 3 types de machines */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            1. Sélectionnez votre appareil :
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {devices.map((device) => {
              const isSelected = selectedDevice === device.id;
              const isDetected = detectedPlatform === device.id;
              const Icon = device.icon;

              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => setSelectedDevice(device.id)}
                  className={`relative flex flex-col items-start p-3 rounded-2xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-2 border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 shadow-sm ring-2 ring-sky-500/20"
                      : "border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                  }`}
                >
                  {/* Badge appareil détecté */}
                  {isDetected && (
                    <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white shadow-xs">
                      Votre appareil
                    </span>
                  )}

                  <div className="flex items-center justify-between w-full mb-2">
                    <div
                      className={`p-1.5 rounded-xl ${
                        isSelected
                          ? "bg-sky-500 text-white"
                          : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {isSelected ? (
                      <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600"></span>
                    )}
                  </div>

                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {device.title}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {device.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Zone d'action & Instructions pour la machine choisie */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              2. Procédure pour {selectedDevice === "android" ? "Android" : selectedDevice === "desktop" ? "Ordinateur" : "iPhone / iPad"} :
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
              Gratuit & Sans Play Store
            </span>
          </div>

          {/* CAS ANDROID */}
          {selectedDevice === "android" && (
            <div className="space-y-3">
              <Button
                type="button"
                onClick={handleDirectInstall}
                disabled={isInstalling}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm py-2.5 h-auto rounded-xl shadow-md shadow-emerald-900/20 gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                <span>
                  {canInstallPwa
                    ? "Lancer l'installation sur Android maintenant"
                    : "Installer MonBudget sur Android"}
                </span>
              </Button>

              <div className="space-y-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Si la fenêtre système n&apos;apparaît pas automatiquement :
                </p>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed">
                  <li>
                    Appuyez sur le menu des <strong>3 petits points (⋮)</strong> en haut à droite de Google Chrome.
                  </li>
                  <li>
                    Sélectionnez <strong>« Installer l&apos;application »</strong> ou <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>.
                  </li>
                  <li>
                    L&apos;icône MonBudget s&apos;ajoute instantanément à vos applications mobiles comme une application native.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* CAS ORDINATEUR */}
          {selectedDevice === "desktop" && (
            <div className="space-y-3">
              <Button
                type="button"
                onClick={handleDirectInstall}
                disabled={isInstalling}
                className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-bold text-xs sm:text-sm py-2.5 h-auto rounded-xl shadow-md gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                <span>
                  {canInstallPwa
                    ? "Lancer l'installation sur Ordinateur"
                    : "Installer MonBudget sur PC / Mac"}
                </span>
              </Button>

              <div className="space-y-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Méthode directe depuis votre navigateur :
                </p>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed">
                  <li>
                    Regardez à <strong>droite de votre barre d&apos;adresse</strong> (URL) : cliquez sur la petite icône d&apos;installation 📥.
                  </li>
                  <li>
                    Ou cliquez sur le menu <strong>(⋮)</strong> en haut à droite &gt; <strong>« Installer MonBudget »</strong>.
                  </li>
                  <li>
                    Profitez d&apos;une fenêtre dédiée autonome sans barre d&apos;onglets encombrante.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* CAS IPHONE / IPAD */}
          {selectedDevice === "ios" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                Apple Safari requiert l&apos;ajout manuel via le menu Partager :
              </div>

              <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <span>
                    En bas de l&apos;écran dans Safari, appuyez sur le bouton <strong>Partager ⎋</strong> (carré avec une flèche vers le haut).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <span>
                    Faites défiler le menu vers le bas et touchez <strong>« Sur l&apos;écran d&apos;accueil » ➕</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <span>
                    Touchez <strong>« Ajouter »</strong> en haut à droite. MonBudget apparaîtra immédiatement sur votre écran d&apos;accueil !
                  </span>
                </li>
              </ol>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fermer
          </Button>

          {(selectedDevice === "android" || selectedDevice === "desktop") && (
            <Button
              type="button"
              onClick={handleDirectInstall}
              disabled={isInstalling}
              className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>
                {selectedDevice === "android"
                  ? "Installer sur Android"
                  : "Installer sur Ordinateur"}
              </span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
