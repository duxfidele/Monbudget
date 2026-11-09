"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Camera, Upload, Trash2, Eye, CheckCircle2, FileText, Loader2, Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  validateReceiptFile,
  compressReceiptImage,
  formatFileSize,
} from "@/lib/utils/receipt-storage";
import { canAccessFeature, getSubscriptionCountdownInfo } from "@/lib/moneriz-plans";
import { useUIStore } from "@/lib/store/ui-store";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ReceiptData {
  url: string;
  name: string;
  size?: number;
  savingsPercent?: number;
}

interface ReceiptUploadProps {
  receipt?: ReceiptData | null;
  onChange: (receipt: ReceiptData | null) => void;
  disabled?: boolean;
}

export function ReceiptUpload({ receipt, onChange, disabled }: ReceiptUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const {
    subscriptionPlan,
    subscriptionStatus,
    subscriptionExpiresAt,
    subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdminUser,
  } = useUIStore();

  const countdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    trialEndsAt: subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdmin: isAdminUser,
  });
  const canAttachReceipts =
    isAdminUser || canAccessFeature(countdown.effectivePlanId, "receipts");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Réinitialiser la valeur de l'input pour permettre de sélectionner à nouveau le même fichier si besoin
    e.target.value = "";

    if (!canAttachReceipts) {
      toast.info(
        "Fonctionnalité cadenassée — Prenez l'abonnement Particulier à 1 000 FCFA/mois pour joindre des reçus."
      );
      return;
    }

    // 1. Validation préalable
    const validation = validateReceiptFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      toast.error(validation.error || "Fichier invalide");
      return;
    }

    setIsProcessing(true);
    try {
      // 2. Compression côté client pour économiser la bande passante
      const compression = await compressReceiptImage(file);

      onChange({
        url: compression.dataUrl,
        name: validation.sanitizedName || file.name,
        size: compression.compressedSize,
        savingsPercent: compression.savingsPercent,
      });

      if (compression.savingsPercent > 0) {
        toast.success(
          `Reçu compressé (-${compression.savingsPercent}%) : ${formatFileSize(
            compression.originalSize
          )} → ${formatFileSize(compression.compressedSize)}`
        );
      } else {
        toast.success(`Reçu "${file.name}" attaché !`);
      }
    } catch (err: any) {
      console.error("Erreur compression reçu :", err);
      toast.error("Impossible de traiter ce justificatif.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isPdf = receipt?.name.toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <span>Justificatif de dépense</span>
          <span className="text-[10px] font-normal text-slate-400 capitalize">(Optionnel)</span>
        </label>
        {receipt && (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Reçu attaché
          </span>
        )}
      </div>

      {/* Input fichiers cachés : 1 pour la caméra directe sur smartphone, 1 pour parcourir les dossiers */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isProcessing}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isProcessing}
      />

      {!receipt ? (
        canAttachReceipts ? (
        <div className="grid grid-cols-2 gap-2">
          {/* Bouton Prendre une photo */}
          <Button
            type="button"
            variant="outline"
            disabled={disabled || isProcessing}
            onClick={() => cameraInputRef.current?.click()}
            className="h-10 text-xs border-dashed border-slate-300 dark:border-slate-700 hover:border-[#1E3A5F] dark:hover:border-sky-400 text-slate-700 dark:text-slate-200"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin text-sky-500" />
            ) : (
              <Camera className="h-4 w-4 mr-1.5 text-sky-600 dark:text-sky-400" />
            )}
            Prendre photo
          </Button>

          {/* Bouton Parcourir fichier / PDF */}
          <Button
            type="button"
            variant="outline"
            disabled={disabled || isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="h-10 text-xs border-dashed border-slate-300 dark:border-slate-700 hover:border-[#1E3A5F] dark:hover:border-sky-400 text-slate-700 dark:text-slate-200"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin text-sky-500" />
            ) : (
              <Upload className="h-4 w-4 mr-1.5 text-slate-600 dark:text-slate-400" />
            )}
            Choisir fichier
          </Button>
        </div>
        ) : (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 min-w-0">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-[11px] font-medium text-amber-900 dark:text-amber-200 truncate">
              Ajout de reçus cadenassé — Abonnement Particulier 1 000 FCFA/mois
            </span>
          </div>
          <Link href="/settings?tab=subscription&plan=personal" className="shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-[11px] font-bold border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 hover:bg-amber-100 gap-1"
            >
              <Crown className="h-3 w-3" />
              <span>Débloquer</span>
            </Button>
          </Link>
        </div>
        )
      ) : (
        /* Prévisualisation miniature du reçu attaché */
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5 min-w-0">
            {isPdf ? (
              <div className="p-2 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
            ) : (
              <div
                onClick={() => setIsPreviewOpen(true)}
                className="h-10 w-10 rounded-md bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 cursor-pointer border border-slate-300 dark:border-slate-600 hover:opacity-85 transition-opacity relative group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receipt.url}
                  alt="Aperçu reçu"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            )}

            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {receipt.name}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {receipt.size ? formatFileSize(receipt.size) : "Attaché"}
                {receipt.savingsPercent && receipt.savingsPercent > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                    (-{receipt.savingsPercent}%)
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsPreviewOpen(true)}
              className="h-7 w-7 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400"
              title="Agrandir le justificatif"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(null)}
              className="h-7 w-7 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
              title="Supprimer le justificatif"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal d'Aperçu Grand Format du Reçu */}
      {receipt && (
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-md p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <DialogTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {receipt.name}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-3 flex items-center justify-center max-h-[70vh] overflow-auto rounded-lg bg-slate-950 p-2">
              {isPdf ? (
                <iframe
                  src={receipt.url}
                  className="w-full h-96 rounded border-0"
                  title="Aperçu PDF"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={receipt.url}
                  alt={receipt.name}
                  className="max-h-[65vh] w-auto object-contain rounded"
                />
              )}
            </div>

            <div className="mt-3 flex justify-between items-center text-xs text-slate-500">
              <span>{receipt.size ? formatFileSize(receipt.size) : ""}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewOpen(false)}
                className="h-8 text-xs"
              >
                Fermer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

