import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  canAccessFeature,
  getPlanCatalog,
  getRequiredPlanForFeature,
  getServerPlanAmountXof,
  getSubscriptionCountdownInfo,
  MONBUDGET_PLANS,
} from "../src/lib/moneriz-plans";
import {
  buildMonerizSignatureHeader,
  verifyMonerizSignature,
} from "../src/lib/server/moneriz-signature";
import {
  chooseFreePlanForUser,
  commitMonerizInbox,
  getOrderAndSubscriptionStatus,
  parseMonerizEvent,
  prepareAuthorizedCheckout,
  resolveEffectiveSubscription,
  setFallbackSubscriptionForTests,
} from "../src/lib/server/moneriz-app";
import {
  listUserNotifications,
  sendPostPaymentConfirmationOnce,
} from "../src/lib/server/notifications";
import {
  createMonerizCheckoutSession,
  MonerizApiError,
} from "../src/lib/server/moneriz-checkout";

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

    // Plan Entreprise : 2 500 XOF/mois et 25 000 XOF/an (2 mois offerts) par défaut
    const businessMonthly = getServerPlanAmountXof("business", "monthly");
    expect(businessMonthly.amount).toBe(2500);
    expect(businessMonthly.currency).toBe("XOF");

    const businessYearly = getServerPlanAmountXof("business", "yearly");
    expect(businessYearly.amount).toBe(25000);
    expect(businessYearly.currency).toBe("XOF");
    expect(MONBUDGET_PLANS.business.yearlySavingsXof).toBe(5000);

    // Tarif Entreprise rehaussable dynamiquement via variable d'environnement sans casser le code
    const prevPublicBiz = process.env.NEXT_PUBLIC_BUSINESS_MONTHLY_PRICE_XOF;
    const prevServerBiz = process.env.BUSINESS_MONTHLY_PRICE_XOF;
    try {
      delete process.env.NEXT_PUBLIC_BUSINESS_MONTHLY_PRICE_XOF;
      process.env.BUSINESS_MONTHLY_PRICE_XOF = "3500";
      const dynamicCatalog = getPlanCatalog();
      expect(dynamicCatalog.business.monthlyPriceXof).toBe(3500);
      expect(dynamicCatalog.business.yearlyPriceXof).toBe(35000);
      expect(dynamicCatalog.business.yearlySavingsXof).toBe(7000);
      expect(getServerPlanAmountXof("business", "yearly").amount).toBe(35000);
    } finally {
      if (prevPublicBiz === undefined) delete process.env.NEXT_PUBLIC_BUSINESS_MONTHLY_PRICE_XOF;
      else process.env.NEXT_PUBLIC_BUSINESS_MONTHLY_PRICE_XOF = prevPublicBiz;
      if (prevServerBiz === undefined) delete process.env.BUSINESS_MONTHLY_PRICE_XOF;
      else process.env.BUSINESS_MONTHLY_PRICE_XOF = prevServerBiz;
    }
  });

  test("2. Restrictions par plan : Gratuit cadenassé (Entrées/Dépenses), Particulier 1 000 F débloque tout l'existant, Entreprise Option B", () => {
    // Plan Gratuit : aucun accès à budget, savings, debts, reports, advisor, receipts
    expect(canAccessFeature("free", "budget")).toBe(false);
    expect(canAccessFeature("free", "savings")).toBe(false);
    expect(canAccessFeature("free", "debts")).toBe(false);
    expect(canAccessFeature("free", "reports")).toBe(false);
    expect(canAccessFeature("free", "advisor")).toBe(false);
    expect(canAccessFeature("free", "receipts")).toBe(false);

    // Plan Particulier (1 000 FCFA/mois) : débloque 100 % des fonctionnalités actuelles
    expect(canAccessFeature("personal", "budget")).toBe(true);
    expect(canAccessFeature("personal", "savings")).toBe(true);
    expect(canAccessFeature("personal", "debts")).toBe(true);
    expect(canAccessFeature("personal", "reports")).toBe(true);
    expect(canAccessFeature("personal", "advisor")).toBe(true);
    expect(canAccessFeature("personal", "receipts")).toBe(true);

    // Plan Entreprise : débloque aussi toutes les fonctionnalités actuelles + avantages Option B
    expect(canAccessFeature("business", "budget")).toBe(true);
    expect(canAccessFeature("business", "savings")).toBe(true);
    expect(canAccessFeature("business", "debts")).toBe(true);
    expect(canAccessFeature("business", "reports")).toBe(true);
    expect(canAccessFeature("business", "advisor")).toBe(true);
    expect(canAccessFeature("business", "receipts")).toBe(true);

    expect(getRequiredPlanForFeature("budget")).toBe("personal");
    expect(getRequiredPlanForFeature("savings")).toBe("personal");
    expect(getRequiredPlanForFeature("debts")).toBe("personal");
    expect(getRequiredPlanForFeature("reports")).toBe("personal");
    expect(getRequiredPlanForFeature("advisor")).toBe("personal");
    expect(getRequiredPlanForFeature("receipts")).toBe("personal");
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

    // Notification post-paiement envoyée une seule fois (idempotente)
    const firstNotif = await sendPostPaymentConfirmationOnce({ orderId: order.id });
    expect(firstNotif.sent).toBe(true);
    const secondNotif = await sendPostPaymentConfirmationOnce({ orderId: order.id });
    expect(secondNotif.sent).toBe(false);
    const userANotifs = await listUserNotifications(userA);
    expect(userANotifs.notifications.some((n) => n.type === "payment_success")).toBe(true);

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

  test("5. Durcissement sécurité Étape 1 : refus du fallback RAM/anon en production et verrouillage SQL RPC/RLS", async () => {
    const monerizAppSource = fs.readFileSync(
      path.join(process.cwd(), "src/lib/server/moneriz-app.ts"),
      "utf8"
    );
    // getAdminSupabase ne doit jamais retomber sur la clé publique anon
    const adminFnMatch = monerizAppSource.match(/function getAdminSupabase\(\)[\s\S]*?\n\}/);
    expect(adminFnMatch?.[0]).toBeTruthy();
    expect(adminFnMatch?.[0]).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    // En production sans SUPABASE_SERVICE_ROLE_KEY, aucun fallback RAM toléré
    const env = process.env as Record<string, string | undefined>;
    const prevNodeEnv = env.NODE_ENV;
    const prevServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    env.NODE_ENV = "production";
    delete env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      await expect(
        prepareAuthorizedCheckout({
          userId: "user-prod-guard",
          planId: "personal",
          billingCycle: "monthly",
        })
      ).rejects.toThrow("MISSING_SERVICE_ROLE_KEY");

      const prodEvent = parseMonerizEvent(
        JSON.stringify({
          id: "evt_prod_guard_1",
          type: "payment.succeeded",
          mode: "test",
          occurredAt: new Date().toISOString(),
          payment: {
            id: "pay_prod_guard_1",
            mode: "test",
            status: "paid",
            amount: 1000,
            currency: "XOF",
            reference: "MB-TEST-PER-PRODGUARD",
            paidAt: new Date().toISOString(),
          },
        })
      );

      await expect(commitMonerizInbox(prodEvent)).rejects.toThrow(
        "MISSING_SERVICE_ROLE_KEY"
      );
    } finally {
      if (prevNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = prevNodeEnv;
      if (prevServiceKey === undefined) delete env.SUPABASE_SERVICE_ROLE_KEY;
      else env.SUPABASE_SERVICE_ROLE_KEY = prevServiceKey;
    }

    // La migration SQL de durcissement doit révoquer EXECUTE public/anon/authenticated sur process_moneriz_webhook_event
    const hardeningSql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261110_security_hardening_moneriz.sql"),
      "utf8"
    );
    expect(hardeningSql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(hardeningSql).toContain('DROP POLICY IF EXISTS "Users can update their own pending orders"');
    expect(hardeningSql).toContain("FROM PUBLIC, anon, authenticated");
    expect(hardeningSql).toContain("TO service_role");
    expect(hardeningSql).toContain("FORBIDDEN_SERVICE_ROLE_REQUIRED");
  });

  test("6. Mode Liveframe strict : sans repli redirect, séparation commandes redirect/iframe, origines autorisées & successUrl /dashboard", async () => {
    const env = process.env as Record<string, string | undefined>;
    const prevEmbedOrigin = env.MONERIZ_EMBED_ORIGIN;
    const prevSecret = env.MONERIZ_SECRET_KEY;
    env.MONERIZ_EMBED_ORIGIN = "https://monbudgetpro.com";
    env.MONERIZ_SECRET_KEY = "izp_test_sk_dummy_for_unit_test";

    const originalFetch = globalThis.fetch;

    try {
      const userLiveframe = `user-liveframe-${Date.now()}`;

      // 6a. Création préalable en mode redirect puis passage à iframe -> crée une nouvelle commande sans réutiliser redirect
      const redirectAttempt = await prepareAuthorizedCheckout({
        userId: userLiveframe,
        planId: "personal",
        billingCycle: "monthly",
        requestOrigin: "https://monbudgetpro.com",
        preferredMode: "redirect",
      });
      expect(redirectAttempt.order.requestSnapshot.integrationMode).toBe("redirect");

      const iframeAttempt = await prepareAuthorizedCheckout({
        userId: userLiveframe,
        planId: "personal",
        billingCycle: "monthly",
        requestOrigin: "https://www.monbudgetpro.com",
        preferredMode: "iframe",
      });
      expect(iframeAttempt.order.id).not.toBe(redirectAttempt.order.id);
      expect(iframeAttempt.order.reference).not.toBe(redirectAttempt.order.reference);
      expect(iframeAttempt.order.requestSnapshot.integrationMode).toBe("iframe");
      expect(iframeAttempt.order.requestSnapshot.embedOrigin).toBe("https://www.monbudgetpro.com");
      expect(iframeAttempt.order.requestSnapshot.successUrl).toContain("/dashboard?orderId=");

      // 6b. Une origine non autorisée (spoofing Origin) est ignorée au profit de MONERIZ_EMBED_ORIGIN
      const spoofAttempt = await prepareAuthorizedCheckout({
        userId: `user-spoof-${Date.now()}`,
        planId: "business",
        billingCycle: "monthly",
        requestOrigin: "https://attacker.example.com",
        preferredMode: "iframe",
      });
      expect(spoofAttempt.order.requestSnapshot.embedOrigin).toBe("https://monbudgetpro.com");

      // 6c. Si Moneriz rejette embedOrigin (EMBED_ORIGIN_NOT_ALLOWED), aucun repli silencieux vers redirect
      let fetchCalls = 0;
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return new Response(
          JSON.stringify({
            error: {
              code: "EMBED_ORIGIN_NOT_ALLOWED",
              message: "Origin not allowed",
              requestId: "req_test_embed_denied",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }) as typeof fetch;

      await expect(
        createMonerizCheckoutSession(iframeAttempt.order)
      ).rejects.toMatchObject({
        name: "MonerizApiError",
        code: "EMBED_ORIGIN_NOT_ALLOWED",
        status: 400,
      } satisfies Partial<MonerizApiError>);
      expect(fetchCalls).toBe(1);

      // 6d. Session iframe valide conservée intacte
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            id: "cs_test_liveframe_ok",
            mode: "test",
            status: "open",
            integrationMode: "iframe",
            checkoutUrl: "https://moneriz.com/payer/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE",
            embedUrl: "https://moneriz.com/integrer/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE",
            amount: iframeAttempt.order.amount,
            currency: "XOF",
            title: iframeAttempt.order.title,
            reference: iframeAttempt.order.reference,
            expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }) as typeof fetch;

      const created = await createMonerizCheckoutSession(iframeAttempt.order);
      expect(created.usedFallbackRedirect).toBe(false);
      expect(created.session.integrationMode).toBe("iframe");
      expect(created.session.embedUrl).toContain("/integrer/");
    } finally {
      globalThis.fetch = originalFetch;
      if (prevEmbedOrigin === undefined) delete env.MONERIZ_EMBED_ORIGIN;
      else env.MONERIZ_EMBED_ORIGIN = prevEmbedOrigin;
      if (prevSecret === undefined) delete env.MONERIZ_SECRET_KEY;
      else env.MONERIZ_SECRET_KEY = prevSecret;
    }
  });

  test("7. Contrat UI Liveframe v1 & redirection immédiate vers /dashboard après paiement confirmé", () => {
    const liveframeSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/payments/moneriz-liveframe.tsx"),
      "utf8"
    );
    const widgetSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/payments/subscription-plans-widget.tsx"),
      "utf8"
    );
    const initializerSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/store-initializer.tsx"),
      "utf8"
    );

    // Liveframe ne redirige jamais silencieusement hors de l'application
    expect(liveframeSrc).not.toContain("window.location.assign");
    expect(liveframeSrc).toContain('record.source !== "moneriz"');
    expect(liveframeSrc).toContain('type: "moneriz.init"');
    expect(liveframeSrc).toContain("record.resumeUrl");
    expect(liveframeSrc).toContain("allow-popups-to-escape-sandbox");
    expect(liveframeSrc).toContain('referrerPolicy="no-referrer"');
    expect(liveframeSrc).toContain('router.push("/dashboard")');

    // Widget & retour dashboard
    expect(widgetSrc).toContain('router.push("/dashboard")');
    expect(initializerSrc).toContain('refreshSubscription(rawOrderId, validPaymentId)');
    expect(initializerSrc).toContain('router.replace("/dashboard")');
  });

  test("8. Révocation serveur automatique à l'échéance, exemption Super-Admin & réactivation au renouvellement", async () => {
    const expiredUserId = `user-expired-${Date.now()}`;
    const activeUserId = `user-active-${Date.now()}`;
    const canceledUserId = `user-canceled-${Date.now()}`;
    const adminUserId = `admin-user-${Date.now()}`;

    const pastIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const futureIso = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

    // 8a. Utilisateur standard expiré (currentPeriodEnd dépassé mais status encore 'active')
    setFallbackSubscriptionForTests({
      userId: expiredUserId,
      planId: "personal",
      billingCycle: "monthly",
      status: "active",
      currentPeriodEnd: pastIso,
      lastOrderId: null,
    });

    const expiredStatus = await getOrderAndSubscriptionStatus({
      userId: expiredUserId,
      userEmail: "client.expire@example.com",
    });
    expect(expiredStatus.subscription.planId).toBe("free");
    expect(expiredStatus.subscription.billingCycle).toBe("none");
    expect(expiredStatus.subscription.status).toBe("expired");
    expect(expiredStatus.subscription.currentPeriodEnd).toBe(pastIso);
    expect(expiredStatus.isAdmin).toBe(false);

    // 8b. Utilisateur standard avec abonnement actif non expiré -> reste actif
    setFallbackSubscriptionForTests({
      userId: activeUserId,
      planId: "business",
      billingCycle: "monthly",
      status: "active",
      currentPeriodEnd: futureIso,
      lastOrderId: null,
    });
    const activeStatus = await getOrderAndSubscriptionStatus({
      userId: activeUserId,
      userEmail: "client.actif@example.com",
    });
    expect(activeStatus.subscription.planId).toBe("business");
    expect(activeStatus.subscription.status).toBe("active");

    // 8c. Utilisateur avec statut 'canceled' même avant fin de période -> rétrogradé immédiatement
    setFallbackSubscriptionForTests({
      userId: canceledUserId,
      planId: "personal",
      billingCycle: "yearly",
      status: "canceled",
      currentPeriodEnd: futureIso,
      lastOrderId: null,
    });
    const canceledStatus = await getOrderAndSubscriptionStatus({
      userId: canceledUserId,
      userEmail: "client.annule@example.com",
    });
    expect(canceledStatus.subscription.planId).toBe("free");
    expect(canceledStatus.subscription.status).toBe("canceled");

    // 8d. Super-Admin conservé actif même sans expiration future
    setFallbackSubscriptionForTests({
      userId: adminUserId,
      planId: "personal",
      billingCycle: "monthly",
      status: "active",
      currentPeriodEnd: pastIso,
      lastOrderId: null,
    });
    const adminStatus = await getOrderAndSubscriptionStatus({
      userId: adminUserId,
      userEmail: "degladux@gmail.com",
    });
    expect(adminStatus.isAdmin).toBe(true);
    expect(adminStatus.subscription.planId).toBe("business");
    expect(adminStatus.subscription.status).toBe("active");

    // 8e. Réactivation après expiration via un nouveau paiement Moneriz confirmé
    const renewalOrder = await prepareAuthorizedCheckout({
      userId: expiredUserId,
      planId: "business",
      billingCycle: "monthly",
      requestOrigin: "https://monbudgetpro.com",
      preferredMode: "iframe",
    });
    const renewEvent = parseMonerizEvent(
      JSON.stringify({
        id: `evt_renew_${renewalOrder.order.id}`,
        type: "payment.succeeded",
        mode: renewalOrder.order.mode,
        occurredAt: new Date().toISOString(),
        payment: {
          id: `pay_renew_${renewalOrder.order.id}`,
          mode: renewalOrder.order.mode,
          status: "paid",
          amount: renewalOrder.order.amount,
          currency: "XOF",
          reference: renewalOrder.order.reference,
          paidAt: new Date().toISOString(),
        },
      })
    );
    await commitMonerizInbox(renewEvent);

    const renewedStatus = await getOrderAndSubscriptionStatus({
      userId: expiredUserId,
      userEmail: "client.expire@example.com",
      orderId: renewalOrder.order.id,
    });
    expect(renewedStatus.subscription.planId).toBe("business");
    expect(renewedStatus.subscription.status).toBe("active");
    expect(Date.parse(renewedStatus.subscription.currentPeriodEnd!)).toBeGreaterThan(Date.now());

    // 8f. Vérification directe de resolveEffectiveSubscription sur échéance exacte
    const boundary = resolveEffectiveSubscription({
      subscription: {
        userId: "usr-boundary",
        planId: "business",
        billingCycle: "monthly",
        status: "active",
        currentPeriodEnd: "2026-12-09T12:00:00.000Z",
        lastOrderId: null,
      },
      isSuperAdmin: false,
      nowMs: Date.parse("2026-12-09T12:00:00.000Z"),
    });
    expect(boundary.effective.planId).toBe("free");
    expect(boundary.effective.status).toBe("expired");
    expect(boundary.shouldPersistDowngrade).toBe(true);
  });

  test("9. Essai 30 jours complet, relance J-3, bascule Gratuit cadenassé à J0, décompte payant & exemption Super-Admin", async () => {
    const fixedNow = Date.parse("2026-12-01T12:00:00.000Z");

    // Les reçus/justificatifs sont débloqués dès le plan Particulier (1 000 FCFA)
    expect(canAccessFeature("free", "receipts")).toBe(false);
    expect(canAccessFeature("personal", "receipts")).toBe(true);
    expect(canAccessFeature("business", "receipts")).toBe(true);
    expect(getRequiredPlanForFeature("receipts")).toBe("personal");

    // 9a. Compte gratuit classique (sans essai actif)
    const freeNew = getSubscriptionCountdownInfo({
      planId: "free",
      status: "active",
      expiresAt: null,
      now: fixedNow,
    });
    expect(freeNew.effectivePlanId).toBe("free");
    expect(freeNew.isTrialActive).toBe(false);
    expect(freeNew.needsPlanChoice).toBe(false);
    expect(freeNew.isPaidActive).toBe(false);
    expect(freeNew.isExpired).toBe(false);
    expect(freeNew.daysRemaining).toBeNull();

    // 9b. Nouvel inscrit en essai complet 30 jours (J-29) -> effectivePlanId = "personal"
    const trialDay1 = getSubscriptionCountdownInfo({
      planId: "free",
      status: "active",
      trialEndsAt: new Date(fixedNow + 29 * 86_400_000).toISOString(),
      trialChoiceMadeAt: null,
      now: fixedNow,
    });
    expect(trialDay1.isTrialActive).toBe(true);
    expect(trialDay1.isTrialExpiringSoon).toBe(false);
    expect(trialDay1.needsPlanChoice).toBe(false);
    expect(trialDay1.trialDaysRemaining).toBe(29);
    expect(trialDay1.effectivePlanId).toBe("personal");

    // 9c. Essai à J-3 -> isTrialExpiringSoon = true + accès complet maintenu jusqu'à J0
    const trialJ3 = getSubscriptionCountdownInfo({
      planId: "free",
      status: "active",
      trialEndsAt: new Date(fixedNow + 3 * 86_400_000).toISOString(),
      trialChoiceMadeAt: null,
      now: fixedNow,
    });
    expect(trialJ3.isTrialActive).toBe(true);
    expect(trialJ3.isTrialExpiringSoon).toBe(true);
    expect(trialJ3.trialDaysRemaining).toBe(3);
    expect(trialJ3.effectivePlanId).toBe("personal");

    // 9d. Essai expiré sans choix enregistré -> needsPlanChoice = true + cadenassage ('free')
    const trialExpired = getSubscriptionCountdownInfo({
      planId: "free",
      status: "active",
      trialEndsAt: new Date(fixedNow - 3_600_000).toISOString(),
      trialChoiceMadeAt: null,
      now: fixedNow,
    });
    expect(trialExpired.isTrialActive).toBe(false);
    expect(trialExpired.isTrialExpired).toBe(true);
    expect(trialExpired.needsPlanChoice).toBe(true);
    expect(trialExpired.trialDaysRemaining).toBe(0);
    expect(trialExpired.effectivePlanId).toBe("free");

    // 9e. Choix explicite du mode Gratuit limité via chooseFreePlanForUser -> ferme needsPlanChoice
    const trialUserId = `user-trial-choice-${Date.now()}`;
    setFallbackSubscriptionForTests({
      userId: trialUserId,
      planId: "free",
      billingCycle: "none",
      status: "active",
      currentPeriodEnd: null,
      lastOrderId: null,
      trialStartedAt: new Date(fixedNow - 31 * 86_400_000).toISOString(),
      trialEndsAt: new Date(fixedNow - 3_600_000).toISOString(),
      trialChoiceMadeAt: null,
    });
    const chosenFree = await chooseFreePlanForUser({
      userId: trialUserId,
      userEmail: "essai.fini@example.com",
    });
    const afterChoice = getSubscriptionCountdownInfo({
      planId: chosenFree.planId,
      status: chosenFree.status,
      expiresAt: chosenFree.currentPeriodEnd,
      trialEndsAt: chosenFree.trialEndsAt,
      trialChoiceMadeAt: chosenFree.trialChoiceMadeAt,
      now: fixedNow,
    });
    expect(afterChoice.isTrialActive).toBe(false);
    expect(afterChoice.needsPlanChoice).toBe(false);
    expect(afterChoice.effectivePlanId).toBe("free");

    // 9f. Abonnement Particulier actif avec 10 jours restants
    const active10Days = getSubscriptionCountdownInfo({
      planId: "personal",
      status: "active",
      expiresAt: "2026-12-11T12:00:00.000Z",
      now: fixedNow,
    });
    expect(active10Days.effectivePlanId).toBe("personal");
    expect(active10Days.isPaidActive).toBe(true);
    expect(active10Days.isExpiringSoon).toBe(false);
    expect(active10Days.daysRemaining).toBe(10);
    expect(active10Days.formattedExpiresAt).toBe("11/12/2026");

    // 9g. Abonnement Entreprise à J-4 (alerte renouvellement <= 5 jours)
    const active4Days = getSubscriptionCountdownInfo({
      planId: "business",
      status: "active",
      expiresAt: "2026-12-05T12:00:00.000Z",
      now: fixedNow,
    });
    expect(active4Days.effectivePlanId).toBe("business");
    expect(active4Days.isPaidActive).toBe(true);
    expect(active4Days.isExpiringSoon).toBe(true);
    expect(active4Days.daysRemaining).toBe(4);

    // 9h. Abonnement client expiré depuis 1 seconde -> rétrogradé vers free
    const expiredClient = getSubscriptionCountdownInfo({
      planId: "business",
      status: "active",
      expiresAt: "2026-12-01T11:59:59.000Z",
      now: fixedNow,
    });
    expect(expiredClient.effectivePlanId).toBe("free");
    expect(expiredClient.isPaidActive).toBe(false);
    expect(expiredClient.isExpired).toBe(true);
    expect(expiredClient.daysRemaining).toBe(0);

    // 9i. Super-Admin exempt même avec essai expiré / statut expiré
    const superAdmin = getSubscriptionCountdownInfo({
      planId: "free",
      status: "expired",
      expiresAt: "2020-01-01T00:00:00.000Z",
      trialEndsAt: "2020-01-01T00:00:00.000Z",
      isAdmin: true,
      now: fixedNow,
    });
    expect(superAdmin.effectivePlanId).toBe("business");
    expect(superAdmin.isPaidActive).toBe(true);
    expect(superAdmin.isTrialActive).toBe(false);
    expect(superAdmin.needsPlanChoice).toBe(false);
    expect(superAdmin.isExpired).toBe(false);
    expect(superAdmin.daysRemaining).toBeNull();
  });

  test("10. Contrats API fail-closed (/api/receipts/upload, /api/notifications, /api/subscription/choose-free, /api/cron/daily-check) & UI", async ({
    request,
  }) => {
    // 10a. Endpoints authentifiés anonymes refusés (401)
    const [anonUpload, anonNotifGet, anonNotifPatch, anonChooseFree] = await Promise.all([
      request.post("/api/receipts/upload"),
      request.get("/api/notifications"),
      request.patch("/api/notifications", { data: { markAll: true } }),
      request.post("/api/subscription/choose-free"),
    ]);
    expect(anonUpload.status()).toBe(401);
    expect(anonNotifGet.status()).toBe(401);
    expect(anonNotifPatch.status()).toBe(401);
    expect(anonChooseFree.status()).toBe(401);

    // 10b. Contrats statiques serveur (receipts plan gating, notifications & cron lifecycle)
    const uploadRouteSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/receipts/upload/route.ts"),
      "utf8"
    );
    expect(uploadRouteSrc).toContain("getOrderAndSubscriptionStatus");
    expect(uploadRouteSrc).toContain('canAccessFeature(countdown.effectivePlanId, "receipts")');
    expect(uploadRouteSrc).toContain('code: "PLAN_REQUIRED"');
    expect(uploadRouteSrc).toContain("403");

    const cronRouteSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/cron/daily-check/route.ts"),
      "utf8"
    );
    expect(cronRouteSrc).toContain("runDailySubscriptionLifecycleCron");

    const notificationsServerSrc = fs.readFileSync(
      path.join(process.cwd(), "src/lib/server/notifications.ts"),
      "utf8"
    );
    expect(notificationsServerSrc).toContain('status: "expired"');
    expect(notificationsServerSrc).toContain("expiredSubscriptionsDowngraded");
    expect(notificationsServerSrc).toContain("trialReminders3dSent");
    expect(notificationsServerSrc).toContain("trialExpiredAlertsSent");
    expect(notificationsServerSrc).toContain("renewalReminders3dSent");
    expect(notificationsServerSrc).toContain("subscriptionExpiredAlertsSent");

    // 10c. Contrats UI : Dashboard, Transactions, ReceiptUpload, PlanGate, Sidebar, Modal Choix & Bell
    const dashboardSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"),
      "utf8"
    );
    expect(dashboardSrc).toContain("getSubscriptionCountdownInfo");
    expect(dashboardSrc).toContain('canAccessFeature(subscriptionCountdown.effectivePlanId, "reports")');
    expect(dashboardSrc).toContain('canAccessFeature(subscriptionCountdown.effectivePlanId, "advisor")');
    expect(dashboardSrc).toContain("if (!canExportReports)");
    expect(dashboardSrc).toContain("subscriptionCountdown.isExpiringSoon");

    const transactionsSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/(dashboard)/transactions/page.tsx"),
      "utf8"
    );
    expect(transactionsSrc).toContain('canAccessFeature(subscriptionCountdown.effectivePlanId, "reports")');
    expect(transactionsSrc).toContain("if (!canExportReports)");

    const receiptUploadSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/transactions/receipt-upload.tsx"),
      "utf8"
    );
    expect(receiptUploadSrc).toContain('canAccessFeature(countdown.effectivePlanId, "receipts")');

    const planGateSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/payments/plan-gate.tsx"),
      "utf8"
    );
    expect(planGateSrc).toContain("getSubscriptionCountdownInfo");
    expect(planGateSrc).toContain("countdown.effectivePlanId");

    const sidebarSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/layout/sidebar.tsx"),
      "utf8"
    );
    expect(sidebarSrc).toContain("getSubscriptionCountdownInfo");
    expect(sidebarSrc).toContain("countdown.daysRemaining");

    const layoutSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/(dashboard)/layout.tsx"),
      "utf8"
    );
    expect(layoutSrc).toContain("TrialChoiceModal");

    const headerSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/layout/header.tsx"),
      "utf8"
    );
    expect(headerSrc).toContain("NotificationsBell");
  });

  test("11. Garantie 30j complet dès l'inscription : rattrapage serveur/SQL 4b, bienvenue automatique & zéro flash Cadenassé avant hydratation", () => {
    const monerizAppSrc = fs.readFileSync(
      path.join(process.cwd(), "src/lib/server/moneriz-app.ts"),
      "utf8"
    );
    expect(monerizAppSrc).toContain("needsTrialBackfill");
    expect(monerizAppSrc).toContain("UUID_REGEX.test(params.userId)");
    expect(monerizAppSrc).toContain("TRIAL_DURATION_DAYS * 86_400_000");
    expect(monerizAppSrc).toContain('.is("trial_ends_at", null)');
    expect(monerizAppSrc).toContain('.is("trial_choice_made_at", null)');
    expect(monerizAppSrc).toContain('.is("last_order_id", null)');

    const notificationsSrc = fs.readFileSync(
      path.join(process.cwd(), "src/lib/server/notifications.ts"),
      "utf8"
    );
    expect(notificationsSrc).toContain("if (countdown.isTrialActive && !sub.welcome_email_sent_at)");
    expect(notificationsSrc).toContain("await sendWelcomeNotificationsOnce({");

    const migrationSrc = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261112_trial_notifications_and_plans.sql"),
      "utf8"
    );
    expect(migrationSrc).toContain("4b.");
    expect(migrationSrc).toContain("u.created_at > NOW() - INTERVAL '30 days'");
    expect(migrationSrc).toContain("s.trial_ends_at IS NULL");

    for (const relPath of [
      "src/components/payments/plan-gate.tsx",
      "src/components/layout/sidebar.tsx",
      "src/components/layout/bottom-nav.tsx",
      "src/app/(dashboard)/dashboard/page.tsx",
      "src/app/(dashboard)/transactions/page.tsx",
      "src/components/transactions/receipt-upload.tsx",
      "src/app/(dashboard)/settings/page.tsx",
    ]) {
      const uiSrc = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
      expect(uiSrc).toContain("subscriptionHydrated");
    }
  });
});

