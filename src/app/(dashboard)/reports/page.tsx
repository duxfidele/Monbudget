"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Wallet,
  TrendingDown,
  PiggyBank,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  FileText,
  FileSpreadsheet,
  Layers,
  Receipt,
  HandCoins,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportMonthlyReportCSV,
  exportMonthlyReportPDF,
  buildUnifiedIncomeBreakdown,
} from "@/lib/utils/report-export";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useUIStore } from "@/lib/store/ui-store";
import { PlanGate } from "@/components/payments/plan-gate";
import {
  formatMoney,
  getTotalExpenses,
  getRemainingToLive,
  getSpentByCategory,
  isExpenseTransaction,
  isIncomeTransaction,
  getMonthlySavingsContributions,
  getTotalPayableDebts,
  getTotalReceivableDebts,
  generateFinancialAIAnalysis,
} from "@/lib/utils/budget-calc";
import { createClient } from "@/lib/supabase/client";

const PIE_COLORS = [
  "#3B82F6", // Bleu
  "#10B981", // Émeraude
  "#F59E0B", // Ambre
  "#EF4444", // Rouge
  "#8B5CF6", // Violet
  "#EC4899", // Rose
  "#06B6D4", // Cyan
  "#64748B", // Slate
];

interface MonthlyHistoryItem {
  month: string;
  revenus: number;
  depenses: number;
  epargne: number;
}

export default function ReportsPage() {
  const {
    transactions,
    categories,
    income,
    incomeEntries,
    savingsGoals,
    debts,
    currency,
    activeMonth,
    payDay,
  } = useUIStore();
  const [mounted, setMounted] = useState(false);
  const [historyData, setHistoryData] = useState<MonthlyHistoryItem[]>([]);

  const supabase = createClient();

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      if (active) setMounted(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          return;
        }

        const { data: budgets } = await supabase
          .from("monthly_budgets")
          .select(
            `
          id,
          year,
          month,
          income_entries(amount),
          transactions(amount, type)
        `
          )
          .eq("user_id", user.id)
          .order("year", { ascending: true })
          .order("month", { ascending: true });

        if (!active) return;

        if (budgets && budgets.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: MonthlyHistoryItem[] = budgets.map((b: any) => {
            const monthDate = new Date(b.year, b.month - 1, 1);
            const monthLabel = monthDate.toLocaleDateString("fr-FR", { month: "short" });
            const capitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

            const addIncome = (b.transactions || [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((t: any) => isIncomeTransaction(t))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .reduce((s: number, t: any) => s + Number(t.amount), 0);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let mIncome = (b.income_entries || []).reduce((s: number, i: any) => s + Number(i.amount), 0) + addIncome;
            let mExpenses = (b.transactions || [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((t: any) => isExpenseTransaction(t))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .reduce((s: number, t: any) => s + Number(t.amount), 0);

            let mSavings = Math.max(0, mIncome - mExpenses);
            if (b.year === activeMonth.year && b.month === activeMonth.month) {
              mIncome = income;
              mSavings = getMonthlySavingsContributions(
                savingsGoals,
                activeMonth.year,
                activeMonth.month
              );
              mExpenses = getTotalExpenses(transactions, mSavings);
            }

            return {
              month: capitalized,
              revenus: mIncome,
              depenses: mExpenses,
              epargne: mSavings,
            };
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasActiveMonth = budgets.some((b: any) => b.year === activeMonth.year && b.month === activeMonth.month);
          if (!hasActiveMonth) {
            const curDate = new Date(activeMonth.year, activeMonth.month - 1, 1);
            const curLabel = curDate.toLocaleDateString("fr-FR", { month: "short" });
            const curSavings = getMonthlySavingsContributions(
              savingsGoals,
              activeMonth.year,
              activeMonth.month
            );
            const curExpenses = getTotalExpenses(transactions, curSavings);
            mapped.push({
              month: curLabel.charAt(0).toUpperCase() + curLabel.slice(1),
              revenus: income,
              depenses: curExpenses,
              epargne: curSavings,
            });
          }

          setHistoryData(mapped);
        } else {
          const curDate = new Date(activeMonth.year, activeMonth.month - 1, 1);
          const curLabel = curDate.toLocaleDateString("fr-FR", { month: "short" });
          const curSavings = getMonthlySavingsContributions(
            savingsGoals,
            activeMonth.year,
            activeMonth.month
          );
          const curExpenses = getTotalExpenses(transactions, curSavings);
          setHistoryData([
            {
              month: curLabel.charAt(0).toUpperCase() + curLabel.slice(1),
              revenus: income,
              depenses: curExpenses,
              epargne: curSavings,
            },
          ]);
        }
      } catch (e) {
        console.error("Error fetching history", e);
      }
    };

    void loadHistory();
    return () => {
      active = false;
    };
  }, [activeMonth, income, transactions, savingsGoals, supabase]);

  // Ventilation exacte du Revenu Réel (Salaire / Sources déclarées + Revenus supplémentaires en transactions)
  const incomeBreakdown = buildUnifiedIncomeBreakdown(income, incomeEntries, transactions);
  const realIncome = incomeBreakdown.totalRealIncome;

  // Calculs actuels pour le mois sélectionné (100% concordants avec Dashboard & PDF)
  const monthlySavings = getMonthlySavingsContributions(
    savingsGoals,
    activeMonth.year,
    activeMonth.month
  );
  const totalExpenses = getTotalExpenses(transactions, monthlySavings);
  const directExpensesOnly = Math.max(0, totalExpenses - monthlySavings);
  const totalSavingsAllTime = savingsGoals.reduce((sum, g) => sum + (Number(g.current) || 0), 0);
  const resteAVivre = getRemainingToLive(realIncome, totalExpenses);
  const payableDebts = getTotalPayableDebts(debts);
  const receivableDebts = getTotalReceivableDebts(debts);

  // Taux financiers concordants
  const tauxEpargne = realIncome > 0 ? (monthlySavings / realIncome) * 100 : 0;
  const tauxDepense = realIncome > 0 ? (totalExpenses / realIncome) * 100 : 0;

  // Intelligence Artificielle Financière (Pilier F)
  const aiAnalysis = generateFinancialAIAnalysis({
    income: realIncome,
    incomeSourcesCount: Math.max(1, incomeBreakdown.allItems.length),
    transactions,
    categories,
    savingsGoals,
    debts,
    monthlySavings,
    currency,
    payDay: payDay || 28,
  });

  // Toutes les enveloppes budgétaires (pour le tableau complet identique au PDF)
  const allEnvelopeRows = categories.map((cat, idx) => {
    const spent = getSpentByCategory(transactions, cat.name);
    const allocated = Number(cat.amount) || 0;
    const diff = allocated - spent;
    const pctConsumed = allocated > 0 ? Math.round((spent / allocated) * 100) : spent > 0 ? 100 : 0;
    return {
      id: cat.id || `env-${idx}`,
      name: cat.name,
      allocated,
      spent,
      diff,
      pctConsumed,
      color: PIE_COLORS[idx % PIE_COLORS.length],
      shareOfTotalExpenses: totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0,
    };
  });

  const totalAllocatedEnvelopes = allEnvelopeRows.reduce((s, r) => s + r.allocated, 0);
  const totalSpentEnvelopes = allEnvelopeRows.reduce((s, r) => s + r.spent, 0);
  const totalDiffEnvelopes = totalAllocatedEnvelopes - totalSpentEnvelopes;
  const totalPctEnvelopes =
    totalAllocatedEnvelopes > 0
      ? Math.round((totalSpentEnvelopes / totalAllocatedEnvelopes) * 100)
      : 0;

  // Répartition par catégorie ayant des dépenses (pour le graphique Camembert & Top 3)
  const categoryStats = allEnvelopeRows
    .filter((cat) => cat.spent > 0)
    .map((cat) => ({
      name: cat.name,
      value: cat.spent,
      allocated: cat.allocated,
      color: cat.color,
      percent: cat.shareOfTotalExpenses,
    }))
    .sort((a, b) => b.value - a.value);

  const top3Categories = categoryStats.slice(0, 3);

  // Transactions triées par date décroissante
  const sortedTransactions = [...transactions].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );

  // Month date formatted
  const activeDate = new Date(activeMonth.year, activeMonth.month - 1, 1);
  const monthName = activeDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const handleDownloadPDF = () => {
    exportMonthlyReportPDF({
      monthLabel: capitalizedMonth,
      year: activeMonth.year,
      month: activeMonth.month,
      currency,
      income: realIncome,
      incomeEntries,
      categories,
      transactions,
      savingsGoals,
      debts,
    });
    toast.success(`Rapport PDF (${capitalizedMonth}) généré avec succès !`);
  };

  const handleDownloadCSV = () => {
    exportMonthlyReportCSV({
      monthLabel: capitalizedMonth,
      year: activeMonth.year,
      month: activeMonth.month,
      currency,
      income: realIncome,
      incomeEntries,
      categories,
      transactions,
      savingsGoals,
      debts,
    });
    toast.success(`Rapport Excel / CSV (${capitalizedMonth}) téléchargé !`);
  };

  if (!mounted) {
    return (
      <div className="flex flex-col gap-8 pb-12 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-md w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="h-64 bg-slate-100 rounded-xl" />
          <div className="h-64 bg-slate-100 rounded-xl" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <PlanGate
      feature="reports"
      featureTitle="Rapports Financiers & Exports PDF/CSV"
      featureDescription="Analysez l'évolution de vos revenus, dépenses et épargne sur plusieurs mois et téléchargez vos bilans officiels en PDF et Excel/CSV."
    >
      <div className="flex flex-col gap-6 sm:gap-8 pb-12">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-sky-950/60 text-[#1E3A5F] dark:text-sky-300 mb-1 border border-blue-100 dark:border-sky-800/60">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Analyses Financières Avancées</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Rapports & Tendances
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">
              Bilan intégral de votre salaire, revenus supplémentaires, dépenses et épargne (
              {capitalizedMonth}).
            </p>
          </div>

          {/* Boutons de Téléchargement des Rapports */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <Button
              onClick={handleDownloadPDF}
              className="bg-[#1E3A5F] hover:bg-[#162d4b] text-white shadow-sm flex-1 sm:flex-initial text-xs sm:text-sm h-10 font-bold"
            >
              <FileText className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span>Rapport PDF</span>
            </Button>
            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              className="border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 flex-1 sm:flex-initial text-xs sm:text-sm h-10 font-bold"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5 sm:mr-2 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* 1. Cartes KPI : Les 4 Piliers Financiers Complets (2x2 sur mobile, 4 colonnes sur desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Pilier 1 : Revenu Total Réel (Salaire + Revenus supplémentaires) */}
          <Card
            data-testid="report-kpi-total-income"
            className="min-w-0 shadow-sm bg-gradient-to-br from-[#1E3A5F] to-[#162d4b] text-white border border-[#1E3A5F]"
          >
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-sky-200 truncate">
                Revenu Total Réel
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-emerald-500/20 rounded-lg shrink-0 border border-emerald-400/30">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-300" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div
                suppressHydrationWarning
                className="text-lg sm:text-2xl font-extrabold text-white truncate"
              >
                {formatMoney(realIncome, currency)}
              </div>
              <div className="mt-2 pt-2 border-t border-white/15 space-y-0.5 text-[10px] sm:text-xs text-slate-200">
                <div className="flex items-center justify-between gap-1 truncate">
                  <span className="text-slate-300 truncate">Salaire / Fixe :</span>
                  <strong className="text-white shrink-0">
                    {formatMoney(incomeBreakdown.baseSalaryTotal, currency)}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-1 truncate">
                  <span className="text-emerald-300 truncate">Suppléments :</span>
                  <strong className="text-emerald-300 shrink-0">
                    +{formatMoney(incomeBreakdown.additionalIncomeTotal, currency)}
                  </strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pilier 2 : Dépenses Totales Engagées */}
          <Card
            data-testid="report-kpi-total-expenses"
            className="min-w-0 shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
          >
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Dépenses Engagées
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-950/50 rounded-lg shrink-0">
                <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div className="flex items-baseline justify-between gap-1">
                <div
                  suppressHydrationWarning
                  className="text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 truncate"
                >
                  {formatMoney(totalExpenses, currency)}
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-red-600 dark:text-red-400 shrink-0">
                  {Math.round(tauxDepense)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${tauxDepense > 85 ? "bg-red-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(tauxDepense, 100)}%` }}
                />
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1.5 truncate">
                Sorties : {formatMoney(directExpensesOnly, currency)} • Épargne :{" "}
                {formatMoney(monthlySavings, currency)}
              </p>
            </CardContent>
          </Card>

          {/* Pilier 3 : Solde Net Disponible (Reste après transactions) */}
          <Card
            data-testid="report-kpi-remaining"
            className="min-w-0 shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
          >
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Disponible (Reste)
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-sky-100 dark:bg-sky-950/50 rounded-lg shrink-0">
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 dark:text-sky-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div
                suppressHydrationWarning
                className={`text-lg sm:text-2xl font-extrabold truncate ${
                  resteAVivre < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {formatMoney(resteAVivre, currency)}
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 truncate">
                {resteAVivre >= 0
                  ? `${Math.max(0, Math.round(100 - tauxDepense))}% du revenu réel en caisse`
                  : "Dépassement budgétaire"}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                Revenu ({formatMoney(realIncome, currency)}) - Sorties (
                {formatMoney(totalExpenses, currency)})
              </p>
            </CardContent>
          </Card>

          {/* Pilier 4 : Taux d'Épargne & Cagnottes */}
          <Card
            data-testid="report-kpi-savings"
            className="min-w-0 shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
          >
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Épargne du Mois
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg shrink-0">
                <PiggyBank className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div className="flex items-baseline justify-between gap-1">
                <div
                  suppressHydrationWarning
                  className="text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 truncate"
                >
                  {formatMoney(monthlySavings, currency)}
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  {Math.round(tauxEpargne)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(tauxEpargne, 100)}%` }}
                />
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1.5 truncate">
                Cumul global : {formatMoney(totalSavingsAllTime, currency)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2. Section Détail Complet du Revenu Réel (Salaire + Revenus supplémentaires) */}
        <Card
          data-testid="report-income-breakdown-card"
          className="shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
        >
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                  <HandCoins className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Détail du Revenu Réel ({capitalizedMonth})
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Ventilation complète entre votre salaire de base et vos revenus supplémentaires
                  saisis ce mois
                </CardDescription>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold self-start sm:self-auto">
                <span>Total Revenu Réel :</span>
                <span suppressHydrationWarning>{formatMoney(realIncome, currency)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bandeau formule Salaire + Revenus supplémentaires = Revenu Réel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  1. Salaire & Sources fixes
                </p>
                <p
                  suppressHydrationWarning
                  className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-0.5"
                >
                  {formatMoney(incomeBreakdown.baseSalaryTotal, currency)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {incomeBreakdown.declaredItems.length} source(s) déclarée(s)
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200/70 dark:border-emerald-900/50">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  2. + Revenus supplémentaires
                </p>
                <p
                  suppressHydrationWarning
                  className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5"
                >
                  +{formatMoney(incomeBreakdown.additionalIncomeTotal, currency)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {incomeBreakdown.transactionItems.length} entrée(s) additionnelle(s)
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#1E3A5F] text-white">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-200">
                  3. = Revenu Réel Total
                </p>
                <p
                  suppressHydrationWarning
                  className="text-base sm:text-lg font-extrabold text-white mt-0.5"
                >
                  {formatMoney(realIncome, currency)}
                </p>
                <p className="text-[11px] text-sky-200">
                  Reste après transactions : {formatMoney(resteAVivre, currency)}
                </p>
              </div>
            </div>

            {/* Tableau détaillé de toutes les entrées de revenus */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3 font-bold">Origine</th>
                    <th className="py-2.5 px-3 font-bold">Catégorie</th>
                    <th className="py-2.5 px-3 font-bold">Libellé</th>
                    <th className="py-2.5 px-3 font-bold hidden sm:table-cell">Date</th>
                    <th className="py-2.5 px-3 font-bold text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {incomeBreakdown.allItems.length > 0 ? (
                    incomeBreakdown.allItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              item.origin === "declared"
                                ? "bg-blue-50 text-[#1E3A5F] dark:bg-sky-950/60 dark:text-sky-300"
                                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            }`}
                          >
                            {item.originLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                          {item.sourceType}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-semibold">
                          {item.label}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                          {item.date}
                        </td>
                        <td
                          suppressHydrationWarning
                          className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap"
                        >
                          +{formatMoney(item.amount, currency)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-slate-400 dark:text-slate-500"
                      >
                        Aucun revenu enregistré pour ce mois.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 font-bold text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                    <td colSpan={3} className="py-3 px-3">
                      TOTAL REVENU RÉEL DU MOIS (Salaire + Revenus supplémentaires)
                    </td>
                    <td className="py-3 px-3 hidden sm:table-cell text-slate-500 dark:text-slate-400">
                      {capitalizedMonth}
                    </td>
                    <td
                      suppressHydrationWarning
                      className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-400 text-sm sm:text-base whitespace-nowrap"
                    >
                      {formatMoney(realIncome, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 3. Grand Tableau : Suivi & Performance des Enveloppes Budgétaires (identique au PDF) */}
        <Card
          data-testid="report-envelopes-table-card"
          className="shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
        >
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                  <Layers className="h-5 w-5 text-[#1E3A5F] dark:text-sky-400" />
                  Bilan & Performance des Enveloppes Budgétaires
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Comparatif détaillé entre le budget prévu, les dépenses réelles et le reste par
                  poste
                </CardDescription>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold self-start sm:self-auto">
                <PieIcon className="h-3.5 w-3.5" />
                <span>
                  Postes actifs : {categoryStats.length} / {categories.length}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3 font-bold">Catégorie</th>
                    <th className="py-2.5 px-3 font-bold text-right">Budget Alloué</th>
                    <th className="py-2.5 px-3 font-bold text-right">Dépensé Réel</th>
                    <th className="py-2.5 px-3 font-bold text-right">Reste Disponible</th>
                    <th className="py-2.5 px-3 font-bold w-40 sm:w-48">Consommation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {allEnvelopeRows.map((row) => {
                    const isOver = row.diff < 0;
                    const isWarning = !isOver && row.pctConsumed >= 85;
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: row.color }}
                            />
                            <span className="truncate">{row.name}</span>
                          </div>
                        </td>
                        <td
                          suppressHydrationWarning
                          className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap"
                        >
                          {formatMoney(row.allocated, currency)}
                        </td>
                        <td
                          suppressHydrationWarning
                          className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap"
                        >
                          {formatMoney(row.spent, currency)}
                        </td>
                        <td
                          suppressHydrationWarning
                          className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                            isOver
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatMoney(row.diff, currency)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden min-w-[60px]">
                              <div
                                className={`h-full rounded-full ${
                                  isOver
                                    ? "bg-red-500"
                                    : isWarning
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(row.pctConsumed, 100)}%` }}
                              />
                            </div>
                            <span
                              className={`text-xs font-bold w-10 text-right shrink-0 ${
                                isOver
                                  ? "text-red-600 dark:text-red-400"
                                  : isWarning
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-slate-600 dark:text-slate-300"
                              }`}
                            >
                              {row.pctConsumed}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 font-bold text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                    <td className="py-3 px-3">TOTAL DES ENVELOPPES</td>
                    <td suppressHydrationWarning className="py-3 px-3 text-right whitespace-nowrap">
                      {formatMoney(totalAllocatedEnvelopes, currency)}
                    </td>
                    <td suppressHydrationWarning className="py-3 px-3 text-right whitespace-nowrap">
                      {formatMoney(totalSpentEnvelopes, currency)}
                    </td>
                    <td
                      suppressHydrationWarning
                      className={`py-3 px-3 text-right whitespace-nowrap ${
                        totalDiffEnvelopes < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {formatMoney(totalDiffEnvelopes, currency)}
                    </td>
                    <td className="py-3 px-3 text-right">{totalPctEnvelopes}% consommé</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 4. Graphiques Principaux */}
        <div className="grid gap-6 lg:grid-cols-7">
          {/* Graphique 1 : Évolution Revenus vs Dépenses (4 colonnes) */}
          <Card className="lg:col-span-4 min-w-0 shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                    <BarChart3 className="h-5 w-5 text-[#1E3A5F] dark:text-sky-400" />
                    Revenus vs Dépenses Réelles
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Comparatif mensuel de vos flux financiers
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[320px] w-full pt-2 sm:pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={historyData}
                    margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                  >
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis
                      width={36}
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                    />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [formatMoney(Number(value), currency), ""]}
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderRadius: "12px",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: "12px", fontSize: "11px" }}
                    />
                    <Bar
                      dataKey="revenus"
                      name="Revenus"
                      fill="#1E3A5F"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      dataKey="depenses"
                      name="Dépenses"
                      fill="#EF4444"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Graphique 2 : Répartition des Dépenses (3 colonnes) */}
          <Card className="lg:col-span-3 min-w-0 shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                <PieIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Répartition des Dépenses
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Part de chaque catégorie ce mois-ci
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              {categoryStats.length > 0 ? (
                <div className="h-[220px] sm:h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryStats}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {categoryStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(val: any) => [formatMoney(Number(val), currency), ""]}
                        contentStyle={{
                          backgroundColor: "#0F172A",
                          borderRadius: "10px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Aucune dépense enregistrée pour le mois de {capitalizedMonth}.
                </div>
              )}

              {/* Légende rapide */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
                {categoryStats.slice(0, 4).map((cat, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 truncate"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">
                      {cat.name} : {Math.round(cat.percent)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 5. Journal des Transactions du Mois & Synthèse Épargne / Dettes */}
        <div className="grid gap-6 lg:grid-cols-7">
          {/* Journal des Transactions du mois (4 colonnes) */}
          <Card
            data-testid="report-transactions-card"
            className="lg:col-span-4 min-w-0 shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                    <Receipt className="h-5 w-5 text-[#1E3A5F] dark:text-sky-400" />
                    Transactions du Mois ({sortedTransactions.length})
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Toutes vos opérations enregistrées (revenus supplémentaires et dépenses)
                  </CardDescription>
                </div>
                <Link href="/transactions">
                  <Button variant="outline" size="sm" className="text-xs h-8">
                    Tout voir
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {sortedTransactions.length > 0 ? (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {sortedTransactions.map((tx) => {
                    const isInc = isIncomeTransaction(tx);
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
                              isInc
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {isInc ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                              {tx.label}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {isInc ? "Revenu supplémentaire" : tx.category || "Autre"} •{" "}
                              {tx.date}
                            </p>
                          </div>
                        </div>
                        <div
                          suppressHydrationWarning
                          className={`font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                            isInc
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {isInc ? "+" : "-"}
                          {formatMoney(tx.amount, currency)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-sm">
                  Aucune transaction saisie pour {capitalizedMonth}.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Synthèse Objectifs d'Épargne & Dettes / Créances (3 colonnes) */}
          <Card
            data-testid="report-savings-debts-card"
            className="lg:col-span-3 min-w-0 shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                <PiggyBank className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Cagnottes d&apos;Épargne & Dettes
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                État de vos objectifs d&apos;épargne et engagements financiers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Liste des Objectifs d'Épargne */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Objectifs d&apos;Épargne ({savingsGoals.length})
                </p>
                {savingsGoals.length > 0 ? (
                  savingsGoals.map((goal) => {
                    const pct =
                      goal.target > 0
                        ? Math.min(100, Math.round((goal.current / goal.target) * 100))
                        : 0;
                    return (
                      <div
                        key={goal.id}
                        className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {goal.name}
                          </span>
                          <span
                            suppressHydrationWarning
                            className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0"
                          >
                            {formatMoney(goal.current, currency)} /{" "}
                            {formatMoney(goal.target, currency)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400">Aucun objectif d&apos;épargne configuré.</p>
                )}
              </div>

              {/* Synthèse Dettes & Créances */}
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Dettes & Créances
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/50">
                    <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                      Je dois (Dettes)
                    </p>
                    <p
                      suppressHydrationWarning
                      className="text-sm font-extrabold text-rose-700 dark:text-rose-400 mt-0.5"
                    >
                      {formatMoney(payableDebts, currency)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50">
                    <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      On me doit (Créances)
                    </p>
                    <p
                      suppressHydrationWarning
                      className="text-sm font-extrabold text-amber-700 dark:text-amber-400 mt-0.5"
                    >
                      {formatMoney(receivableDebts, currency)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 6. Section Insights & Top Postes de Dépenses */}
        <div className="grid gap-6 md:grid-cols-7">
          {/* Top 3 Postes */}
          <Card className="md:col-span-4 min-w-0 shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                <Award className="h-5 w-5 text-amber-500" />
                Top Postes de Dépenses ({capitalizedMonth})
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Les postes qui consomment le plus votre revenu ce mois
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {top3Categories.map((cat, index) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] text-white flex items-center justify-center font-bold text-sm shrink-0">
                      #{index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                        {cat.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        Plafond alloué : {formatMoney(cat.allocated, currency)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white whitespace-nowrap">
                      {formatMoney(cat.value, currency)}
                    </p>
                    <p className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium">
                      {Math.round(cat.percent)}% des sorties
                    </p>
                  </div>
                </div>
              ))}

              {top3Categories.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Pas assez de données pour établir le classement.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Carte de Synthèse & Analyse des Habitudes Financières */}
          <Card className="md:col-span-3 min-w-0 border-none shadow-sm bg-gradient-to-br from-[#1E3A5F] to-[#254673] text-white">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <Sparkles className="h-5 w-5 text-amber-300 shrink-0" />
                  Diagnostic Habitudes (IA)
                </CardTitle>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30 shrink-0">
                  Score : {aiAnalysis.healthScore}/100 ({aiAnalysis.healthLabel})
                </span>
              </div>
              <CardDescription className="text-slate-200">
                Répartition de vos habitudes financières sur vos revenus
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200 leading-relaxed">
              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Besoins essentiels (cible ≤ 60%)</span>
                    <span className="font-bold text-white">
                      {aiAnalysis.breakdown.essentialsPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-400 h-full rounded-full"
                      style={{
                        width: `${Math.min(aiAnalysis.breakdown.essentialsPercent, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Famille, Solidarité & Dîmes (cible ≤ 20%)</span>
                    <span className="font-bold text-white">
                      {aiAnalysis.breakdown.solidarityAndTithePercent}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full"
                      style={{
                        width: `${Math.min(
                          aiAnalysis.breakdown.solidarityAndTithePercent,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Épargne mensuelle (cible ≥ 10%)</span>
                    <span className="font-bold text-emerald-300">
                      {aiAnalysis.breakdown.savingsPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full"
                      style={{ width: `${Math.min(aiAnalysis.breakdown.savingsPercent, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>
                      Loisirs ({aiAnalysis.breakdown.leisurePercent}%) & Ratio Dettes (
                      {aiAnalysis.breakdown.debtRatioPercent}%)
                    </span>
                    <span className="font-bold text-rose-300">
                      {aiAnalysis.breakdown.debtRatioPercent}% dettes
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-400 h-full rounded-full"
                      style={{
                        width: `${Math.min(aiAnalysis.breakdown.debtRatioPercent, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Passerelle vers la page dédiée Conseiller IA */}
        <Card className="border border-indigo-200 dark:border-indigo-900/60 shadow-sm bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/60 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-sky-300">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Conseiller Financier IA dédié</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Consultez vos constats en temps réel et actions correctrices
              </h3>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                {aiAnalysis.summary}
              </p>
            </div>
            <Link href="/advisor" className="shrink-0">
              <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold gap-1.5 shadow-xs">
                <span>Ouvrir le Conseiller IA</span>
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </PlanGate>
  );
}
