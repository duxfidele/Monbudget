"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  CheckCircle2,
  Laptop,
  Smartphone,
  Share,
  Info,
  Sparkles,
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
        className={`border-indigo-300 dark:border-indigo-700 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold gap-1.5 h-8 text-xs transition-all shadow-xs ${className}`}
        title="Installer MonBudget sur votre ordinateur ou smartphone"
      >
        <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        <span className="hidden sm:inline">Installer l&apos;app</span>
      </Button>

      <InstallGuideDialog open={isGuideOpen} onOpenChange={setIsGuideOpen} />
    </>
  );
}

// Modal d'aide et d'installation multi-navigateurs
function InstallGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { canInstallPwa, installPwa } = useUIStore();

  const handleDirectInstall = async () => {
    if (canInstallPwa) {
      await installPwa();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Installer MonBudget
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Fonctionne hors-ligne comme une véritable application native.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs text-slate-700 dark:text-slate-300">
          {/* Guide Chrome PC / Mac */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Laptop className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400" />
              <span>Sur Ordinateur (Chrome, Edge, Brave) :</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-600 dark:text-slate-300">
              <li>
                Regardez à <strong>droite de votre barre d&apos;adresse</strong> : cliquez sur l&apos;icône <strong>Installer MonBudget</strong> 📥.
              </li>
              <li>
                Ou ouvrez le menu <strong>(⋮)</strong> en haut à droite &gt; <strong>Installer MonBudget</strong>.
              </li>
            </ol>
          </div>

          {/* Guide Smartphone Android */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Sur Android (Chrome) :</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 pl-1">
              Appuyez sur le menu <strong>(⋮)</strong> en haut à droite, puis sélectionnez <strong>&laquo;&nbsp;Installer l&apos;application&nbsp;&raquo;</strong> ou <strong>&laquo;&nbsp;Ajouter à l&apos;écran d&apos;accueil&nbsp;&raquo;</strong>.
            </p>
          </div>

          {/* Guide iPhone / iPad */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Share className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Sur iPhone / iPad (Safari) :</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 pl-1">
              Touchez le bouton Partager <strong>⎋</strong> en bas de Safari, faites défiler et touchez <strong>&laquo;&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;&raquo; ➕</strong>.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fermer
          </Button>

          {canInstallPwa && (
            <Button
              type="button"
              onClick={handleDirectInstall}
              className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Installer maintenant</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
