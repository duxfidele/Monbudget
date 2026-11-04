"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Brain,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  ShieldAlert,
  TrendingDown,
  PiggyBank,
  HandCoins,
  Wallet,
  Wrench,
  Calculator,
  Calendar,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";
import {
  formatMoney,
  getTotalExpenses,
  getRemainingToLive,
  getMonthlySavingsContributions,
  getSpentByCategory,
  generateFinancialAIAnalysis,
  AIRecommendation,
} from "@/lib/utils/budget-calc";

export default function AdvisorPage() {
  const {
    income,
    incomeEntries,
    categories,
    transactions,
    savingsGoals,
    debts,
    currency,
    activeMonth,
    payDay,
    updateCategoryAmount,
    addCategory,
    addSavingsGoal,
  } = useUIStore();

  const totalExpenses = getTotalExpenses(transactions);
  const rawMonthlySavings = getMonthlySavingsContributions(
    savingsGoals,
    activeMonth.year,
    activeMonth.month
  );
  const monthlySavings = Math.max(
    rawMonthlySavings,
    getSpentByCategory(transactions, "Épargne", rawMonthlySavings)
  );
  const remaining = getRemainingToLive(income, totalExpenses, monthlySavings);

  const aiAnalysis = generateFinancialAIAnalysis({
    income,
    incomeSourcesCount: Math.max(1, incomeEntries?.length || 1),
    categories,
    transactions,
    savingsGoals,
    debts,
    monthlySavings,
    currency,
    currentDate: new Date(),
    payDay: payDay || 28,
  });

  const { temporal, findings, recommendations, breakdown } = aiAnalysis;

  // Simulateur interactif de fin de mois
  const [simulatedDailySpend, setSimulatedDailySpend] = useState<number>(
    temporal.dailySurvivalQuota > 0 ? temporal.dailySurvivalQuota : 5000
  );

  const effectiveSimDaily =
    simulatedDailySpend > 0 ? simulatedDailySpend : temporal.dailySurvivalQuota || 1000;
  const daysItWillLast =
    remaining > 0 && effectiveSimDaily > 0
      ? Math.floor(remaining / effectiveSimDaily)
      : 0;
  const projectedBalanceAtPayDay =
    remaining - effectiveSimDaily * temporal.daysUntilPayDay;

  // Exécution des actions correctrices en 1 clic
  const handleExecuteCorrectiveAction = async (rec: AIRecommendation) => {
    if (rec.correctiveActionType === "fit_envelopes_to_balance") {
      if (remaining <= 0) {
        toast.error(
          "Votre solde disponible est à 0 : mettez à 0 les enveloppes non dépensées."
        );
        for (const cat of categories) {
          const norm = cat.name.trim().toLowerCase();
          if (norm === "épargne" || norm === "epargne") continue;
          const spent = getSpentByCategory(transactions, cat.name, monthlySavings);
          if ((Number(cat.amount) || 0) > spent) {
            await updateCategoryAmount(cat.id, spent);
          }
        }
        return;
      }

      // Réduire proportionnellement la portion non dépensée des enveloppes pour qu'elle égale exactement `remaining`
      const ratio =
        temporal.reservedInUnspentEnvelopes > 0
          ? Math.min(1, remaining / temporal.reservedInUnspentEnvelopes)
          : 1;

      let adjustedCount = 0;
      for (const cat of categories) {
        const norm = cat.name.trim().toLowerCase();
        if (norm === "épargne" || norm === "epargne") continue;
        const spent = getSpentByCategory(transactions, cat.name, monthlySavings);
        const budgeted = Number(cat.amount) || 0;
        if (budgeted > spent) {
          const unspentPart = budgeted - spent;
          const newUnspentPart = Math.floor((unspentPart * ratio) / 500) * 500;
          await updateCategoryAmount(cat.id, spent + newUnspentPart);
          adjustedCount++;
        }
      }
      toast.success(
        `${adjustedCount} enveloppe(s) réajustée(s) automatiquement pour correspondre à votre solde réel de ${formatMoney(remaining, currency)} !`
      );
    } else if (
      rec.correctiveActionType === "align_overbudget" &&
      rec.correctivePayload?.categoryName
    ) {
      const catName = rec.correctivePayload.categoryName;
      const targetAmt = rec.correctivePayload.targetAmount || 0;
      const existing = categories.find(
        (c) => c.name.trim().toLowerCase() === catName.trim().toLowerCase()
      );
      if (existing) {
        await updateCategoryAmount(existing.id, targetAmt);
        toast.success(
          `Enveloppe « ${catName} » alignée à ${formatMoney(targetAmt, currency)} dans Mon Budget !`
        );
      } else {
        const uuid =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `cat-${Date.now()}`;
        await addCategory({
          id: uuid,
          name: catName,
          amount: targetAmt,
          color: "bg-rose-500",
        });
        toast.success(
          `Enveloppe « ${catName} » (${formatMoney(targetAmt, currency)}) créée et comptabilisée dans Mon Budget !`
        );
      }
    } else if (rec.correctiveActionType === "create_emergency_fund") {
      const targetEmergency = income > 0 ? income * 3 : 300000;
      await addSavingsGoal({
        name: "Constituer un fonds d'urgence",
        target: targetEmergency,
        color: "bg-emerald-600",
      });
      toast.success(
        `Objectif « Constituer un fonds d'urgence » (${formatMoney(targetEmergency, currency)}) créé dans Épargne !`
      );
    }
  };

  const activeDate = new Date(activeMonth.year, activeMonth.month - 1, 1);
  const formattedMonth = activeDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* En-tête de la page Conseiller IA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 mb-1.5 border border-indigo-200">
            <Brain className="h-3.5 w-3.5 text-indigo-600" />
            <span>Audit multi-pages en temps réel • {formattedMonth}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <span>Conseiller Financier IA</span>
            <Sparkles className="h-6 w-6 text-amber-500" />
          </h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Analyse croisée de votre budget, vos dépenses réelles, votre épargne et vos dettes au jour le jour.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/budget">
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-300">
              <Wallet className="h-4 w-4 text-[#1E3A5F]" />
              <span>Mon Budget</span>
            </Button>
          </Link>
          <Link href="/transactions">
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-300">
              <Activity className="h-4 w-4 text-violet-600" />
              <span>Transactions</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Bandeau Principal : Score + Réalité Temporelle (Jour du mois vs Solde restant) */}
      <Card className="border-none shadow-md bg-gradient-to-br from-[#1E3A5F] via-slate-900 to-indigo-950 text-white overflow-hidden">
        <CardContent className="p-6">
          <div className="grid gap-6 lg:grid-cols-12 items-center">
            {/* Score & Synthèse */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    aiAnalysis.healthScore >= 80
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                      : aiAnalysis.healthScore >= 60
                      ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                      : aiAnalysis.healthScore >= 40
                      ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                      : "bg-red-500/20 text-red-300 border border-red-400/30"
                  }`}
                >
                  Santé financière : {aiAnalysis.healthLabel} ({aiAnalysis.healthScore}/100)
                </div>
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-amber-400" />
                  Jour {temporal.dayOfMonth} sur {temporal.daysInMonth}
                </span>
              </div>

              <p className="text-base md:text-lg font-medium text-slate-100 leading-relaxed">
                {aiAnalysis.summary}
              </p>

              {/* Comparaison Vitesse du temps vs Vitesse des sorties */}
              <div className="space-y-2.5 bg-white/10 p-4 rounded-xl border border-white/10">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Avancement du mois (Jour {temporal.dayOfMonth})</span>
                    <strong className="text-white">{temporal.monthElapsedPercent}% écoulé</strong>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${Math.min(100, temporal.monthElapsedPercent)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">
                      Revenus déjà sortis (Dépenses + Épargne)
                    </span>
                    <strong
                      className={
                        temporal.outflowPercentOfIncome > temporal.monthElapsedPercent + 25
                          ? "text-amber-300"
                          : "text-emerald-300"
                      }
                    >
                      {temporal.outflowPercentOfIncome}% sortis ({formatMoney(temporal.totalOutflows, currency)})
                    </strong>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        temporal.burnRateStatus === "critical"
                          ? "bg-red-400"
                          : temporal.burnRateStatus === "warning"
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`}
                      style={{ width: `${Math.min(100, temporal.outflowPercentOfIncome)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Chiffres Clés de Survie Jusqu'à la Paie */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white/10 border border-white/10">
                <span className="text-[11px] text-slate-300 block">Solde réel restant</span>
                <div className="text-lg md:text-xl font-black text-emerald-300 mt-1">
                  {formatMoney(remaining, currency)}
                </div>
                <span className="text-[10px] text-slate-400">En caisse aujourd&apos;hui</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/10 border border-white/10">
                <span className="text-[11px] text-slate-300 block">Plafond / jour conseillé</span>
                <div className="text-lg md:text-xl font-black text-amber-300 mt-1">
                  {formatMoney(temporal.dailySurvivalQuota, currency)}/j
                </div>
                <span className="text-[10px] text-slate-400">
                  Sur {temporal.daysUntilPayDay} jours restants
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/10 border border-white/10">
                <span className="text-[11px] text-slate-300 block">Enveloppes à venir</span>
                <div className="text-lg md:text-xl font-black text-white mt-1">
                  {formatMoney(temporal.reservedInUnspentEnvelopes, currency)}
                </div>
                <span className="text-[10px] text-slate-400">Prévus non dépensés</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/10 border border-white/10">
                <span className="text-[11px] text-slate-300 block">Écarts / Non prévus</span>
                <div
                  className={`text-lg md:text-xl font-black mt-1 ${
                    temporal.unplannedOrExceededTotal > 0 ? "text-rose-300" : "text-emerald-300"
                  }`}
                >
                  {formatMoney(temporal.unplannedOrExceededTotal, currency)}
                </div>
                <span className="text-[10px] text-slate-400">Dépassements du mois</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 1 : Constats en Temps Réel (Ce que le Conseiller IA voit dans vos pages) */}
      <Card className="border border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            Constats du Conseiller sur votre situation actuelle (Jour {temporal.dayOfMonth})
          </CardTitle>
          <CardDescription>
            Observations automatiques basées sur la comparaison entre Mon Budget, Transactions, Épargne et Dettes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {findings.map((finding) => {
            const isCrit = finding.severity === "critical";
            const isWarn = finding.severity === "warning";
            const isPos = finding.severity === "positive";

            return (
              <div
                key={finding.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                  isCrit
                    ? "bg-red-50/70 border-red-200"
                    : isWarn
                    ? "bg-amber-50/70 border-amber-200"
                    : isPos
                    ? "bg-emerald-50/70 border-emerald-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isCrit ? (
                        <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
                      ) : isWarn ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          isCrit
                            ? "text-red-700"
                            : isWarn
                            ? "text-amber-800"
                            : "text-emerald-800"
                        }`}
                      >
                        {isCrit ? "Alerte Réalité" : isWarn ? "Point de vigilance" : "Point positif"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {finding.sourcePages.map((page) => (
                        <span
                          key={page}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 text-slate-700 border border-slate-200"
                        >
                          {page}
                        </span>
                      ))}
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm md:text-base">
                    {finding.title}
                  </h4>
                  <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                    {finding.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Section 2 : Conseils & Actions Correctrices en 1 Clic */}
      <Card className="border border-indigo-200/80 shadow-xs bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-emerald-600" />
            Plan d&apos;Actions Correctrices & Conseils Personnalisés ({recommendations.length})
          </CardTitle>
          <CardDescription>
            Appliquez directement les corrections suggérées en 1 clic ou accédez à la page concernée.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                rec.priority === "high"
                  ? "bg-red-50/50 border-red-200"
                  : rec.priority === "medium"
                  ? "bg-amber-50/50 border-amber-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      rec.priority === "high"
                        ? "bg-red-100 text-red-700"
                        : rec.priority === "medium"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {rec.priority === "high"
                      ? "Action urgente"
                      : rec.priority === "medium"
                      ? "Conseil important"
                      : "Optimisation"}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm md:text-base">
                    {rec.title}
                  </h4>
                </div>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                  {rec.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {rec.correctiveActionType && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleExecuteCorrectiveAction(rec)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>{rec.actionLabel || "Appliquer la correction"}</span>
                  </Button>
                )}

                {rec.actionHref && (
                  <Link href={rec.actionHref}>
                    <Button
                      type="button"
                      variant={rec.correctiveActionType ? "outline" : "default"}
                      size="sm"
                      className={
                        rec.correctiveActionType
                          ? "text-xs border-slate-300"
                          : "bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs gap-1"
                      }
                    >
                      <span>{rec.correctiveActionType ? "Voir la page" : rec.actionLabel || "Ouvrir"}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section 3 : Simulateur de Fin de Mois + Répartition des Masses */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Simulateur interactif de survie de trésorerie */}
        <Card className="border border-slate-200 shadow-xs bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[#1E3A5F]" />
              Simulateur de Fin de Mois (sur vos {formatMoney(remaining, currency)} restants)
            </CardTitle>
            <CardDescription className="text-xs">
              Testez votre rythme de dépense journalier pour voir combien de jours votre solde tiendra.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Si je dépense chaque jour ({currency}/jour) :
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={500}
                  step={500}
                  value={simulatedDailySpend || ""}
                  onChange={(e) => setSimulatedDailySpend(Number(e.target.value) || 0)}
                  className="font-bold text-slate-900"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSimulatedDailySpend(temporal.dailySurvivalQuota)}
                  className="text-xs shrink-0"
                >
                  Quota idéal ({formatMoney(temporal.dailySurvivalQuota, currency)})
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Autonomie de votre caisse à ce rythme :</span>
                <strong
                  className={`text-sm ${
                    daysItWillLast < temporal.daysUntilPayDay
                      ? "text-red-600"
                      : "text-emerald-600"
                  }`}
                >
                  {daysItWillLast} jour(s) (besoin : {temporal.daysUntilPayDay} jours)
                </strong>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-600">Solde estimé au jour de paie (le {payDay || 28}) :</span>
                <strong
                  className={`text-sm ${
                    projectedBalanceAtPayDay < 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {formatMoney(projectedBalanceAtPayDay, currency)}
                </strong>
              </div>

              {projectedBalanceAtPayDay < 0 ? (
                <p className="text-red-600 font-medium pt-1">
                  ⚠️ À {formatMoney(effectiveSimDaily, currency)}/jour, votre caisse sera épuisée dans {daysItWillLast} jours (soit {temporal.daysUntilPayDay - daysItWillLast} jours avant la paie). Réduisez à {formatMoney(temporal.dailySurvivalQuota, currency)}/jour maximum.
                </p>
              ) : (
                <p className="text-emerald-700 font-medium pt-1">
                  ✅ À {formatMoney(effectiveSimDaily, currency)}/jour, vous tenez jusqu&apos;à la paie avec {formatMoney(projectedBalanceAtPayDay, currency)} de réserve !
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Répartition de vos grandes masses financières */}
        <Card className="border border-slate-200 shadow-xs bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-emerald-600" />
              Diagnostic de vos Habitudes du Mois (% du revenu)
            </CardTitle>
            <CardDescription className="text-xs">
              Répartition actuelle de vos {formatMoney(income, currency)} d&apos;entrées du mois.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 block">Besoins vitaux</span>
              <strong className="text-lg font-extrabold text-slate-900">
                {breakdown.essentialsPercent}%
              </strong>
              <span className="text-[11px] text-slate-400 block">Norme conseillée : ≤ 55%</span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-emerald-800 block flex items-center gap-1">
                <PiggyBank className="h-3.5 w-3.5" /> Épargne du mois
              </span>
              <strong className="text-lg font-extrabold text-emerald-700">
                {breakdown.savingsPercent}%
              </strong>
              <span className="text-[11px] text-emerald-600 block">
                {formatMoney(monthlySavings, currency)} mis de côté
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
              <span className="text-amber-900 block">Solidarité & Dîmes</span>
              <strong className="text-lg font-extrabold text-amber-800">
                {breakdown.solidarityAndTithePercent}%
              </strong>
              <span className="text-[11px] text-amber-700 block">Norme conseillée : 10% - 20%</span>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
              <span className="text-rose-900 block flex items-center gap-1">
                <HandCoins className="h-3.5 w-3.5" /> Loisirs & Dettes
              </span>
              <strong className="text-lg font-extrabold text-rose-700">
                {breakdown.leisurePercent}% / {breakdown.debtRatioPercent}%
              </strong>
              <span className="text-[11px] text-rose-600 block">Loisirs / Endettement</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

