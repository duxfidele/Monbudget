import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyCronSecret } from "@/lib/utils/security";

export const dynamic = "force-dynamic";

/**
 * Tâche automatisée Vercel Cron — Analyse nocturne quotidienne
 * Déclenchée chaque nuit à 00:00 UTC pour scanner les alertes de dettes et préparer les bilans.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // 1. Blindage de sécurité : Seul Vercel Cron (ou une requête autorisée) peut appeler cet endpoint
  if (cronSecret && !verifyCronSecret(authHeader, cronSecret)) {
    return NextResponse.json(
      {
        error: "Accès refusé : Jeton d'autorisation Cron invalide ou manquant.",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const currentDate = new Date();
  const todayISO = currentDate.toISOString().split("T")[0];
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante côté serveur.", code: "CONFIG_ERROR" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Détection des dettes à échéance proche (J-7) ou dépassées
    const { data: upcomingDebts, error: debtError } = await supabase
      .from("debts")
      .select("id, user_id, person_name, amount, type, due_date, status")
      .eq("status", "pending")
      .not("due_date", "is", null)
      .lte("due_date", in7Days);

    if (debtError) {
      console.warn("Erreur de lecture des dettes dans le cron :", debtError.message);
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
  } catch (err: any) {
    console.error("Erreur critique dans le Cron Job nocturne :", err);
    return NextResponse.json(
      {
        error: err?.message || "Erreur interne lors de l'exécution du Cron Job.",
        code: "SERVER_ERROR",
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
