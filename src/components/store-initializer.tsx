"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_ID_REGEX = /^[a-zA-Z0-9_-]{3,128}$/;

export function StoreInitializer() {
  const router = useRouter();
  const initStore = useUIStore((state) => state.initStore);
  const refreshSubscription = useUIStore((state) => state.refreshSubscription);
  const initialized = useRef(false);
  const checkoutHandled = useRef(false);
  const lastFocusRefreshRef = useRef(0);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initStore();
    }
  }, [initStore]);

  // Resynchronisation silencieuse au retour sur l'onglet (vérifie renouvellement ou expiration côté serveur)
  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefreshRef.current < 60_000) return;
      lastFocusRefreshRef.current = now;
      void refreshSubscription();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshSubscription]);

  useEffect(() => {
    if (checkoutHandled.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get("checkout");
    const rawOrderId = params.get("orderId");
    const rawPaymentId = params.get("payment_id") || params.get("paymentId");

    if (checkoutState === "cancel") {
      checkoutHandled.current = true;
      toast.info("Paiement annulé. Vous pouvez choisir votre formule à tout moment.");
      router.replace(
        window.location.pathname === "/settings"
          ? "/settings?tab=subscription"
          : "/dashboard"
      );
      return;
    }

    if (checkoutState !== "return" || !rawOrderId || !UUID_REGEX.test(rawOrderId)) {
      return;
    }

    checkoutHandled.current = true;
    const validPaymentId =
      rawPaymentId && PAYMENT_ID_REGEX.test(rawPaymentId) ? rawPaymentId : null;

    let cancelled = false;
    let settled = false;

    const verifyReturnOrder = async () => {
      for (let i = 0; i < 8; i++) {
        if (cancelled) return;
        const res = await refreshSubscription(rawOrderId, validPaymentId);
        if (res.orderStatus === "paid") {
          settled = true;
          if (cancelled) return;
          toast.success("Paiement confirmé par le serveur ! Votre abonnement est actif.");
          router.replace("/dashboard");
          router.refresh();
          return;
        }
        if (i < 7) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      settled = true;
      if (!cancelled) {
        toast.info(
          "Paiement en cours de confirmation serveur. Votre accès sera mis à jour automatiquement."
        );
        if (window.location.pathname === "/dashboard") {
          router.replace("/dashboard");
        }
      }
    };

    void verifyReturnOrder();

    return () => {
      cancelled = true;
      if (!settled) {
        checkoutHandled.current = false;
      }
    };
  }, [refreshSubscription, router]);

  return null;
}
