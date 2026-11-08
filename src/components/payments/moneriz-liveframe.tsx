"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/store/ui-store";
import { BillingCycle, MONBUDGET_PLANS, PaidSubscriptionPlanId } from "@/lib/moneriz-plans";
import { toast } from "sonner";

export interface CheckoutSessionClientPayload {
  orderId: string;
  reference: string;
  amount: number;
  currency: "XOF";
  id: string;
  integrationMode: "iframe" | "redirect";
  checkoutUrl: string;
  embedUrl: string | null;
}

interface MonerizLiveframeProps {
  planId: PaidSubscriptionPlanId;
  billingCycle: BillingCycle;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MonerizLiveframe({
  planId,
  billingCycle,
  onSuccess,
  onCancel,
}: MonerizLiveframeProps) {
  const { refreshSubscription } = useUIStore();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [session, setSession] = useState<CheckoutSessionClientPayload | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(640);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<
    "idle" | "pending" | "verifying_server" | "confirmed" | "failed" | "expired"
  >("idle");

  const plan = MONBUDGET_PLANS[planId];
  const expectedAmount =
    billingCycle === "yearly" ? plan.yearlyPriceXof : plan.monthlyPriceXof;

  const startOrResumeCheckout = async (existingOrderId?: string) => {
    setIsLoadingSession(true);
    setSessionError(null);
    setResumeUrl(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(existingOrderId ? { orderId: existingOrderId } : {}),
          planId,
          billingCycle,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error?.message || "Impossible d'initialiser la session de paiement Moneriz."
        );
      }

      if (data.integrationMode === "redirect" || !data.embedUrl) {
        setSession(data);
        window.location.assign(data.checkoutUrl);
        return;
      }

      setSession(data);
      setPaymentState("idle");
    } catch (err: any) {
      setSessionError(
        err?.message || "Erreur lors de la connexion au service de paiement Moneriz."
      );
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    startOrResumeCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, billingCycle]);

  // Contrat Liveframe postMessage v1
  useEffect(() => {
    if (!session || session.integrationMode !== "iframe" || !session.embedUrl) {
      return;
    }

    let expectedOrigin = "";
    try {
      expectedOrigin = new URL(session.embedUrl).origin;
    } catch {
      return;
    }

    const onMessage = async (event: MessageEvent) => {
      const iframeWin = iframeRef.current?.contentWindow;
      if (!iframeWin) return;
      if (event.origin !== expectedOrigin || event.source !== iframeWin) return;

      const msg = event.data;
      if (!msg || typeof msg !== "object" || msg.version !== 1) return;

      if (msg.type === "moneriz.ready") {
        iframeWin.postMessage(
          {
            type: "moneriz.init",
            version: 1,
            sessionId: session.id,
            parentOrigin: window.location.origin,
          },
          expectedOrigin
        );
      } else if (msg.type === "moneriz.resize") {
        const nextHeight = Math.max(480, Number(msg.height) || 640);
        setIframeHeight(nextHeight);
      } else if (msg.type === "moneriz.resume") {
        if (typeof msg.url === "string" && msg.url.startsWith("https://")) {
          setResumeUrl(msg.url);
        }
      } else if (msg.type === "moneriz.payment") {
        if (msg.status === "paid" && msg.confirmation === "confirmed") {
          // Ne jamais activer sur le seul postMessage client : on interroge notre serveur
          setPaymentState("verifying_server");
          await verifyServerConfirmation(session.orderId, msg.paymentId);
        } else if (msg.status === "pending") {
          setPaymentState("pending");
        } else if (msg.status === "failed") {
          setPaymentState("failed");
        } else if (msg.status === "expired") {
          setPaymentState("expired");
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const verifyServerConfirmation = async (orderId: string, paymentId?: string) => {
    setPaymentState("verifying_server");
    // Jusqu'à 5 vérifications espacées de 1.5s pour laisser le webhook signé arriver
    for (let i = 0; i < 5; i++) {
      const result = await refreshSubscription(orderId, paymentId);
      if (result.orderStatus === "paid" || result.planId === planId) {
        setPaymentState("confirmed");
        toast.success(`Abonnement ${plan.name} activé avec succès !`);
        onSuccess?.();
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    // Si le webhook est encore en transit
    setPaymentState("pending");
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* En-tête récapitulatif de la commande */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
              Formule {plan.name}
            </span>
            <span className="text-xs text-slate-300">
              {billingCycle === "yearly" ? "Facturation Annuelle (-2 mois)" : "Facturation Mensuelle"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Mobile Money (Wave, Orange Money, MTN, Moov) & Carte Bancaire
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold text-white">
            {expectedAmount.toLocaleString("fr-FR")} FCFA
          </p>
          <p className="text-[11px] text-emerald-400 flex items-center justify-end gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Paiement sécurisé Moneriz
          </p>
        </div>
      </div>

      {/* État de chargement initial */}
      {isLoadingSession && (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F] dark:text-sky-400" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Préparation de votre session sécurisée Moneriz...
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-sm">
            Génération de la référence unique et connexion chiffrée au terminal de paiement.
          </p>
        </div>
      )}

      {/* Erreur de création de session (ex: clé non configurée ou KYB) */}
      {!isLoadingSession && sessionError && (
        <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-center space-y-3">
          <XCircle className="h-8 w-8 text-rose-600 dark:text-rose-400 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-rose-950 dark:text-rose-200">
              Impossible d&apos;ouvrir le guichet de paiement
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
              {sessionError}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            { onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                Fermer
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => startOrResumeCheckout(session?.orderId)}
              className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Réessayer
            </Button>
          </div>
        </div>
      )}

      {/* Alerte de reprise externe (moneriz.resume) */}
      {resumeUrl && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
            Une validation externe (application Mobile Money ou 3D Secure) est requise pour finaliser votre paiement.
          </p>
          <a
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shrink-0"
          >
            <span>Continuer le paiement</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Bannière d'état de confirmation serveur */}
      {paymentState === "verifying_server" && (
        <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-600 dark:text-sky-400 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-sky-950 dark:text-sky-200">
              Vérification de la confirmation serveur en cours...
            </p>
            <p className="text-sky-700 dark:text-sky-300">
              Nous validons la signature cryptographique du paiement avant d&apos;activer votre abonnement.
            </p>
          </div>
        </div>
      )}

      {paymentState === "pending" && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-950 dark:text-amber-200">
                Paiement en attente de confirmation opérateur
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                Ne fermez pas cette fenêtre si vous validez sur votre téléphone.
              </p>
            </div>
          </div>
          {session && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => verifyServerConfirmation(session.orderId)}
              className="shrink-0 text-xs"
            >
              Vérifier le statut
            </Button>
          )}
        </div>
      )}

      {paymentState === "confirmed" && (
        <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <p className="text-base font-extrabold text-emerald-950 dark:text-emerald-100">
            Votre formule {plan.name} est maintenant active !
          </p>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Toutes les fonctionnalités de votre formule ont été débloquées instantanément.
          </p>
        </div>
      )}

      {/* Iframe Liveframe Moneriz */}
      {!isLoadingSession &&
        !sessionError &&
        session &&
        session.integrationMode === "iframe" &&
        session.embedUrl &&
        paymentState !== "confirmed" && (
          <div className="w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white">
            <iframe
              ref={iframeRef}
              src={session.embedUrl}
              title={`Paiement Moneriz — ${plan.name}`}
              allow="payment *; clipboard-write"
              style={{
                width: "100%",
                border: 0,
                minHeight: "640px",
                height: `${iframeHeight}px`,
              }}
            />
          </div>
        )}
    </div>
  );
}

