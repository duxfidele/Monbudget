import { type NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionSupabaseClient } from "@/lib/supabase/server";
import { verifyCronSecret } from "@/lib/utils/security";
import { verifyAdminAccess } from "@/lib/utils/admin";

export const dynamic = "force-dynamic";

/**
 * Tâche automatisée Vercel Cron — Analyse nocturne quotidienne
 * Déclenchée chaque nuit à 00:00 UTC pour scanner les alertes de dettes et préparer les bilans.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  // 1. Blindage Fail-Closed : soit un secret CRON valide, soit une session Super-Admin authentifiée
  const hasValidCronSecret = Boolean(cronSecret && verifyCronSecret(authHeader, cronSecret));

  if (!hasValidCronSecret) {
    let adminStatus = 401;
    let isAuthorizedAdmin = false;

    try {
      const sessionClient = await createSessionSupabaseClient();
      const {
        data: { user },
      } = await sessionClient.auth.getUser();
      const access = verifyAdminAccess(user?.email);
      isAuthorizedAdmin = access.authorized;
      adminStatus = access.status;
    } catch {
      adminStatus = 401;
    }

    if (!isAuthorizedAdmin) {
      return NextResponse.json(
        {
          error: "Accès refusé : Jeton d'autorisation Cron invalide ou manquant.",
          code: adminStatus === 403 ? "FORBIDDEN" : "UNAUTHORIZED",
        },
        { status: adminStatus }
      );
    }
  }

  const startTime = Date.now();
  const currentDate = new Date();
  const todayISO = currentDate.toISOString().split("T")[0];
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error: "Configuration Supabase privilèges serveur manquante.",
          code: "SERVER_CONFIG_ERROR",
        },
        { status: 503 }
      );
    }

    const supabase = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2. Détection des dettes actives à échéance proche (J-7) ou dépassées
    const { data: upcomingDebts, error: debtError } = await supabase
      .from("debts")
      .select("id, user_id, person_name, total_amount, remaining_amount, type, due_date, status")
      .in("status", ["pending", "partial"])
      .not("due_date", "is", null)
      .lte("due_date", in7Days);

    if (debtError) {
      console.warn("Erreur de lecture des dettes dans le cron :", debtError.message);
      return NextResponse.json(
        { error: "Erreur lors de l'audit des dettes.", code: "DB_ERROR" },
        { status: 500 }
      );
    }

    // 3. Détection de premier jour du mois (clôture mensuelle)
    const isFirstDayOfMonth = currentDate.getDate() === 1;

    // 4. Synthèse d'audit nocturne
    const payableCount = (upcomingDebts || []).filter((d) => d.type === "payable").length;
    const receivableCount = (upcomingDebts || []).filter((d) => d.type === "receivable").length;

    const summary = {
      success: true,
      executionDate: todayISO,
      timestamp: currentDate.toISOString(),
      durationMs: Date.now() - startTime,
      task: "nightly-financial-audit",
      results: {
        upcomingDebtsDetected: upcomingDebts?.length || 0,
        debtsToPaySoon: payableCount,
        debtsToCollectSoon: receivableCount,
        isFirstDayOfMonth,
        monthlyRolloverNeeded: isFirstDayOfMonth,
      },
    };

    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("Erreur critique dans le Cron Job nocturne :", err);
    return NextResponse.json(
      {
        error: "Erreur interne lors de l'exécution du Cron Job.",
        code: "SERVER_ERROR",
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
