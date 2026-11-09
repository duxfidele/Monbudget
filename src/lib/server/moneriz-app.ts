import crypto from "node:crypto";
import { createClient as createSupabaseAdminOrServerClient } from "@supabase/supabase-js";
import { createClient as createSessionSupabaseClient } from "@/lib/supabase/server";
import {
  BillingCycle,
  PaidSubscriptionPlanId,
  SubscriptionPlanId,
  getServerPlanAmountXof,
} from "@/lib/moneriz-plans";
import { isAdmin } from "@/lib/utils/admin";
import {
  MonerizCheckoutOrderRecord,
  MonerizCheckoutRequestSnapshot,
  MonerizCheckoutSessionResponse,
  resolveMonerizMode,
} from "@/lib/server/moneriz-checkout";

export interface MonerizWebhookEvent {
  id: string;
  type: "payment.succeeded" | "payment.failed" | "payment.expired" | "payment.reversed";
  mode: "test" | "live";
  occurredAt: string;
  payment: {
    id: string;
    mode: "test" | "live";
    status: "pending" | "paid" | "failed" | "expired" | "reversed";
    amount: number;
    currency: "XOF";
    reference: string;
    paidAt: string | null;
  };
}

export interface UserSubscriptionRecord {
  userId: string;
  planId: SubscriptionPlanId;
  billingCycle: BillingCycle | "none";
  status: "active" | "canceled" | "expired";
  currentPeriodEnd: string | null;
  lastOrderId: string | null;
}

// Registre serveur résilient (utilisé en relais si la migration SQL n'a pas encore été appliquée sur l'instance distante)
const globalForMoneriz = globalThis as unknown as {
  __monbudgetOrders?: Map<string, MonerizCheckoutOrderRecord>;
  __monbudgetInbox?: Set<string>;
  __monbudgetSubscriptions?: Map<string, UserSubscriptionRecord>;
};

const fallbackOrders =
  globalForMoneriz.__monbudgetOrders ??
  (globalForMoneriz.__monbudgetOrders = new Map<string, MonerizCheckoutOrderRecord>());
const fallbackInbox =
  globalForMoneriz.__monbudgetInbox ??
  (globalForMoneriz.__monbudgetInbox = new Set<string>());
const fallbackSubscriptions =
  globalForMoneriz.__monbudgetSubscriptions ??
  (globalForMoneriz.__monbudgetSubscriptions = new Map<string, UserSubscriptionRecord>());

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createSupabaseAdminOrServerClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function requireAdminSupabaseOrNonProdFallback() {
  const adminSupabase = getAdminSupabase();
  if (!adminSupabase && isProductionRuntime()) {
    throw new Error("MISSING_SERVICE_ROLE_KEY");
  }
  return adminSupabase;
}

async function getOptionalSessionSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return await createSessionSupabaseClient().catch(() => null);
}

function buildAppOrigin(requestOrigin?: string): string {
  const configured =
    process.env.MONERIZ_EMBED_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    requestOrigin ||
    "http://localhost:3000";
  return new URL(configured).origin;
}

function isSessionReusable(session: MonerizCheckoutSessionResponse | null | undefined): boolean {
  if (!session || session.status !== "open" || !session.expiresAt) return false;
  const expiresMs = new Date(session.expiresAt).getTime();
  // Marge de sécurité de 60 secondes avant expiration
  return Number.isFinite(expiresMs) && expiresMs - Date.now() > 60_000;
}

/**
 * Prépare ou récupère une commande autorisée pour l'utilisateur et persiste
 * l'Idempotency-Key ainsi que le requestSnapshot immuable avant tout appel réseau à Moneriz.
 */
export async function prepareAuthorizedCheckout(params: {
  userId: string;
  orderId?: string;
  planId?: PaidSubscriptionPlanId;
  billingCycle?: BillingCycle;
  requestOrigin?: string;
  preferredMode?: "iframe" | "redirect";
}): Promise<{
  order: MonerizCheckoutOrderRecord;
  existingSession?: MonerizCheckoutSessionResponse;
}> {
  const mode = resolveMonerizMode();
  const integrationMode: "iframe" | "redirect" =
    params.preferredMode ||
    (process.env.MONERIZ_INTEGRATION_MODE === "redirect" ? "redirect" : "iframe");
  const appOrigin = buildAppOrigin(params.requestOrigin);

  const adminSupabase = requireAdminSupabaseOrNonProdFallback();

  // 1. Si un orderId est fourni, rechercher la commande existante et vérifier la propriété
  if (params.orderId) {
    let existingOrder: MonerizCheckoutOrderRecord | null = null;

    if (adminSupabase) {
      const { data: row, error: fetchError } = await adminSupabase
        .from("subscription_orders")
        .select("*")
        .eq("id", params.orderId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`ORDER_FETCH_FAILED:${fetchError.message}`);
      }
      if (row) {
        existingOrder = mapRowToOrder(row);
      }
    } else {
      existingOrder = fallbackOrders.get(params.orderId) || null;
    }

    if (!existingOrder || existingOrder.userId !== params.userId) {
      throw new Error("FORBIDDEN_ORDER");
    }

    if (existingOrder.status === "paid") {
      throw new Error("ORDER_ALREADY_PAID");
    }

    if (isSessionReusable(existingOrder.checkoutSession)) {
      return { order: existingOrder, existingSession: existingOrder.checkoutSession! };
    }

    // Régénérer une clé d'idempotence uniquement si la tentative précédente est failed/expired ou session expirée
    const needNewAttempt =
      !existingOrder.idempotencyKey ||
      !existingOrder.requestSnapshot ||
      existingOrder.status === "failed" ||
      existingOrder.status === "expired" ||
      (existingOrder.checkoutSession && !isSessionReusable(existingOrder.checkoutSession));

    if (needNewAttempt) {
      const attemptId = crypto.randomUUID().slice(0, 8);
      const idempotencyKey = `checkout-${existingOrder.id}-${attemptId}`;
      const snapshot = buildRequestSnapshot({
        orderId: existingOrder.id,
        userId: existingOrder.userId,
        planId: existingOrder.planId,
        billingCycle: existingOrder.billingCycle,
        amount: existingOrder.amount,
        title: existingOrder.title,
        reference: existingOrder.reference,
        integrationMode,
        appOrigin,
      });

      existingOrder.status = "pending";
      existingOrder.idempotencyKey = idempotencyKey;
      existingOrder.requestSnapshot = snapshot;
      existingOrder.checkoutSession = null;

      if (adminSupabase) {
        const { error: updateError } = await adminSupabase
          .from("subscription_orders")
          .update({
            status: "pending",
            idempotency_key: idempotencyKey,
            request_snapshot: snapshot,
            checkout_session: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingOrder.id);

        if (updateError) {
          throw new Error(`ORDER_PERSISTENCE_FAILED:${updateError.message}`);
        }
      } else {
        fallbackOrders.set(existingOrder.id, existingOrder);
      }
    }

    return { order: existingOrder };
  }

  // 2. Sinon, valider planId et billingCycle côté serveur
  const planId = params.planId;
  const billingCycle: BillingCycle = params.billingCycle === "yearly" ? "yearly" : "monthly";

  if (planId !== "personal" && planId !== "business") {
    throw new Error("INVALID_PLAN");
  }

  // Chercher s'il existe déjà une commande pending réutilisable pour ce même plan et cycle
  if (adminSupabase) {
    const { data: pendingRow, error: pendingError } = await adminSupabase
      .from("subscription_orders")
      .select("*")
      .eq("user_id", params.userId)
      .eq("plan_id", planId)
      .eq("billing_cycle", billingCycle)
      .eq("mode", mode)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      throw new Error(`ORDER_FETCH_FAILED:${pendingError.message}`);
    }

    if (pendingRow) {
      const existingPending = mapRowToOrder(pendingRow);
      if (isSessionReusable(existingPending.checkoutSession)) {
        return { order: existingPending, existingSession: existingPending.checkoutSession! };
      }
      return { order: existingPending };
    }
  } else {
    for (const cached of fallbackOrders.values()) {
      if (
        cached.userId === params.userId &&
        cached.planId === planId &&
        cached.billingCycle === billingCycle &&
        cached.mode === mode &&
        cached.status === "pending"
      ) {
        if (isSessionReusable(cached.checkoutSession)) {
          return { order: cached, existingSession: cached.checkoutSession! };
        }
        return { order: cached };
      }
    }
  }

  const { amount, currency, title } = getServerPlanAmountXof(planId, billingCycle);
  const orderId = crypto.randomUUID();
  const shortRef = orderId.replace(/-/g, "").slice(0, 12).toUpperCase();
  const reference = `MB-${mode.toUpperCase()}-${planId.toUpperCase().slice(0, 3)}-${shortRef}`;
  const idempotencyKey = `checkout-${orderId}-attempt-1`;

  const requestSnapshot = buildRequestSnapshot({
    orderId,
    userId: params.userId,
    planId,
    billingCycle,
    amount,
    title,
    reference,
    integrationMode,
    appOrigin,
  });

  const newOrder: MonerizCheckoutOrderRecord = {
    id: orderId,
    userId: params.userId,
    planId,
    billingCycle,
    mode,
    reference,
    amount,
    currency,
    title,
    status: "pending",
    idempotencyKey,
    requestSnapshot,
    checkoutSession: null,
  };

  if (adminSupabase) {
    const { error: insertError } = await adminSupabase.from("subscription_orders").insert({
      id: newOrder.id,
      user_id: newOrder.userId,
      plan_id: newOrder.planId,
      billing_cycle: newOrder.billingCycle,
      mode: newOrder.mode,
      reference: newOrder.reference,
      amount: newOrder.amount,
      currency: newOrder.currency,
      title: newOrder.title,
      status: newOrder.status,
      idempotency_key: newOrder.idempotencyKey,
      request_snapshot: newOrder.requestSnapshot,
    });

    if (insertError) {
      throw new Error(`ORDER_PERSISTENCE_FAILED:${insertError.message}`);
    }
  } else {
    fallbackOrders.set(orderId, newOrder);
  }

  return { order: newOrder };
}

function buildRequestSnapshot(params: {
  orderId: string;
  userId: string;
  planId: PaidSubscriptionPlanId;
  billingCycle: BillingCycle;
  amount: number;
  title: string;
  reference: string;
  integrationMode: "iframe" | "redirect";
  appOrigin: string;
}): MonerizCheckoutRequestSnapshot {
  const snapshot: MonerizCheckoutRequestSnapshot = {
    amount: params.amount,
    currency: "XOF",
    title: params.title,
    reference: params.reference,
    integrationMode: params.integrationMode,
    successUrl: `${params.appOrigin}/settings?tab=subscription&orderId=${encodeURIComponent(params.orderId)}&checkout=return`,
    cancelUrl: `${params.appOrigin}/settings?tab=subscription&orderId=${encodeURIComponent(params.orderId)}&checkout=cancel`,
    metadata: {
      orderId: params.orderId,
      userId: params.userId,
      planId: params.planId,
      billingCycle: params.billingCycle,
    },
  };

  if (params.integrationMode === "iframe") {
    snapshot.embedOrigin = params.appOrigin;
  }

  return snapshot;
}

/**
 * Sauvegarde la session Moneriz créée sur la commande.
 */
export async function saveCheckoutSession(
  orderId: string,
  session: MonerizCheckoutSessionResponse,
  updatedIdempotencyKey?: string,
  updatedSnapshot?: MonerizCheckoutRequestSnapshot
): Promise<void> {
  const adminSupabase = requireAdminSupabaseOrNonProdFallback();

  if (adminSupabase) {
    const { error } = await adminSupabase
      .from("subscription_orders")
      .update({
        checkout_session: session,
        ...(updatedIdempotencyKey ? { idempotency_key: updatedIdempotencyKey } : {}),
        ...(updatedSnapshot ? { request_snapshot: updatedSnapshot } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      throw new Error(`ORDER_PERSISTENCE_FAILED:${error.message}`);
    }
    return;
  }

  const cached = fallbackOrders.get(orderId);
  if (cached) {
    cached.checkoutSession = session;
    if (updatedIdempotencyKey) cached.idempotencyKey = updatedIdempotencyKey;
    if (updatedSnapshot) cached.requestSnapshot = updatedSnapshot;
    fallbackOrders.set(orderId, cached);
  }
}

/**
 * Valide la structure d'un événement webhook Moneriz.
 */
export function parseMonerizEvent(rawBody: string): MonerizWebhookEvent {
  let parsed: any;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error("INVALID_EVENT_JSON");
  }

  const validTypes = [
    "payment.succeeded",
    "payment.failed",
    "payment.expired",
    "payment.reversed",
  ];
  const validModes = ["test", "live"];
  const validStatuses = ["pending", "paid", "failed", "expired", "reversed"];

  if (
    !parsed ||
    typeof parsed.id !== "string" ||
    !parsed.id.startsWith("evt_") ||
    !validTypes.includes(parsed.type) ||
    !validModes.includes(parsed.mode) ||
    typeof parsed.occurredAt !== "string" ||
    !parsed.payment ||
    typeof parsed.payment.id !== "string" ||
    !validModes.includes(parsed.payment.mode) ||
    !validStatuses.includes(parsed.payment.status) ||
    typeof parsed.payment.amount !== "number" ||
    parsed.payment.currency !== "XOF" ||
    typeof parsed.payment.reference !== "string"
  ) {
    throw new Error("INVALID_EVENT_PAYLOAD");
  }

  return parsed as MonerizWebhookEvent;
}

/**
 * Traite de manière atomique et idempotente un événement webhook Moneriz.
 * N'active l'abonnement que sur `payment.succeeded` avec `payment.status === 'paid'`,
 * après vérification du mode, de la référence, du montant et de la devise XOF.
 */
export async function commitMonerizInbox(event: MonerizWebhookEvent): Promise<{
  duplicate: boolean;
  orderStatus: string;
  planId?: SubscriptionPlanId;
}> {
  const expectedMode = resolveMonerizMode();
  if (event.mode !== expectedMode || event.payment.mode !== expectedMode) {
    throw new Error("MODE_MISMATCH");
  }

  // 1. Exiger service_role en production (aucun fallback RAM / anon silencieux)
  const adminSupabase = requireAdminSupabaseOrNonProdFallback();
  if (adminSupabase) {
    const { data, error } = await adminSupabase.rpc("process_moneriz_webhook_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_mode: event.mode,
      p_payment_id: event.payment.id,
      p_reference: event.payment.reference,
      p_amount: event.payment.amount,
      p_currency: event.payment.currency,
      p_payment_status: event.payment.status,
      p_occurred_at: event.occurredAt,
      p_payload: event,
    });

    if (!error && data) {
      return {
        duplicate: Boolean(data.duplicate),
        orderStatus: data.order_status || "processed",
        planId: data.plan_id,
      };
    }

    if (error) {
      const msg = error.message || "";
      if (msg.includes("ORDER_NOT_FOUND:")) {
        throw new Error(`ORDER_NOT_FOUND:${event.payment.reference}`);
      }
      if (msg.includes("AMOUNT_OR_CURRENCY_MISMATCH")) {
        throw new Error("AMOUNT_OR_CURRENCY_MISMATCH");
      }
      if (msg.includes("FORBIDDEN_")) {
        throw new Error(msg);
      }

      // Repli contrôlé vers les tables SQL uniquement si la fonction RPC n'est pas encore déployée
      const isMissingRpc =
        error.code === "PGRST202" ||
        error.code === "42883" ||
        /could not find the function|does not exist/i.test(msg);

      if (!isMissingRpc) {
        throw new Error(`WEBHOOK_RPC_FAILED:${msg}`);
      }

      // 1b. Déduplication & écriture directe via service_role si la RPC n'existe pas encore
      const { data: existingInbox, error: inboxReadError } = await adminSupabase
        .from("moneriz_webhook_inbox")
        .select("event_id")
        .eq("event_id", event.id)
        .maybeSingle();

      if (inboxReadError) {
        throw new Error(`WEBHOOK_INBOX_READ_FAILED:${inboxReadError.message}`);
      }
      if (existingInbox) {
        return { duplicate: true, orderStatus: "unchanged" };
      }

      const { data: orderRow, error: orderFetchError } = await adminSupabase
        .from("subscription_orders")
        .select("*")
        .eq("mode", event.mode)
        .eq("reference", event.payment.reference)
        .maybeSingle();

      if (orderFetchError) {
        throw new Error(`ORDER_FETCH_FAILED:${orderFetchError.message}`);
      }
      if (!orderRow) {
        throw new Error(`ORDER_NOT_FOUND:${event.payment.reference}`);
      }

      const targetOrder = mapRowToOrder(orderRow);
      if (
        targetOrder.amount !== event.payment.amount ||
        targetOrder.currency !== event.payment.currency
      ) {
        throw new Error("AMOUNT_OR_CURRENCY_MISMATCH");
      }

      const { error: inboxInsertError } = await adminSupabase
        .from("moneriz_webhook_inbox")
        .insert({
          event_id: event.id,
          event_type: event.type,
          mode: event.mode,
          payment_id: event.payment.id,
          reference: event.payment.reference,
          payload: event,
        });

      if (inboxInsertError) {
        if (inboxInsertError.code === "23505") {
          return { duplicate: true, orderStatus: "unchanged" };
        }
        throw new Error(`WEBHOOK_INBOX_WRITE_FAILED:${inboxInsertError.message}`);
      }

      const result = syncFallbackMemoryWithEvent(event, targetOrder);

      const { error: orderUpdateError } = await adminSupabase
        .from("subscription_orders")
        .update({
          status: targetOrder.status,
          last_payment_id: event.payment.id,
          ...(targetOrder.status === "paid" ? { paid_at: event.payment.paidAt || event.occurredAt } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetOrder.id);

      if (orderUpdateError) {
        throw new Error(`ORDER_UPDATE_FAILED:${orderUpdateError.message}`);
      }

      if (event.type === "payment.succeeded" && event.payment.status === "paid") {
        const sub = fallbackSubscriptions.get(targetOrder.userId);
        if (sub) {
          const { error: subUpsertError } = await adminSupabase
            .from("user_subscriptions")
            .upsert({
              user_id: sub.userId,
              plan_id: sub.planId,
              billing_cycle: sub.billingCycle,
              status: sub.status,
              current_period_end: sub.currentPeriodEnd,
              last_order_id: sub.lastOrderId,
              updated_at: new Date().toISOString(),
            });

          if (subUpsertError) {
            throw new Error(`SUBSCRIPTION_UPSERT_FAILED:${subUpsertError.message}`);
          }
        }
      } else if (event.type === "payment.reversed") {
        const { error: subCancelError } = await adminSupabase
          .from("user_subscriptions")
          .update({
            plan_id: "free",
            billing_cycle: "none",
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", targetOrder.userId)
          .eq("last_order_id", targetOrder.id);

        if (subCancelError) {
          throw new Error(`SUBSCRIPTION_REVERSAL_FAILED:${subCancelError.message}`);
        }
      }

      return result;
    }
  }

  // 2. Mode mémoire hors production uniquement (tests unitaires / dev local sans SUPABASE_SERVICE_ROLE_KEY)
  if (fallbackInbox.has(event.id)) {
    return { duplicate: true, orderStatus: "unchanged" };
  }

  let targetOrder: MonerizCheckoutOrderRecord | null = null;
  for (const order of fallbackOrders.values()) {
    if (order.mode === event.mode && order.reference === event.payment.reference) {
      targetOrder = order;
      break;
    }
  }

  if (!targetOrder) {
    throw new Error(`ORDER_NOT_FOUND:${event.payment.reference}`);
  }

  if (
    targetOrder.amount !== event.payment.amount ||
    targetOrder.currency !== event.payment.currency
  ) {
    throw new Error("AMOUNT_OR_CURRENCY_MISMATCH");
  }

  fallbackInbox.add(event.id);
  return syncFallbackMemoryWithEvent(event, targetOrder);
}

function syncFallbackMemoryWithEvent(
  event: MonerizWebhookEvent,
  orderArg?: MonerizCheckoutOrderRecord
): {
  duplicate: boolean;
  orderStatus: string;
  planId?: SubscriptionPlanId;
} {
  let order = orderArg;
  if (!order) {
    for (const item of fallbackOrders.values()) {
      if (item.mode === event.mode && item.reference === event.payment.reference) {
        order = item;
        break;
      }
    }
  }
  if (!order) {
    return { duplicate: false, orderStatus: "unknown" };
  }

  if (event.type === "payment.succeeded" && event.payment.status === "paid") {
    if (order.status !== "paid" && order.status !== "reversed") {
      order.status = "paid";
      fallbackOrders.set(order.id, order);

      const now = new Date();
      const periodEnd = new Date(now);
      if (order.billingCycle === "yearly") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      fallbackSubscriptions.set(order.userId, {
        userId: order.userId,
        planId: order.planId,
        billingCycle: order.billingCycle,
        status: "active",
        currentPeriodEnd: periodEnd.toISOString(),
        lastOrderId: order.id,
      });
    }
    return { duplicate: false, orderStatus: "paid", planId: order.planId };
  }

  if (event.type === "payment.failed") {
    if (order.status === "pending") {
      order.status = "failed";
      order.idempotencyKey = "";
      fallbackOrders.set(order.id, order);
    }
    return { duplicate: false, orderStatus: order.status };
  }

  if (event.type === "payment.expired") {
    if (order.status === "pending") {
      order.status = "expired";
      order.idempotencyKey = "";
      fallbackOrders.set(order.id, order);
    }
    return { duplicate: false, orderStatus: order.status };
  }

  if (event.type === "payment.reversed") {
    order.status = "reversed";
    fallbackOrders.set(order.id, order);
    const currentSub = fallbackSubscriptions.get(order.userId);
    if (currentSub && currentSub.lastOrderId === order.id) {
      fallbackSubscriptions.set(order.userId, {
        userId: order.userId,
        planId: "free",
        billingCycle: "none",
        status: "canceled",
        currentPeriodEnd: null,
        lastOrderId: order.id,
      });
    }
    return { duplicate: false, orderStatus: "reversed", planId: "free" };
  }

  return { duplicate: false, orderStatus: order.status };
}

/**
 * Récupère l'état d'une commande et l'abonnement actif d'un utilisateur côté serveur.
 */
export async function getOrderAndSubscriptionStatus(params: {
  userId: string;
  userEmail?: string | null;
  orderId?: string | null;
}): Promise<{
  order: {
    id: string;
    reference: string;
    planId: PaidSubscriptionPlanId;
    billingCycle: BillingCycle;
    amount: number;
    currency: "XOF";
    status: string;
  } | null;
  subscription: UserSubscriptionRecord;
  isAdmin: boolean;
}> {
  const isSuperAdmin = isAdmin(params.userEmail);
  const adminSupabase = getAdminSupabase();
  const readClient = adminSupabase || (await getOptionalSessionSupabase());

  let order: MonerizCheckoutOrderRecord | null = null;
  if (params.orderId) {
    if (readClient) {
      const { data: row } = await readClient
        .from("subscription_orders")
        .select("*")
        .eq("id", params.orderId)
        .eq("user_id", params.userId)
        .maybeSingle();
      if (row) {
        order = mapRowToOrder(row);
      }
    } else if (!isProductionRuntime()) {
      order = fallbackOrders.get(params.orderId) || null;
    }

    if (order && order.userId !== params.userId) {
      order = null;
    }
  }

  let sub: UserSubscriptionRecord | null = null;
  if (readClient) {
    try {
      const { data: subRow } = await readClient
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", params.userId)
        .maybeSingle();
      if (subRow) {
        sub = {
          userId: subRow.user_id,
          planId: (subRow.plan_id as SubscriptionPlanId) || "free",
          billingCycle: (subRow.billing_cycle as BillingCycle | "none") || "none",
          status: (subRow.status as "active" | "canceled" | "expired") || "active",
          currentPeriodEnd: subRow.current_period_end || null,
          lastOrderId: subRow.last_order_id || null,
        };
      }
    } catch {}
  } else if (!isProductionRuntime()) {
    sub = fallbackSubscriptions.get(params.userId) || null;
  }

  if (!sub) {
    sub = {
      userId: params.userId,
      planId: isSuperAdmin ? "business" : "free",
      billingCycle: isSuperAdmin ? "yearly" : "none",
      status: "active",
      currentPeriodEnd: null,
      lastOrderId: null,
    };
  }

  return {
    order: order
      ? {
          id: order.id,
          reference: order.reference,
          planId: order.planId,
          billingCycle: order.billingCycle,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
        }
      : null,
    subscription: sub,
    isAdmin: isSuperAdmin,
  };
}

/**
 * Permet au Super-Administrateur de modifier manuellement la formule d'un utilisateur.
 */
export async function adminSetUserSubscription(params: {
  targetUserId: string;
  planId: SubscriptionPlanId;
  billingCycle?: BillingCycle | "none";
}): Promise<UserSubscriptionRecord> {
  const effectiveCycle: BillingCycle | "none" =
    params.planId === "free"
      ? "none"
      : params.billingCycle === "yearly"
      ? "yearly"
      : "monthly";

  const now = new Date();
  let periodEnd: string | null = null;
  if (params.planId !== "free") {
    const d = new Date(now);
    if (effectiveCycle === "yearly") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    periodEnd = d.toISOString();
  }

  const record: UserSubscriptionRecord = {
    userId: params.targetUserId,
    planId: params.planId,
    billingCycle: effectiveCycle,
    status: "active",
    currentPeriodEnd: periodEnd,
    lastOrderId: null,
  };

  const sessionSupabase = await getOptionalSessionSupabase();
  const adminClient = getAdminSupabase();

  let persisted = false;
  let lastError: string | null = null;

  if (sessionSupabase) {
    const { error: rpcError } = await sessionSupabase.rpc("admin_set_user_subscription", {
      p_target_user_id: params.targetUserId,
      p_plan_id: params.planId,
      p_billing_cycle: effectiveCycle === "none" ? "monthly" : effectiveCycle,
    });
    if (!rpcError) {
      persisted = true;
    } else {
      lastError = rpcError.message;
    }
  }

  if (!persisted && adminClient) {
    const { error: upsertError } = await adminClient.from("user_subscriptions").upsert({
      user_id: params.targetUserId,
      plan_id: params.planId,
      billing_cycle: effectiveCycle,
      status: "active",
      current_period_end: periodEnd,
      updated_at: now.toISOString(),
    });
    if (!upsertError) {
      persisted = true;
    } else {
      lastError = upsertError.message;
    }
  }

  if (!persisted) {
    if (isProductionRuntime() || adminClient || sessionSupabase) {
      throw new Error(lastError || "MISSING_SERVICE_ROLE_KEY");
    }
    fallbackSubscriptions.set(params.targetUserId, record);
  }

  return record;
}

export function getFallbackAdminMonerizStats() {
  let totalRevenueXof = 0;
  const recentOrders: Array<{
    id: string;
    reference: string;
    plan_id: string;
    billing_cycle: string;
    mode: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
  }> = [];

  for (const ord of fallbackOrders.values()) {
    if (ord.status === "paid") {
      totalRevenueXof += ord.amount;
    }
    recentOrders.push({
      id: ord.id,
      reference: ord.reference,
      plan_id: ord.planId,
      billing_cycle: ord.billingCycle,
      mode: ord.mode,
      amount: ord.amount,
      currency: ord.currency,
      status: ord.status,
      created_at: new Date().toISOString(),
    });
  }

  const subscriptionsByUser: Record<string, UserSubscriptionRecord> = {};
  for (const [uid, sub] of fallbackSubscriptions.entries()) {
    subscriptionsByUser[uid] = sub;
  }

  return {
    totalRevenueXof,
    recentOrders,
    subscriptionsByUser,
  };
}

function mapRowToOrder(row: any): MonerizCheckoutOrderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    billingCycle: row.billing_cycle,
    mode: row.mode,
    reference: row.reference,
    amount: Number(row.amount),
    currency: "XOF",
    title: row.title,
    status: row.status,
    idempotencyKey: row.idempotency_key || `checkout-${row.id}-attempt-1`,
    requestSnapshot: row.request_snapshot,
    checkoutSession: row.checkout_session || null,
  };
}

