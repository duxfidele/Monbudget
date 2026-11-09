"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
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
import { BillingCycle, getPlanCatalog, PaidSubscriptionPlanId } from "@/lib/moneriz-plans";
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

interface ParsedLiveframeSession {
  embedHref: string;
  embedOrigin: string;
  checkoutOrigin: string;
  checkoutPathname: string;
  token: string;
}

interface MonerizLiveframeProps {
  planId: PaidSubscriptionPlanId;
  billingCycle: BillingCycle;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const LIVEFRAME_BASE_KEYS = ["source", "version", "token", "type"] as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_PAYMENT_STATUSES = new Set(["pending", "paid", "failed", "expired", "reversed"]);
const VALID_CONFIRMATIONS = new Set(["pending", "authorized", "confirmed", "review"]);

function hasExactKeys(message: Record<string, unknown>, extraKeys: string[] = []): boolean {
  const expected = [...LIVEFRAME_BASE_KEYS, ...extraKeys];
  const actualKeys = Object.keys(message);
  return (
    actualKeys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(message, key))
  );
}

function isValidOpaqueId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function parseLiveframeSession(
  session: CheckoutSessionClientPayload | null
): ParsedLiveframeSession | null {
  if (!session || session.integrationMode !== "iframe" || !session.embedUrl || !session.checkoutUrl) {
    return null;
  }

  try {
    const embed = new URL(session.embedUrl);
    const checkout = new URL(session.checkoutUrl);
    const token = embed.pathname.match(/^\/integrer\/([A-Za-z0-9_-]{24,128})$/)?.[1];
    if (!token || checkout.origin !== embed.origin || checkout.pathname !== `/payer/${token}`) {
      return null;
    }

    const isLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(embed.hostname);
    if (embed.protocol !== "https:" && !(isLocalHost && embed.protocol === "http:")) {
      return null;
    }

    return {
      embedHref: embed.href,
      embedOrigin: embed.origin,
      checkoutOrigin: checkout.origin,
      checkoutPathname: checkout.pathname,
      token,
    };
  } catch {
    return null;
  }
}

export function MonerizLiveframe({
  planId,
  billingCycle,
  onSuccess,
  onCancel,
}: MonerizLiveframeProps) {
  const router = useRouter();
  const { refreshSubscription, refreshNotifications } = useUIStore();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const latestPaymentIdRef = useRef<string | null>(null);
  const lastPaymentStateRef = useRef<string | null>(null);
  const resumeKnownRef = useRef<boolean>(false);
  const verifyingRef = useRef<boolean>(false);
  const confirmedHandledRef = useRef<boolean>(false);

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [session, setSession] = useState<CheckoutSessionClientPayload | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(560);
  const [slowLoadNotice, setSlowLoadNotice] = useState<boolean>(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<
    "idle" | "pending" | "verifying_server" | "confirmed" | "failed" | "expired"
  >("idle");

  const plan = getPlanCatalog()[planId];
  const expectedAmount =
    billingCycle === "yearly" ? plan.yearlyPriceXof : plan.monthlyPriceXof;

  const parsedUrls = useMemo(() => parseLiveframeSession(session), [session]);

  const goToDashboardNow = useCallback(() => {
    onCancel?.();
    router.push("/dashboard");
    router.refresh();
  }, [onCancel, router]);

  const handleServerConfirmed = useCallback(() => {
    if (confirmedHandledRef.current) return;
    confirmedHandledRef.current = true;
    setPaymentState("confirmed");
    setResumeUrl(null);
    void refreshNotifications();
    toast.success(`Abonnement ${plan.name} activé ! Redirection vers votre tableau de bord...`);
    onSuccess?.();
  }, [onSuccess, plan.name, refreshNotifications]);

  const checkServerOrderOnce = useCallback(
    async (orderId: string, paymentId?: string | null): Promise<boolean> => {
      if (confirmedHandledRef.current) return true;
      const result = await refreshSubscription(orderId, paymentId || latestPaymentIdRef.current);
      if (result.orderStatus === "paid") {
        handleServerConfirmed();
        return true;
      }
      return false;
    },
    [handleServerConfirmed, refreshSubscription]
  );

  const verifyServerConfirmation = useCallback(
    async (orderId: string, paymentId?: string | null) => {
      if (verifyingRef.current || confirmedHandledRef.current) return;
      verifyingRef.current = true;
      setPaymentState("verifying_server");

      try {
        // Jusqu'à 6 vérifications rapprochées (environ 7-8 s) pour laisser arriver le webhook signé
        // ou permettre le rapprochement serveur via GET /v1/payments/{id}
        for (let i = 0; i < 6; i++) {
          const confirmed = await checkServerOrderOnce(orderId, paymentId);
          if (confirmed) return;
          if (i < 5) {
            await new Promise((resolve) => setTimeout(resolve, 1300));
          }
        }
        if (!confirmedHandledRef.current) {
          setPaymentState("pending");
        }
      } finally {
        verifyingRef.current = false;
      }
    },
    [checkServerOrderOnce]
  );

  const startOrResumeCheckout = useCallback(
    async (existingOrderId?: string) => {
      setIsLoadingSession(true);
      setSessionError(null);
      setSlowLoadNotice(false);
      setResumeUrl(null);
      latestPaymentIdRef.current = null;
      lastPaymentStateRef.current = null;
      resumeKnownRef.current = false;
      confirmedHandledRef.current = false;

      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(existingOrderId ? { orderId: existingOrderId } : {}),
            planId,
            billingCycle,
            integrationMode: "iframe",
          }),
        });

        const data = (await res.json().catch(() => null)) as
          | (CheckoutSessionClientPayload & { error?: { message?: string } })
          | null;

        if (!res.ok || !data) {
          throw new Error(
            data?.error?.message ||
              "Impossible d'initialiser le guichet de paiement intégré Moneriz."
          );
        }

        const validated = parseLiveframeSession(data);
        if (!validated) {
          throw new Error(
            "Le guichet de paiement intégré (Liveframe) n'a pas pu être ouvert pour ce domaine. Vérifiez la configuration Moneriz."
          );
        }

        setSession(data);
        setIframeHeight(560);
        setPaymentState("idle");
      } catch (err: unknown) {
        setSession(null);
        setSessionError(
          err instanceof Error
            ? err.message
            : "Erreur lors de la connexion au service de paiement Moneriz."
        );
      } finally {
        setIsLoadingSession(false);
      }
    },
    [billingCycle, planId]
  );

  useEffect(() => {
    startOrResumeCheckout();
  }, [startOrResumeCheckout]);

  const sendInitMessage = useCallback(() => {
    if (!parsedUrls) return;
    const iframeWin = iframeRef.current?.contentWindow;
    if (!iframeWin) return;
    iframeWin.postMessage(
      {
        source: "moneriz",
        version: 1,
        token: parsedUrls.token,
        type: "moneriz.init",
      },
      parsedUrls.embedOrigin
    );
  }, [parsedUrls]);

  // Contrat officiel Liveframe postMessage v1
  useEffect(() => {
    if (!session || !parsedUrls) return;

    let active = true;
    const slowTimer = window.setTimeout(() => {
      if (active) setSlowLoadNotice(true);
    }, 15000);

    const onMessage = async (event: MessageEvent) => {
      if (!active) return;
      const iframeWin = iframeRef.current?.contentWindow;
      if (!iframeWin) return;
      if (event.origin !== parsedUrls.embedOrigin || event.source !== iframeWin) return;

      const msg = event.data;
      if (!msg || typeof msg !== "object" || Array.isArray(msg)) return;

      const record = msg as Record<string, unknown>;
      // Ignorer strictement les anciens alias izipaye.* et tout autre émetteur
      if (
        record.source !== "moneriz" ||
        record.version !== 1 ||
        record.token !== parsedUrls.token ||
        typeof record.type !== "string"
      ) {
        return;
      }

      if (
        record.type !== "moneriz.ready" &&
        record.type !== "moneriz.resize" &&
        record.type !== "moneriz.resume" &&
        record.type !== "moneriz.payment"
      ) {
        return;
      }

      window.clearTimeout(slowTimer);
      setSlowLoadNotice(false);

      if (record.type === "moneriz.ready") {
        if (!hasExactKeys(record)) return;
        return;
      }

      if (record.type === "moneriz.resize") {
        if (
          !hasExactKeys(record, ["height"]) ||
          typeof record.height !== "number" ||
          !Number.isInteger(record.height) ||
          record.height < 320 ||
          record.height > 4000
        ) {
          return;
        }
        setIframeHeight(record.height);
        return;
      }

      if (record.type === "moneriz.resume") {
        if (!hasExactKeys(record, ["resumeUrl"]) || typeof record.resumeUrl !== "string") {
          return;
        }
        try {
          const resume = new URL(record.resumeUrl);
          const attempt = resume.searchParams.get("tentative") || "";
          if (
            resume.origin !== parsedUrls.checkoutOrigin ||
            resume.pathname !== parsedUrls.checkoutPathname ||
            resume.username ||
            resume.password ||
            resume.hash ||
            [...resume.searchParams.keys()].length !== 1 ||
            !UUID_REGEX.test(attempt)
          ) {
            return;
          }
          resumeKnownRef.current = true;
          setResumeUrl(resume.href);
        } catch {
          return;
        }
        return;
      }

      if (record.type === "moneriz.payment") {
        if (
          !hasExactKeys(record, ["paymentId", "checkoutSessionId", "status", "confirmation"]) ||
          !isValidOpaqueId(record.paymentId) ||
          !(record.checkoutSessionId === null || isValidOpaqueId(record.checkoutSessionId)) ||
          typeof record.status !== "string" ||
          !VALID_PAYMENT_STATUSES.has(record.status) ||
          typeof record.confirmation !== "string" ||
          !VALID_CONFIRMATIONS.has(record.confirmation)
        ) {
          return;
        }

        const stateSig = JSON.stringify([
          record.paymentId,
          record.checkoutSessionId,
          record.status,
          record.confirmation,
        ]);
        if (stateSig === lastPaymentStateRef.current) return;
        lastPaymentStateRef.current = stateSig;
        latestPaymentIdRef.current = record.paymentId;

        if (!resumeKnownRef.current) {
          setResumeUrl(null);
        }

        if (record.status === "paid" && record.confirmation === "confirmed") {
          // Ne jamais activer sur le seul postMessage client : vérification serveur obligatoire
          await verifyServerConfirmation(session.orderId, record.paymentId);
        } else if (record.status === "pending") {
          // Garder impérativement l'iframe montée (ex: QR affiché ou USSD Mobile Money en cours)
          setPaymentState("pending");
        } else if (record.status === "failed" || record.status === "reversed") {
          setPaymentState("failed");
        } else if (record.status === "expired") {
          setPaymentState("expired");
          await checkServerOrderOnce(session.orderId, record.paymentId);
        }
      }
    };

    window.addEventListener("message", onMessage);
    sendInitMessage();

    return () => {
      active = false;
      window.clearTimeout(slowTimer);
      window.removeEventListener("message", onMessage);
    };
  }, [session, parsedUrls, sendInitMessage, verifyServerConfirmation, checkServerOrderOnce]);

  // Suivi automatique en arrière-plan quand le paiement attend validation opérateur (Mobile Money)
  // ou validation dans un nouvel onglet (Wave / 3D Secure), et à la reprise du focus navigateur
  useEffect(() => {
    if (!session?.orderId || confirmedHandledRef.current) return;
    const needsTracking = paymentState === "pending" || Boolean(resumeUrl);
    if (!needsTracking) return;

    let cancelled = false;
    let ticks = 0;

    const pollNow = () => {
      if (cancelled || confirmedHandledRef.current || verifyingRef.current) return;
      ticks += 1;
      void checkServerOrderOnce(session.orderId, latestPaymentIdRef.current);
      if (ticks >= 60) {
        window.clearInterval(intervalId);
      }
    };

    const intervalId = window.setInterval(pollNow, 3000);
    const onFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        pollNow();
      }
    };

    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [session?.orderId, paymentState, resumeUrl, checkServerOrderOnce]);

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
            <ShieldCheck className="w-3.5 h-3.5" /> Paiement intégré Moneriz
          </p>
        </div>
      </div>

      {/* État de chargement initial */}
      {isLoadingSession && (
        <div className="flex flex-col items-center justify-center py-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F] dark:text-sky-400" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Ouverture du guichet de paiement dans MonBudget...
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-sm">
            Connexion sécurisée au terminal Liveframe Moneriz.
          </p>
        </div>
      )}

      {/* Erreur d'ouverture du guichet intégré */}
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
            {onCancel && (
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

      {/* Alerte de délai si l'iframe tarde à répondre */}
      {slowLoadNotice && !sessionError && paymentState !== "confirmed" && (
        <p
          role="status"
          className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-3.5 py-2.5"
        >
          Le module de paiement tarde à répondre. Patientez quelques secondes sans fermer cette fenêtre. Si vous avez déjà payé, attendez la confirmation avant de recommencer.
        </p>
      )}

      {/* Alerte de reprise externe (uniquement si moneriz.resume valide émis par l'iframe, ex. Wave ou 3DS) */}
      {resumeUrl && paymentState !== "confirmed" && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
            Une validation opérateur ou bancaire (Wave / 3D Secure) peut être finalisée dans un onglet dédié sans perdre votre session en cours.
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

      {/* Bannières d'état de paiement */}
      {paymentState === "verifying_server" && (
        <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-600 dark:text-sky-400 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-sky-950 dark:text-sky-200">
              Vérification de la confirmation serveur en cours...
            </p>
            <p className="text-sky-700 dark:text-sky-300">
              Dès réception, vous serez redirigé automatiquement vers votre tableau de bord.
            </p>
          </div>
        </div>
      )}

      {paymentState === "pending" && session && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-950 dark:text-amber-200">
                Paiement en attente de confirmation opérateur
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                Ne fermez pas cette fenêtre pendant la validation. La détection est automatique.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => verifyServerConfirmation(session.orderId, latestPaymentIdRef.current)}
            className="shrink-0 text-xs"
          >
            Vérifier maintenant
          </Button>
        </div>
      )}

      {paymentState === "failed" && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
          La tentative précédente n&apos;a pas abouti. Vous pouvez réessayer directement dans le guichet ci-dessous avec le même ou un autre moyen de paiement.
        </div>
      )}

      {paymentState === "expired" && session && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs">
          <span className="text-amber-900 dark:text-amber-200 font-medium">
            Cette tentative a expiré. Vérifiez le statut si vous avez déjà validé sur votre téléphone, ou ouvrez une nouvelle tentative.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => startOrResumeCheckout()}
            className="shrink-0 text-xs"
          >
            Nouvelle session
          </Button>
        </div>
      )}

      {paymentState === "confirmed" && (
        <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <p className="text-base font-extrabold text-emerald-950 dark:text-emerald-100">
            Votre formule {plan.name} est maintenant active !
          </p>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Toutes les fonctionnalités de votre formule sont débloquées. Ouverture du tableau de bord...
          </p>
          <Button
            type="button"
            onClick={goToDashboardNow}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-2"
          >
            <span>Accéder au tableau de bord</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Iframe Liveframe Moneriz intégrée */}
      {!isLoadingSession &&
        !sessionError &&
        parsedUrls &&
        paymentState !== "confirmed" && (
          <div className="w-full max-w-[640px] mx-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white">
            <iframe
              ref={iframeRef}
              src={parsedUrls.embedHref}
              title={`Paiement sécurisé Moneriz — ${plan.name}`}
              allow="payment *; clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              onLoad={sendInitMessage}
              style={{
                display: "block",
                width: "100%",
                border: 0,
                height: `${iframeHeight}px`,
                background: "transparent",
                colorScheme: "normal",
              }}
            />
          </div>
        )}
    </div>
  );
}
