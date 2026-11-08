import { test, expect } from "@playwright/test";
import {
  canAccessFeature,
  getRequiredPlanForFeature,
  getServerPlanAmountXof,
  MONBUDGET_PLANS,
} from "../src/lib/moneriz-plans";
import {
  buildMonerizSignatureHeader,
  verifyMonerizSignature,
} from "../src/lib/server/moneriz-signature";
import {
  commitMonerizInbox,
  getOrderAndSubscriptionStatus,
  parseMonerizEvent,
  prepareAuthorizedCheckout,
} from "../src/lib/server/moneriz-app";

test.describe("Intégration Moneriz SaaS — Tarifs, Sécurité HMAC & Machine d'États", () => {
  test("1. Grille tarifaire officielle (Gratuit, Particulier 1 000 FCFA, Entreprise 2 500 FCFA + -2 mois annuel)", () => {
    // Plan Gratuit
    expect(MONBUDGET_PLANS.free.monthlyPriceXof).toBe(0);
    expect(MONBUDGET_PLANS.free.yearlyPriceXof).toBe(0);

    // Plan Particulier : 1 000 XOF/mois et 10 000 XOF/an (2 mois offerts)
    const personalMonthly = getServerPlanAmountXof("personal", "monthly");
    expect(personalMonthly.amount).toBe(1000);
    expect(personalMonthly.currency).toBe("XOF");

    const personalYearly = getServerPlanAmountXof("personal", "yearly");
    expect(personalYearly.amount).toBe(10000);
    expect(personalYearly.currency).toBe("XOF");
    expect(MONBUDGET_PLANS.personal.yearlySavingsXof).toBe(2000);

    // Plan Entreprise : 2 500 XOF/mois et 25 000 XOF/an (2 mois offerts)
    const businessMonthly = getServerPlanAmountXof("business", "monthly");
    expect(businessMonthly.amount).toBe(2500);
    expect(businessMonthly.currency).toBe("XOF");

    const businessYearly = getServerPlanAmountXof("business", "yearly");
    expect(businessYearly.amount).toBe(25000);
    expect(businessYearly.currency).toBe("XOF");
    expect(MONBUDGET_PLANS.business.yearlySavingsXof).toBe(5000);
  });

  test("2. Restrictions par plan : Gratuit limité aux Entrées/Dépenses (sans Budget ni Épargne ni le reste)", () => {
    // Plan Gratuit : aucun accès à budget, savings, debts, reports, advisor
    expect(canAccessFeature("free", "budget")).toBe(false);
    expect(canAccessFeature("free", "savings")).toBe(false);
    expect(canAccessFeature("free", "debts")).toBe(false);
    expect(canAccessFeature("free", "reports")).toBe(false);
    expect(canAccessFeature("free", "advisor")).toBe(false);

    // Plan Particulier : débloque budget, savings, debts ; verrouille reports et advisor
    expect(canAccessFeature("personal", "budget")).toBe(true);
    expect(canAccessFeature("personal", "savings")).toBe(true);
    expect(canAccessFeature("personal", "debts")).toBe(true);
    expect(canAccessFeature("personal", "reports")).toBe(false);
    expect(canAccessFeature("personal", "advisor")).toBe(false);

    // Plan Entreprise : débloque 100% des fonctionnalités
    expect(canAccessFeature("business", "budget")).toBe(true);
    expect(canAccessFeature("business", "savings")).toBe(true);
    expect(canAccessFeature("business", "debts")).toBe(true);
    expect(canAccessFeature("business", "reports")).toBe(true);
    expect(canAccessFeature("business", "advisor")).toBe(true);

    expect(getRequiredPlanForFeature("budget")).toBe("personal");
    expect(getRequiredPlanForFeature("advisor")).toBe("business");
  });

  test("3. Vérification cryptographique HMAC-SHA256 de X-Moneriz-Signature et fenêtre anti-rejeu de 5 minutes", () => {
    const secret = "whsec_test_moneriz_secret_key_2026";
    const now = 1794055000000;
    const rawBody = JSON.stringify({
      id: "evt_01JTEST123456",
      type: "payment.succeeded",
      mode: "test",
      occurredAt: "2026-11-08T10:00:00.000Z",
      payment: {
        id: "pay_01JTEST123456",
        mode: "test",
        status: "paid",
        amount: 1000,
        currency: "XOF",
        reference: "MB-TEST-PER-123456",
        paidAt: "2026-11-08T10:00:00.000Z",
      },
    });

    const validHeader = buildMonerizSignatureHeader(rawBody, secret, now);
    expect(verifyMonerizSignature(rawBody, validHeader, secret, now)).toBe(true);

    // Rejet si le corps brut a été modifié d'un seul espace
    expect(verifyMonerizSignature(rawBody + " ", validHeader, secret, now)).toBe(false);

    // Rejet si l'horodatage dépasse la tolérance de 5 minutes (300 001 ms)
    expect(verifyMonerizSignature(rawBody, validHeader, secret, now + 5 * 60 * 1000 + 1000)).toBe(
      false
    );

    // Rejet si mauvais secret
    expect(verifyMonerizSignature(rawBody, validHeader, "wrong_secret", now)).toBe(false);
  });

  test("4. Protection des commandes (FORBIDDEN_ORDER), Idempotence, Déduplication Webhook & Cycle de vie complet", async () => {
    const userA = "user-alpha-111";
    const userB = "user-bravo-222";

    // User A prépare une commande Particulier Annuel (10 000 XOF)
    const { order } = await prepareAuthorizedCheckout({
      userId: userA,
      planId: "personal",
      billingCycle: "yearly",
      requestOrigin: "https://monbudget-sable.vercel.app",
    });

    expect(order.amount).toBe(10000);
    expect(order.currency).toBe("XOF");
    expect(order.status).toBe("pending");
    expect(order.idempotencyKey).toContain(`checkout-${order.id}`);
    expect(order.requestSnapshot.integrationMode).toBe("iframe");
    expect(order.requestSnapshot.embedOrigin).toBe("https://monbudget-sable.vercel.app");

    // User B tente d'accéder à la commande de User A -> FORBIDDEN_ORDER
    await expect(
      prepareAuthorizedCheckout({
        userId: userB,
        orderId: order.id,
      })
    ).rejects.toThrow("FORBIDDEN_ORDER");

    // Avant le webhook, l'abonnement de User A est toujours 'free'
    const beforeWebhook = await getOrderAndSubscriptionStatus({
      userId: userA,
      orderId: order.id,
    });
    expect(beforeWebhook.subscription.planId).toBe("free");

    // Réception du webhook signé payment.succeeded
    const rawEvent = JSON.stringify({
      id: `evt_success_${order.id}`,
      type: "payment.succeeded",
      mode: order.mode,
      occurredAt: new Date().toISOString(),
      payment: {
        id: `pay_${order.id}`,
        mode: order.mode,
        status: "paid",
        amount: 10000,
        currency: "XOF",
        reference: order.reference,
        paidAt: new Date().toISOString(),
      },
    });

    const parsedEvent = parseMonerizEvent(rawEvent);
    const firstCommit = await commitMonerizInbox(parsedEvent);
    expect(firstCommit.duplicate).toBe(false);
    expect(firstCommit.orderStatus).toBe("paid");
    expect(firstCommit.planId).toBe("personal");

    // Vérification de l'activation côté serveur
    const afterWebhook = await getOrderAndSubscriptionStatus({
      userId: userA,
      orderId: order.id,
    });
    expect(afterWebhook.order?.status).toBe("paid");
    expect(afterWebhook.subscription.planId).toBe("personal");
    expect(afterWebhook.subscription.billingCycle).toBe("yearly");

    // Livraison en doublon du même event.id -> ignoré proprement (idempotent)
    const duplicateCommit = await commitMonerizInbox(parsedEvent);
    expect(duplicateCommit.duplicate).toBe(true);

    // Webhook hors-séquence (ex: payment.failed tardif d'une ancienne tentative) -> ne rétrograde jamais une commande paid
    const lateFailedEvent = parseMonerizEvent(
      JSON.stringify({
        id: `evt_late_fail_${order.id}`,
        type: "payment.failed",
        mode: order.mode,
        occurredAt: new Date().toISOString(),
        payment: {
          id: `pay_old_${order.id}`,
          mode: order.mode,
          status: "failed",
          amount: 10000,
          currency: "XOF",
          reference: order.reference,
          paidAt: null,
        },
      })
    );
    const lateCommit = await commitMonerizInbox(lateFailedEvent);
    expect(lateCommit.orderStatus).toBe("paid");

    // Rejet en cas d'écart de montant (AMOUNT_OR_CURRENCY_MISMATCH)
    const mismatchedAmountEvent = parseMonerizEvent(
      JSON.stringify({
        id: `evt_bad_amt_${order.id}`,
        type: "payment.succeeded",
        mode: order.mode,
        occurredAt: new Date().toISOString(),
        payment: {
          id: `pay_bad_${order.id}`,
          mode: order.mode,
          status: "paid",
          amount: 500, // Ne correspond pas à 10 000 XOF
          currency: "XOF",
          reference: order.reference,
          paidAt: new Date().toISOString(),
        },
      })
    );
    await expect(commitMonerizInbox(mismatchedAmountEvent)).rejects.toThrow(
      "AMOUNT_OR_CURRENCY_MISMATCH"
    );
  });
});

