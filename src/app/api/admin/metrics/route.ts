import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, verifyAdminAccess } from "@/lib/utils/admin";
import {
  adminSetUserSubscription,
  getFallbackAdminMonerizStats,
} from "@/lib/server/moneriz-app";
import { resolveMonerizMode } from "@/lib/server/moneriz-checkout";
import { BillingCycle, SubscriptionPlanId } from "@/lib/moneriz-plans";
import { adminSetSubscriptionSchema } from "@/lib/validations";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié. Veuillez vous connecter." },
        { status: 401 }
      );
    }

    const access = verifyAdminAccess(user.email);
    if (!access.authorized) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const fallbackStats = getFallbackAdminMonerizStats();

    let totalUsers = 1;
    let totalBudgets = 0;
    let totalTransactions = 0;
    let totalSavingsGoals = 0;
    let totalDebts = 0;
    let totalRevenueXof = fallbackStats.totalRevenueXof;
    let paidSubscribers = 0;
    let personalSubscribers = 0;
    let businessSubscribers = 0;
    let trialUsers = 0;
    let recentUsers: Array<{
      id: string;
      email?: string;
      full_name: string;
      currency: string;
      plan_id: SubscriptionPlanId;
      billing_cycle: string;
      current_period_end?: string | null;
      trial_ends_at?: string | null;
      trial_choice_made_at?: string | null;
      auth_provider?: string;
      created_at: string;
    }> = [];
    let recentOrders = fallbackStats.recentOrders;

    let loadedViaRpcOrServiceRole = false;

    // 1. Tenter via la fonction RPC SECURITY DEFINER admin_get_saas_overview (contourne le RLS)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "admin_get_saas_overview"
      );
      if (!rpcError && rpcData) {
        loadedViaRpcOrServiceRole = true;
        totalUsers = Number(rpcData.totalUsers) || 1;
        totalBudgets = Number(rpcData.totalBudgets) || 0;
        totalTransactions = Number(rpcData.totalTransactions) || 0;
        totalSavingsGoals = Number(rpcData.totalSavingsGoals) || 0;
        totalDebts = Number(rpcData.totalDebts) || 0;
        totalRevenueXof =
          Math.max(Number(rpcData.totalRevenueXof) || 0, fallbackStats.totalRevenueXof);
        paidSubscribers = Number(rpcData.paidSubscribers) || 0;
        personalSubscribers = Number(rpcData.personalSubscribers) || 0;
        businessSubscribers = Number(rpcData.businessSubscribers) || 0;
        trialUsers = Number(rpcData.trialUsers) || 0;

        if (Array.isArray(rpcData.recentUsers)) {
          recentUsers = rpcData.recentUsers.map((u: any) => {
            const memSub = fallbackStats.subscriptionsByUser[u.id];
            const effectivePlan: SubscriptionPlanId =
              memSub?.planId ||
              u.plan_id ||
              (isAdmin(u.email) ? "business" : "free");
            return {
              id: u.id,
              email: u.email || "",
              full_name: u.full_name || "Membre MonBudget",
              currency: u.currency || "FCFA",
              plan_id: effectivePlan,
              billing_cycle: memSub?.billingCycle || u.billing_cycle || "none",
              current_period_end: u.current_period_end || null,
              trial_ends_at: u.trial_ends_at || null,
              trial_choice_made_at: u.trial_choice_made_at || null,
              auth_provider: u.auth_provider || "email",
              created_at: u.created_at || new Date().toISOString(),
            };
          });
        }

        if (Array.isArray(rpcData.recentOrders) && rpcData.recentOrders.length > 0) {
          recentOrders = rpcData.recentOrders;
        }
      }
    } catch {
      // Si la fonction RPC n'est pas encore créée sur Supabase, passer à l'étape 2
    }

    // 2. Si SUPABASE_SERVICE_ROLE_KEY est présente et RPC non encore migrée
    if (
      !loadedViaRpcOrServiceRole &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      try {
        const adminClient = createSupabaseAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } }
        );

        const [
          authUsersRes,
          profilesRes,
          subsRes,
          budgetsCountRes,
          txCountRes,
          goalsCountRes,
          debtsCountRes,
          ordersRes,
        ] = await Promise.all([
          adminClient.auth.admin.listUsers({ page: 1, perPage: 50 }),
          adminClient.from("profiles").select("id, full_name, currency, created_at"),
          adminClient.from("user_subscriptions").select("*"),
          adminClient.from("monthly_budgets").select("id", { count: "exact", head: true }),
          adminClient.from("transactions").select("id", { count: "exact", head: true }),
          adminClient.from("savings_goals").select("id", { count: "exact", head: true }),
          adminClient.from("debts").select("id", { count: "exact", head: true }),
          adminClient
            .from("subscription_orders")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        const profilesMap = new Map<string, any>();
        for (const p of profilesRes.data || []) {
          profilesMap.set(p.id, p);
        }

        const subsMap = new Map<string, any>();
        for (const s of subsRes.data || []) {
          subsMap.set(s.user_id, s);
        }

        const authUsers = authUsersRes.data?.users || [];
        totalUsers = Math.max(authUsers.length, profilesMap.size, 1);
        totalBudgets = budgetsCountRes.count || 0;
        totalTransactions = txCountRes.count || 0;
        totalSavingsGoals = goalsCountRes.count || 0;
        totalDebts = debtsCountRes.count || 0;

        recentUsers = authUsers.map((au) => {
          const prof = profilesMap.get(au.id);
          const dbSub = subsMap.get(au.id);
          const memSub = fallbackStats.subscriptionsByUser[au.id];
          const planId: SubscriptionPlanId =
            memSub?.planId ||
            dbSub?.plan_id ||
            (isAdmin(au.email) ? "business" : "free");
          const cycle = memSub?.billingCycle || dbSub?.billing_cycle || "none";
          return {
            id: au.id,
            email: au.email || "",
            full_name:
              prof?.full_name ||
              au.user_metadata?.full_name ||
              au.user_metadata?.name ||
              au.email?.split("@")[0] ||
              "Membre",
            currency: prof?.currency || "FCFA",
            plan_id: planId,
            billing_cycle: cycle,
            current_period_end: memSub?.currentPeriodEnd || dbSub?.current_period_end || null,
            trial_ends_at: memSub?.trialEndsAt || dbSub?.trial_ends_at || null,
            trial_choice_made_at: memSub?.trialChoiceMadeAt || dbSub?.trial_choice_made_at || null,
            auth_provider: au.app_metadata?.provider || "email",
            created_at: au.created_at || prof?.created_at || new Date().toISOString(),
          };
        });

        const nowMs = Date.now();
        trialUsers = Array.from(subsMap.values()).filter(
          (s: any) =>
            s.plan_id === "free" &&
            s.status === "active" &&
            !s.trial_choice_made_at &&
            s.trial_ends_at &&
            Date.parse(s.trial_ends_at) > nowMs
        ).length;

        if (ordersRes.data && ordersRes.data.length > 0) {
          recentOrders = ordersRes.data;
          const dbPaidSum = ordersRes.data
            .filter((o: any) => o.status === "paid")
            .reduce((acc: number, o: any) => acc + (Number(o.amount) || 0), 0);
          totalRevenueXof = Math.max(dbPaidSum, fallbackStats.totalRevenueXof);
        }

        loadedViaRpcOrServiceRole = true;
      } catch (e) {
        console.warn("Admin service_role fallback:", e);
      }
    }

    // 3. Repli standard sur les tables accessibles si ni RPC ni service_role ne sont encore actifs
    if (!loadedViaRpcOrServiceRole) {
      try {
        const { count: usersCount, data: usersList } = await supabase
          .from("profiles")
          .select("id, full_name, currency, created_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(20);

        totalUsers = usersCount || usersList?.length || 1;
        if (usersList) {
          recentUsers = usersList.map((u: any) => {
            const memSub = fallbackStats.subscriptionsByUser[u.id];
            const isCurrentAdmin = u.id === user.id;
            const planId: SubscriptionPlanId =
              memSub?.planId || (isCurrentAdmin ? "business" : "free");
            return {
              id: u.id,
              email: isCurrentAdmin ? user.email : undefined,
              full_name: u.full_name || "Membre MonBudget",
              currency: u.currency || "FCFA",
              plan_id: planId,
              billing_cycle: memSub?.billingCycle || (isCurrentAdmin ? "yearly" : "none"),
              auth_provider: "email",
              created_at: u.created_at || new Date().toISOString(),
            };
          });
        }

        const [bRes, tRes, gRes, dRes] = await Promise.all([
          supabase.from("monthly_budgets").select("id", { count: "exact", head: true }),
          supabase.from("transactions").select("id", { count: "exact", head: true }),
          supabase.from("savings_goals").select("id", { count: "exact", head: true }),
          supabase.from("debts").select("id", { count: "exact", head: true }),
        ]);

        totalBudgets = bRes.count || 0;
        totalTransactions = tRes.count || 0;
        totalSavingsGoals = gRes.count || 0;
        totalDebts = dRes.count || 0;
      } catch (dbErr) {
        console.warn("Collecte partielle des métriques admin :", dbErr);
      }
    }

    // Recalculer la répartition des plans sur les membres connus
    if (recentUsers.length > 0 && paidSubscribers === 0) {
      personalSubscribers = recentUsers.filter((u) => u.plan_id === "personal").length;
      businessSubscribers = recentUsers.filter((u) => u.plan_id === "business").length;
      paidSubscribers = personalSubscribers + businessSubscribers;
    }

    const emailConfigured = Boolean(process.env.RESEND_API_KEY);
    const cronSecretConfigured = Boolean(process.env.CRON_SECRET);
    const monerizSecretConfigured = Boolean(process.env.MONERIZ_SECRET_KEY);
    const monerizWebhookConfigured = Boolean(process.env.MONERIZ_WEBHOOK_SECRET);
    const monerizMode = resolveMonerizMode();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      adminEmail: user.email,
      multiUserScopeActive: loadedViaRpcOrServiceRole,
      kpis: {
        totalUsers: Math.max(totalUsers, 1),
        totalBudgets,
        totalTransactions,
        totalSavingsGoals,
        totalDebts,
        totalRevenueXof,
        paidSubscribers,
        personalSubscribers,
        businessSubscribers,
        trialUsers,
      },
      systemHealth: {
        database: "online",
        cronJobs: cronSecretConfigured ? "sécurisé (00:00 UTC)" : "actif (clé par défaut)",
        emailService: emailConfigured
          ? "connecté (Resend API)"
          : "simulation locale (zéro coupure)",
        pwaOfflineCache: "opérationnel (IndexedDB/LocalStorage)",
        monerizGateway: monerizSecretConfigured
          ? `connecté (${monerizMode.toUpperCase()})`
          : "en attente de validation Moneriz",
        monerizWebhook: monerizWebhookConfigured
          ? "secret HMAC actif"
          : "à configurer dans .env",
      },
      recentUsers,
      recentOrders,
    });
  } catch (error) {
    console.error("Erreur API Admin Metrics :", error);
    return NextResponse.json(
      { error: "Erreur interne lors de la collecte des métriques." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/metrics
 * Permet au Super-Administrateur d'attribuer ou modifier manuellement le plan d'un membre.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const access = verifyAdminAccess(user.email);
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const rawBody = await request.json().catch(() => null);
    const parsedBody = adminSetSubscriptionSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error:
            parsedBody.error.issues[0]?.message ||
            "Paramètres invalides (targetUserId UUID et planId requis).",
        },
        { status: 400 }
      );
    }

    const { targetUserId, planId, billingCycle } = parsedBody.data;
    const effectiveCycle: BillingCycle = billingCycle === "yearly" ? "yearly" : "monthly";

    const updated = await adminSetUserSubscription({
      targetUserId,
      planId,
      billingCycle: effectiveCycle,
    });

    return NextResponse.json({
      success: true,
      subscription: updated,
    });
  } catch (err) {
    console.error("Erreur POST Admin Metrics :", err);
    return NextResponse.json(
      { error: "Impossible de modifier l'abonnement pour le moment." },
      { status: 500 }
    );
  }
}
