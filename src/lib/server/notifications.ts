import crypto from "node:crypto";
import { createClient as createSessionSupabaseClient } from "@/lib/supabase/server";
import { getPlanCatalog, getSubscriptionCountdownInfo, SubscriptionPlanId } from "@/lib/moneriz-plans";
import { isAdmin } from "@/lib/utils/admin";
import {
  sendPaymentSuccessEmail,
  sendRenewalReminderEmail,
  sendSubscriptionExpiredEmail,
  sendTrialExpiredEmail,
  sendTrialReminderEmail,
  sendWelcomeEmail,
} from "@/lib/email/service";
import {
  createServerAdminSupabaseClient,
  getFallbackOrderForTests,
} from "@/lib/server/moneriz-app";

export type NotificationType =
  | "welcome_trial"
  | "trial_reminder_3d"
  | "trial_expired"
  | "payment_success"
  | "renewal_reminder_3d"
  | "subscription_expired"
  | "system";

export interface UserNotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  ctaHref: string | null;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

const globalForNotifs = globalThis as unknown as {
  __monbudgetNotifications?: Map<string, UserNotificationRecord[]>;
  __monbudgetNotifSentKeys?: Set<string>;
};

const fallbackNotifications =
  globalForNotifs.__monbudgetNotifications ??
  (globalForNotifs.__monbudgetNotifications = new Map<string, UserNotificationRecord[]>());
const fallbackSentKeys =
  globalForNotifs.__monbudgetNotifSentKeys ??
  (globalForNotifs.__monbudgetNotifSentKeys = new Set<string>());

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function formatXof(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount));
}

function mapNotificationRow(row: {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  cta_href?: string | null;
  metadata?: unknown;
  is_read?: boolean | null;
  created_at?: string | null;
}): UserNotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    ctaHref: row.cta_href || null,
    metadata: (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<
      string,
      unknown
    >,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export async function createUserNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  ctaHref?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<UserNotificationRecord | null> {
  const adminSupabase = createServerAdminSupabaseClient();

  if (adminSupabase) {
    try {
      const { data, error } = await adminSupabase
        .from("user_notifications")
        .insert({
          user_id: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          cta_href: params.ctaHref ?? null,
          metadata: params.metadata ?? {},
          is_read: false,
        })
        .select("*")
        .single();

      if (error) {
        console.warn("[Notifications] Insert failed:", error.message);
        return null;
      }
      return mapNotificationRow(data);
    } catch (err) {
      console.warn("[Notifications] Insert exception:", err);
      return null;
    }
  }

  if (isProductionRuntime()) {
    return null;
  }

  const record: UserNotificationRecord = {
    id: crypto.randomUUID(),
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    ctaHref: params.ctaHref ?? null,
    metadata: params.metadata ?? {},
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  const list = fallbackNotifications.get(params.userId) || [];
  list.unshift(record);
  fallbackNotifications.set(params.userId, list.slice(0, 50));
  return record;
}

export async function listUserNotifications(
  userId: string,
  limit = 25
): Promise<{ notifications: UserNotificationRecord[]; unreadCount: number }> {
  const adminSupabase = createServerAdminSupabaseClient();
  const readClient = adminSupabase || (await createSessionSupabaseClient().catch(() => null));

  if (readClient) {
    try {
      const { data, error } = await readClient
        .from("user_notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        const notifications = data.map(mapNotificationRow);
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        return { notifications, unreadCount };
      }
    } catch {
      // fallback si table pas encore déployée
    }
  }

  if (isProductionRuntime()) {
    return { notifications: [], unreadCount: 0 };
  }

  const list = fallbackNotifications.get(userId) || [];
  const notifications = list.slice(0, limit);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  return { notifications, unreadCount };
}

export async function markUserNotificationsRead(params: {
  userId: string;
  notificationId?: string;
  markAll?: boolean;
}): Promise<void> {
  const adminSupabase = createServerAdminSupabaseClient();
  const writeClient = adminSupabase || (await createSessionSupabaseClient().catch(() => null));

  if (writeClient) {
    try {
      let query = writeClient
        .from("user_notifications")
        .update({ is_read: true })
        .eq("user_id", params.userId);

      if (!params.markAll && params.notificationId) {
        query = query.eq("id", params.notificationId);
      } else {
        query = query.eq("is_read", false);
      }

      await query;
    } catch {}
  }

  if (!isProductionRuntime()) {
    const list = fallbackNotifications.get(params.userId) || [];
    for (const item of list) {
      if (params.markAll || item.id === params.notificationId) {
        item.isRead = true;
      }
    }
    fallbackNotifications.set(params.userId, list);
  }
}

async function resolveUserContact(
  adminSupabase: NonNullable<ReturnType<typeof createServerAdminSupabaseClient>>,
  userId: string
): Promise<{ email: string | null; fullName: string | null }> {
  try {
    const [{ data: userData }, { data: profile }] = await Promise.all([
      adminSupabase.auth.admin.getUserById(userId),
      adminSupabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);
    const authUser = userData?.user;
    const email = authUser?.email || null;
    const fullName =
      profile?.full_name ||
      (authUser?.user_metadata?.full_name as string | undefined) ||
      (authUser?.user_metadata?.name as string | undefined) ||
      (email ? email.split("@")[0] : null);
    return { email, fullName };
  } catch {
    return { email: null, fullName: null };
  }
}

/**
 * Envoie une seule fois la notification + email de bienvenue avec essai gratuit 30 jours.
 * Ne touche pas aux Super-Admins ni aux anciens comptes pré-migration sans essai actif.
 */
export async function sendWelcomeNotificationsOnce(params: {
  userId: string;
  userEmail?: string | null;
  fullName?: string | null;
}): Promise<{ sent: boolean }> {
  if (isAdmin(params.userEmail)) {
    return { sent: false };
  }

  const nowIso = new Date().toISOString();
  const adminSupabase = createServerAdminSupabaseClient();

  if (adminSupabase) {
    try {
      const { data: subRow } = await adminSupabase
        .from("user_subscriptions")
        .select("plan_id, status, trial_ends_at, trial_choice_made_at, welcome_email_sent_at")
        .eq("user_id", params.userId)
        .maybeSingle();

      if (!subRow || subRow.welcome_email_sent_at) {
        return { sent: false };
      }

      // Ne notifier que les comptes bénéficiant réellement d'un essai 30j actif (nouveaux inscrits)
      const countdown = getSubscriptionCountdownInfo({
        planId: (subRow.plan_id as SubscriptionPlanId) || "free",
        status: subRow.status,
        trialEndsAt: subRow.trial_ends_at,
        trialChoiceMadeAt: subRow.trial_choice_made_at,
        isAdmin: false,
      });

      if (!countdown.isTrialActive) {
        return { sent: false };
      }

      const { data: claimed } = await adminSupabase
        .from("user_subscriptions")
        .update({ welcome_email_sent_at: nowIso, updated_at: nowIso })
        .eq("user_id", params.userId)
        .is("welcome_email_sent_at", null)
        .select("user_id")
        .maybeSingle();

      if (!claimed) {
        return { sent: false };
      }

      const contact = params.userEmail
        ? { email: params.userEmail, fullName: params.fullName || null }
        : await resolveUserContact(adminSupabase, params.userId);

      const personalPrice = getPlanCatalog().personal.monthlyPriceXof
        .toLocaleString("fr-FR")
        .replace(/[\u00a0\u202f]/g, " ");
      const formattedEnd = countdown.formattedTrialEndsAt;
      await createUserNotification({
        userId: params.userId,
        type: "welcome_trial",
        title: "🎉 Bienvenue ! Essai complet de 30 jours activé",
        message: `Profitez de toutes les fonctionnalités MonBudget gratuitement pendant 30 jours${
          formattedEnd ? ` (jusqu'au ${formattedEnd})` : ""
        }. Ensuite, choisissez entre Gratuit, Particulier (${personalPrice} FCFA) ou Entreprise.`,
        ctaHref: "/dashboard",
      });

      if (contact.email) {
        await sendWelcomeEmail(contact.email, contact.fullName || undefined, {
          trialDays: countdown.trialDaysRemaining ?? 30,
          trialEndsAtFormatted: formattedEnd,
        });
      }

      return { sent: true };
    } catch (err) {
      console.warn("[Notifications] sendWelcomeNotificationsOnce warning:", err);
      return { sent: false };
    }
  }

  if (isProductionRuntime()) return { sent: false };

  const dedupKey = `welcome:${params.userId}`;
  if (fallbackSentKeys.has(dedupKey)) return { sent: false };
  fallbackSentKeys.add(dedupKey);

  await createUserNotification({
    userId: params.userId,
    type: "welcome_trial",
    title: "🎉 Bienvenue ! Essai complet de 30 jours activé",
    message:
      "Profitez de toutes les fonctionnalités MonBudget gratuitement pendant 30 jours sans carte bancaire.",
    ctaHref: "/dashboard",
  });

  if (params.userEmail) {
    await sendWelcomeEmail(params.userEmail, params.fullName || undefined, {
      trialDays: 30,
    });
  }
  return { sent: true };
}

/**
 * Envoie de façon atomique (1 seule fois par commande payée) le message post-paiement avec succès.
 */
export async function sendPostPaymentConfirmationOnce(params: {
  orderId?: string | null;
  reference?: string | null;
  mode?: "test" | "live";
  userEmail?: string | null;
  fullName?: string | null;
}): Promise<{ sent: boolean }> {
  const adminSupabase = createServerAdminSupabaseClient();
  const nowIso = new Date().toISOString();

  if (adminSupabase) {
    try {
      let query = adminSupabase.from("subscription_orders").select("*");
      if (params.orderId) {
        query = query.eq("id", params.orderId);
      } else if (params.reference && params.mode) {
        query = query.eq("reference", params.reference).eq("mode", params.mode);
      } else {
        return { sent: false };
      }

      const { data: orderRow } = await query.maybeSingle();
      if (!orderRow || orderRow.status !== "paid" || orderRow.confirmation_sent_at) {
        return { sent: false };
      }

      const { data: claimed } = await adminSupabase
        .from("subscription_orders")
        .update({ confirmation_sent_at: nowIso, updated_at: nowIso })
        .eq("id", orderRow.id)
        .eq("status", "paid")
        .is("confirmation_sent_at", null)
        .select("id")
        .maybeSingle();

      if (!claimed) {
        return { sent: false };
      }

      const { data: subRow } = await adminSupabase
        .from("user_subscriptions")
        .select("current_period_end")
        .eq("user_id", orderRow.user_id)
        .maybeSingle();

      const catalog = getPlanCatalog();
      const plan = catalog[(orderRow.plan_id as "personal" | "business") || "personal"];
      const expiresFormatted = subRow?.current_period_end
        ? new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(subRow.current_period_end))
        : null;

      await createUserNotification({
        userId: orderRow.user_id,
        type: "payment_success",
        title: `✅ Abonnement ${plan.name} activé avec succès`,
        message: `Paiement de ${formatXof(Number(orderRow.amount))} FCFA confirmé (réf. ${
          orderRow.reference
        }). Votre décompte est lancé${expiresFormatted ? ` jusqu'au ${expiresFormatted}` : ""}.`,
        ctaHref: "/dashboard",
        metadata: {
          orderId: orderRow.id,
          planId: orderRow.plan_id,
          billingCycle: orderRow.billing_cycle,
          amount: orderRow.amount,
        },
      });

      const contact = params.userEmail
        ? { email: params.userEmail, fullName: params.fullName || null }
        : await resolveUserContact(adminSupabase, orderRow.user_id);

      if (contact.email) {
        await sendPaymentSuccessEmail(contact.email, {
          name: contact.fullName || undefined,
          planName: plan.name,
          billingCycle: orderRow.billing_cycle === "yearly" ? "yearly" : "monthly",
          amountXof: Number(orderRow.amount),
          reference: orderRow.reference,
          expiresAtFormatted: expiresFormatted,
        });
      }

      return { sent: true };
    } catch (err) {
      console.warn("[Notifications] sendPostPaymentConfirmationOnce warning:", err);
      return { sent: false };
    }
  }

  if (isProductionRuntime()) return { sent: false };

  const order = params.orderId ? getFallbackOrderForTests(params.orderId) : null;
  if (!order || order.status !== "paid") return { sent: false };

  const dedupKey = `payment_success:${order.id}`;
  if (fallbackSentKeys.has(dedupKey)) return { sent: false };
  fallbackSentKeys.add(dedupKey);

  const plan = getPlanCatalog()[order.planId];
  await createUserNotification({
    userId: order.userId,
    type: "payment_success",
    title: `✅ Abonnement ${plan.name} activé avec succès`,
    message: `Paiement de ${formatXof(order.amount)} FCFA confirmé (réf. ${order.reference}).`,
    ctaHref: "/dashboard",
  });

  if (params.userEmail) {
    await sendPaymentSuccessEmail(params.userEmail, {
      name: params.fullName || undefined,
      planName: plan.name,
      billingCycle: order.billingCycle,
      amountXof: order.amount,
      reference: order.reference,
    });
  }

  return { sent: true };
}

/**
 * Évaluation à la volée pour l'utilisateur connecté (J-3 fin d'essai, J0 fin d'essai, J-3 renouvellement)
 * afin que les relances arrivent même si l'utilisateur ouvre l'app avant le cron nocturne.
 */
export async function evaluateAndSendUserSubscriptionAlerts(params: {
  userId: string;
  userEmail?: string | null;
  fullName?: string | null;
}): Promise<void> {
  if (isAdmin(params.userEmail)) return;
  const adminSupabase = createServerAdminSupabaseClient();
  if (!adminSupabase) return;

  try {
    const { data: sub } = await adminSupabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", params.userId)
      .maybeSingle();

    if (!sub) return;

    const nowIso = new Date().toISOString();
    const countdown = getSubscriptionCountdownInfo({
      planId: (sub.plan_id as SubscriptionPlanId) || "free",
      status: sub.status,
      expiresAt: sub.current_period_end,
      trialEndsAt: sub.trial_ends_at,
      trialChoiceMadeAt: sub.trial_choice_made_at,
      isAdmin: false,
    });

    const catalog = getPlanCatalog();
    const businessPrice = formatXof(catalog.business.monthlyPriceXof);

    // 0. Notification + email de bienvenue si essai 30j actif et accueil non encore envoyé (ex: inscription directe sans confirmation email)
    if (countdown.isTrialActive && !sub.welcome_email_sent_at) {
      await sendWelcomeNotificationsOnce({
        userId: params.userId,
        userEmail: params.userEmail,
        fullName: params.fullName,
      });
    }

    // 1. Relance J-3 avant fin de l'essai gratuit de 30 jours
    if (
      countdown.isTrialActive &&
      countdown.isTrialExpiringSoon &&
      !sub.trial_reminder_3d_sent_at
    ) {
      const { data: claimed } = await adminSupabase
        .from("user_subscriptions")
        .update({ trial_reminder_3d_sent_at: nowIso, updated_at: nowIso })
        .eq("user_id", params.userId)
        .is("trial_reminder_3d_sent_at", null)
        .select("user_id")
        .maybeSingle();

      if (claimed) {
        const d = countdown.trialDaysRemaining ?? 3;
        const personalPrice = catalog.personal.monthlyPriceXof
          .toLocaleString("fr-FR")
          .replace(/[\u00a0\u202f]/g, " ");
        await createUserNotification({
          userId: params.userId,
          type: "trial_reminder_3d",
          title: `⏳ Plus que ${d} jour${d > 1 ? "s" : ""} d'essai gratuit complet`,
          message: `Choisissez votre formule avant le ${
            countdown.formattedTrialEndsAt || "terme"
          } : Gratuit limité (0 FCFA), Particulier (${personalPrice} FCFA/mois) ou Entreprise (${businessPrice} FCFA/mois).`,
          ctaHref: "/settings?tab=subscription",
        });

        const contact = params.userEmail
          ? { email: params.userEmail, fullName: params.fullName || null }
          : await resolveUserContact(adminSupabase, params.userId);
        if (contact.email) {
          await sendTrialReminderEmail(contact.email, {
            name: contact.fullName || undefined,
            daysRemaining: d,
            trialEndsAtFormatted: countdown.formattedTrialEndsAt,
          });
        }
      }
    }

    // 2. Notification J0 : Essai gratuit 30 jours expiré (choix requis)
    if (countdown.isTrialExpired && !sub.trial_expired_sent_at) {
      const { data: claimed } = await adminSupabase
        .from("user_subscriptions")
        .update({ trial_expired_sent_at: nowIso, updated_at: nowIso })
        .eq("user_id", params.userId)
        .is("trial_expired_sent_at", null)
        .select("user_id")
        .maybeSingle();

      if (claimed) {
        const personalPrice = catalog.personal.monthlyPriceXof
          .toLocaleString("fr-FR")
          .replace(/[\u00a0\u202f]/g, " ");
        await createUserNotification({
          userId: params.userId,
          type: "trial_expired",
          title: "🔒 Fin de vos 30 jours d'essai — Choisissez votre formule",
          message: `Votre compte est en mode Gratuit limité. Choisissez Gratuit (fonctionnalités cadenassées), Particulier (${personalPrice} FCFA/mois pour tout débloquer) ou Entreprise (${businessPrice} FCFA/mois).`,
          ctaHref: "/settings?tab=subscription",
        });

        const contact = params.userEmail
          ? { email: params.userEmail, fullName: params.fullName || null }
          : await resolveUserContact(adminSupabase, params.userId);
        if (contact.email) {
          await sendTrialExpiredEmail(contact.email, {
            name: contact.fullName || undefined,
          });
        }
      }
    }

    // 3. Relance J-3 avant échéance d'un abonnement payant actif
    if (
      countdown.isPaidActive &&
      countdown.daysRemaining !== null &&
      countdown.daysRemaining <= 3 &&
      !sub.renewal_reminder_3d_sent_at
    ) {
      const { data: claimed } = await adminSupabase
        .from("user_subscriptions")
        .update({ renewal_reminder_3d_sent_at: nowIso, updated_at: nowIso })
        .eq("user_id", params.userId)
        .is("renewal_reminder_3d_sent_at", null)
        .select("user_id")
        .maybeSingle();

      if (claimed) {
        const plan = catalog[(sub.plan_id as "personal" | "business") || "personal"];
        await createUserNotification({
          userId: params.userId,
          type: "renewal_reminder_3d",
          title: `🔔 Renouvellement dans ${countdown.daysRemaining} jour${
            countdown.daysRemaining > 1 ? "s" : ""
          }`,
          message: `Votre formule ${plan.name} expire le ${
            countdown.formattedExpiresAt || "bientôt"
          }. Renouvelez pour éviter tout cadenassage.`,
          ctaHref: "/settings?tab=subscription",
        });

        const contact = params.userEmail
          ? { email: params.userEmail, fullName: params.fullName || null }
          : await resolveUserContact(adminSupabase, params.userId);
        if (contact.email) {
          await sendRenewalReminderEmail(contact.email, {
            name: contact.fullName || undefined,
            planName: plan.name,
            daysRemaining: countdown.daysRemaining,
            expiresAtFormatted: countdown.formattedExpiresAt,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Notifications] evaluateAndSendUserSubscriptionAlerts warning:", err);
  }
}

/**
 * Sweep nocturne complet (Cron 00:00 UTC) :
 * - Expiration & révocation des abonnements payants échus + relance email/in-app
 * - Relances J-3 avant échéance des abonnements payants actifs
 * - Relances J-3 avant fin de l'essai gratuit 30 jours
 * - Relances J0 à l'expiration de l'essai gratuit 30 jours
 */
export async function runDailySubscriptionLifecycleCron(
  adminSupabase: NonNullable<ReturnType<typeof createServerAdminSupabaseClient>>
): Promise<{
  expiredSubscriptionsDowngraded: number;
  trialReminders3dSent: number;
  trialExpiredAlertsSent: number;
  renewalReminders3dSent: number;
  subscriptionExpiredAlertsSent: number;
}> {
  const now = new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const in3DaysIso = new Date(nowMs + 3 * 86_400_000).toISOString();

  const catalog = getPlanCatalog();
  const businessPrice = formatXof(catalog.business.monthlyPriceXof);

  let expiredSubscriptionsDowngraded = 0;
  let trialReminders3dSent = 0;
  let trialExpiredAlertsSent = 0;
  let renewalReminders3dSent = 0;
  let subscriptionExpiredAlertsSent = 0;

  // 1. Abonnements payants expirés -> bascule sur 'free' + notification
  try {
    const { data: duePaid } = await adminSupabase
      .from("user_subscriptions")
      .select("user_id, plan_id, subscription_expired_sent_at")
      .neq("plan_id", "free")
      .eq("status", "active")
      .not("current_period_end", "is", null)
      .lte("current_period_end", nowIso);

    for (const row of duePaid || []) {
      const contact = await resolveUserContact(adminSupabase, row.user_id);
      if (isAdmin(contact.email)) continue;

      const { data: downgraded } = await adminSupabase
        .from("user_subscriptions")
        .update({
          plan_id: "free",
          billing_cycle: "none",
          status: "expired",
          updated_at: nowIso,
        })
        .eq("user_id", row.user_id)
        .neq("plan_id", "free")
        .eq("status", "active")
        .select("user_id")
        .maybeSingle();

      if (downgraded) {
        expiredSubscriptionsDowngraded += 1;
      }

      if (!row.subscription_expired_sent_at) {
        const { data: claimed } = await adminSupabase
          .from("user_subscriptions")
          .update({ subscription_expired_sent_at: nowIso, updated_at: nowIso })
          .eq("user_id", row.user_id)
          .is("subscription_expired_sent_at", null)
          .select("user_id")
          .maybeSingle();

        if (claimed) {
          const prevPlan = catalog[(row.plan_id as "personal" | "business") || "personal"];
          const personalPrice = catalog.personal.monthlyPriceXof
            .toLocaleString("fr-FR")
            .replace(/[\u00a0\u202f]/g, " ");
          await createUserNotification({
            userId: row.user_id,
            type: "subscription_expired",
            title: `🔒 Abonnement ${prevPlan.name} expiré`,
            message:
              `Votre abonnement a expiré et votre compte est passé en mode Gratuit (outils avancés cadenassés). Prenez un abonnement Particulier dès ${personalPrice} FCFA/mois.`,
            ctaHref: "/settings?tab=subscription&plan=personal",
          });

          if (contact.email) {
            await sendSubscriptionExpiredEmail(contact.email, {
              name: contact.fullName || undefined,
              previousPlanName: prevPlan.name,
            });
          }
          subscriptionExpiredAlertsSent += 1;
        }
      }
    }
  } catch (err) {
    console.warn("[Cron] Expired paid sweep warning:", err);
  }

  // 2. Relances J-3 abonnements payants
  try {
    const { data: soonPaid } = await adminSupabase
      .from("user_subscriptions")
      .select("user_id, plan_id, current_period_end")
      .neq("plan_id", "free")
      .eq("status", "active")
      .not("current_period_end", "is", null)
      .gt("current_period_end", nowIso)
      .lte("current_period_end", in3DaysIso)
      .is("renewal_reminder_3d_sent_at", null);

    for (const row of soonPaid || []) {
      const contact = await resolveUserContact(adminSupabase, row.user_id);
      if (isAdmin(contact.email)) continue;

      const { data: claimed } = await adminSupabase
        .from("user_subscriptions")
        .update({ renewal_reminder_3d_sent_at: nowIso, updated_at: nowIso })
        .eq("user_id", row.user_id)
        .is("renewal_reminder_3d_sent_at", null)
        .select("user_id")
        .maybeSingle();

      if (!claimed) continue;

      const endMs = Date.parse(row.current_period_end);
      const daysLeft = Math.max(1, Math.ceil((endMs - nowMs) / 86_400_000));
      const expiresFormatted = new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(endMs));
      const plan = catalog[(row.plan_id as "personal" | "business") || "personal"];

      await createUserNotification({
        userId: row.user_id,
        type: "renewal_reminder_3d",
        title: `🔔 Renouvellement dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`,
        message: `Votre formule ${plan.name} arrive à échéance le ${expiresFormatted}.`,
        ctaHref: "/settings?tab=subscription",
      });

      if (contact.email) {
        await sendRenewalReminderEmail(contact.email, {
          name: contact.fullName || undefined,
          planName: plan.name,
          daysRemaining: daysLeft,
          expiresAtFormatted: expiresFormatted,
        });
      }
      renewalReminders3dSent += 1;
    }
  } catch (err) {
    console.warn("[Cron] Paid renewal J-3 sweep warning:", err);
  }

  // 3. Relances J-3 essai gratuit 30 jours
  try {
    const { data: soonTrials } = await adminSupabase
      .from("user_subscriptions")
      .select("user_id, trial_ends_at")
      .eq("plan_id", "free")
      .eq("status", "active")
      .is("trial_choice_made_at", null)
      .not("trial_ends_at", "is", null)
      .gt("trial_ends_at", nowIso)
      .lte("trial_ends_at", in3DaysIso)
      .is("trial_reminder_3d_sent_at", null);

    for (const row of soonTrials || []) {
      const contact = await resolveUserContact(adminSupabase, row.user_id);
      if (isAdmin(contact.email)) continue;

      const { data: claimed } = await adminSupabase
        .from("user_subscriptions")
        .update({ trial_reminder_3d_sent_at: nowIso, updated_at: nowIso })
        .eq("user_id", row.user_id)
        .is("trial_reminder_3d_sent_at", null)
        .select("user_id")
        .maybeSingle();

      if (!claimed) continue;

      const endMs = Date.parse(row.trial_ends_at);
      const daysLeft = Math.max(1, Math.ceil((endMs - nowMs) / 86_400_000));
      const endFormatted = new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(endMs));

      const personalPrice = catalog.personal.monthlyPriceXof
        .toLocaleString("fr-FR")
        .replace(/[\u00a0\u202f]/g, " ");
      await createUserNotification({
        userId: row.user_id,
        type: "trial_reminder_3d",
        title: `⏳ Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""} d'essai gratuit complet`,
        message: `Choisissez avant le ${endFormatted} : Gratuit limité (0 FCFA), Particulier (${personalPrice} FCFA/mois) ou Entreprise (${businessPrice} FCFA/mois).`,
        ctaHref: "/settings?tab=subscription",
      });

      if (contact.email) {
        await sendTrialReminderEmail(contact.email, {
          name: contact.fullName || undefined,
          daysRemaining: daysLeft,
          trialEndsAtFormatted: endFormatted,
        });
      }
      trialReminders3dSent += 1;
    }
  } catch (err) {
    console.warn("[Cron] Trial J-3 sweep warning:", err);
  }

  // 4. Relances J0 fin des 30 jours d'essai gratuit
  try {
    const { data: expiredTrials } = await adminSupabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("plan_id", "free")
      .eq("status", "active")
      .is("trial_choice_made_at", null)
      .not("trial_ends_at", "is", null)
      .lte("trial_ends_at", nowIso)
      .is("trial_expired_sent_at", null);

    for (const row of expiredTrials || []) {
      const contact = await resolveUserContact(adminSupabase, row.user_id);
      if (isAdmin(contact.email)) continue;

      const { data: claimed } = await adminSupabase
        .from("user_subscriptions")
        .update({ trial_expired_sent_at: nowIso, updated_at: nowIso })
        .eq("user_id", row.user_id)
        .is("trial_expired_sent_at", null)
        .select("user_id")
        .maybeSingle();

      if (!claimed) continue;

      const personalPrice = catalog.personal.monthlyPriceXof
        .toLocaleString("fr-FR")
        .replace(/[\u00a0\u202f]/g, " ");
      await createUserNotification({
        userId: row.user_id,
        type: "trial_expired",
        title: "🔒 Fin de vos 30 jours d'essai — Choisissez votre formule",
        message: `Votre essai complet de 30 jours est terminé. Passez en Particulier (${personalPrice} FCFA/mois), Entreprise (${businessPrice} FCFA/mois) ou continuez en Gratuit limité.`,
        ctaHref: "/settings?tab=subscription",
      });

      if (contact.email) {
        await sendTrialExpiredEmail(contact.email, {
          name: contact.fullName || undefined,
        });
      }
      trialExpiredAlertsSent += 1;
    }
  } catch (err) {
    console.warn("[Cron] Trial J0 expired sweep warning:", err);
  }

  return {
    expiredSubscriptionsDowngraded,
    trialReminders3dSent,
    trialExpiredAlertsSent,
    renewalReminders3dSent,
    subscriptionExpiredAlertsSent,
  };
}
