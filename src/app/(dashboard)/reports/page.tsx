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
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { exportMonthlyReportCSV, exportMonthlyReportPDF } from "@/lib/utils/report-export";
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
  AreaChart,
  Area
} from "recharts";
import { useUIStore } from "@/lib/store/ui-store";
import {
  formatMoney,
  getTotalExpenses,
  getRemainingToLive,
  getSpentByCategory,
  isExpenseTransaction,
  isIncomeTransaction,
  getMonthlySavingsContributions,
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
  const { transactions, categories, income, incomeEntries, savingsGoals, debts, currency, activeMonth, payDay } = useUIStore();
  const [mounted, setMounted] = useState(false);
  const [historyData, setHistoryData] = useState<MonthlyHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth, income, transactions, savingsGoals]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoadingHistory(false);
        return;
      }

      // Fetch all monthly budgets with their incomes and transactions
      const { data: budgets } = await supabase
        .from("monthly_budgets")
        .select(`
          id,
          year,
          month,
          income_entries(amount),
          transactions(amount, type)
        `)
        .eq("user_id", user.id)
        .order("year", { ascending: true })
        .order("month", { ascending: true });

      if (budgets && budgets.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: MonthlyHistoryItem[] = budgets.map((b: any) => {
          const monthDate = new Date(b.year, b.month - 1, 1);
          const monthLabel = monthDate.toLocaleDateString("fr-FR", { month: "short" });
          const capitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

          const addIncome = (b.transactions || [])
            .filter((t: any) => isIncomeTransaction(t))
            .reduce((s: number, t: any) => s + Number(t.amount), 0);
          let mIncome = (b.income_entries || []).reduce((s: number, i: any) => s + Number(i.amount), 0) + addIncome;
          let mExpenses = (b.transactions || [])
            .filter((t: any) => isExpenseTransaction(t))
            .reduce((s: number, t: any) => s + Number(t.amount), 0);

          // Synchronisation exacte si mois actif
          let mSavings = Math.max(0, mIncome - mExpenses);
          if (b.year === activeMonth.year && b.month === activeMonth.month) {
            mIncome = income;
            mExpenses = getTotalExpenses(transactions);
            mSavings = getMonthlySavingsContributions(savingsGoals, activeMonth.year, activeMonth.month);
          }

          return {
            month: capitalized,
            revenus: mIncome,
            depenses: mExpenses,
            epargne: mSavings,
          };
        });

        const hasActiveMonth = budgets.some((b: any) => b.year === activeMonth.year && b.month === activeMonth.month);
        if (!hasActiveMonth) {
          const curDate = new Date(activeMonth.year, activeMonth.month - 1, 1);
          const curLabel = curDate.toLocaleDateString("fr-FR", { month: "short" });
          const curExpenses = getTotalExpenses(transactions);
          const curSavings = getMonthlySavingsContributions(savingsGoals, activeMonth.year, activeMonth.month);
          mapped.push({
            month: curLabel.charAt(0).toUpperCase() + curLabel.slice(1),
            revenus: income,
            depenses: curExpenses,
            epargne: curSavings,
          });
        }

        setHistoryData(mapped);
      } else {
        // Fallback avec le mois courant actif
        const curDate = new Date(activeMonth.year, activeMonth.month - 1, 1);
        const curLabel = curDate.toLocaleDateString("fr-FR", { month: "short" });
        const curExpenses = getTotalExpenses(transactions);
        setHistoryData([
          {
            month: curLabel.charAt(0).toUpperCase() + curLabel.slice(1),
            revenus: income,
            depenses: curExpenses,
            epargne: Math.max(0, income - curExpenses),
          }
        ]);
      }
    } catch (e) {
      console.error("Error fetching history", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Calculs actuels pour le mois sélectionné (100% concordants avec Dashboard)
  const currentExpenses = transactions.filter((tx) => tx.type === "expense" || !tx.type);
  const totalExpenses = getTotalExpenses(transactions);
  const monthlySavings = getMonthlySavingsContributions(savingsGoals, activeMonth.year, activeMonth.month);
  const totalSavingsAllTime = savingsGoals.reduce((sum, g) => sum + g.current, 0);
  const resteAVivre = getRemainingToLive(income, totalExpenses, monthlySavings);

  // Taux financiers concordants
  const tauxEpargne = income > 0 ? (monthlySavings / income) * 100 : 0;
  const tauxDepense = income > 0 ? (totalExpenses / income) * 100 : 0;

  // Intelligence Artificielle Financière (Pilier F)
  const aiAnalysis = generateFinancialAIAnalysis({
    income,
    incomeSourcesCount: Math.max(1, incomeEntries.length),
    transactions,
    categories,
    savingsGoals,
    debts,
    monthlySavings,
    currency,
    payDay: payDay || 28,
  });

  // Répartition par catégorie strictement concordante
  const categoryStats = categories.map((cat, idx) => {
    const spent = getSpentByCategory(transactions, cat.name);
    return {
      name: cat.name,
      value: spent,
      allocated: cat.amount,
      color: PIE_COLORS[idx % PIE_COLORS.length],
      percent: totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0,
    };
  }).filter((cat) => cat.value > 0).sort((a, b) => b.value - a.value);

  const top3Categories = categoryStats.slice(0, 3);

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
      income,
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
      income,
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
    <div className="flex flex-col gap-8 pb-12">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1E3A5F] mb-1 border border-blue-100">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Analyses Financières Avancées</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Rapports & Tendances
          </h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Comprenez la destination de chaque franc pour optimiser votre épargne ({capitalizedMonth}).
          </p>
        </div>

        {/* Boutons de Téléchargement des Rapports */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Button
            onClick={handleDownloadPDF}
            className="bg-[#1E3A5F] hover:bg-[#162d4b] text-white shadow-sm flex-1 sm:flex-initial"
          >
            <FileText className="h-4 w-4 mr-2" />
            Télécharger Rapport PDF
          </Button>
          <Button
            onClick={handleDownloadCSV}
            variant="outline"
            className="border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 flex-1 sm:flex-initial"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
            Exporter Excel (CSV)
          </Button>
        </div>
      </div>

      {/* Cartes KPI Ratios Financiers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Taux de Dépense</CardTitle>
            <div className="p-2 bg-red-100 dark:bg-red-950/50 rounded-lg">
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {Math.round(tauxDepense)}%
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${tauxDepense > 85 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                style={{ width: `${Math.min(tauxDepense, 100)}%` }} 
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              {formatMoney(totalExpenses, currency)} consommés sur votre salaire
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Reste Disponible</CardTitle>
            <div className="p-2 bg-sky-100 dark:bg-sky-950/50 rounded-lg">
              <Wallet className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className={`text-2xl font-bold ${resteAVivre < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
              {formatMoney(resteAVivre, currency)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              {resteAVivre >= 0 ? "Non encore dépensé ce mois" : "Dépassement de budget"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Capacité d'Épargne</CardTitle>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg">
              <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {Math.round(tauxEpargne)}%
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-emerald-500" 
                style={{ width: `${Math.min(tauxEpargne, 100)}%` }} 
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Total cumulé : {formatMoney(monthlySavings, currency)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Catégories Actives</CardTitle>
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/50 rounded-lg">
              <PieIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {categoryStats.length} <span className="text-sm font-normal text-slate-400">/ {categories.length}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Postes ayant enregistré des dépenses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques Principaux */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Graphique 1 : Évolution Revenus vs Dépenses (4 colonnes) */}
        <Card className="lg:col-span-4 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                  <BarChart3 className="h-5 w-5 text-[#1E3A5F] dark:text-sky-400" />
                  Revenus vs Dépenses Réelles
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">Comparatif mensuel de vos flux financiers</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} />
                  <YAxis 
                    stroke="#94A3B8" 
                    fontSize={11} 
                    tickLine={false} 
                    tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatMoney(Number(value), currency), ""]}
                    contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: "16px", fontSize: "12px" }}
                  />
                  <Bar dataKey="revenus" name="Revenus" fill="#1E3A5F" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="depenses" name="Dépenses" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Graphique 2 : Répartition des Dépenses (3 colonnes) */}
        <Card className="lg:col-span-3 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
              <PieIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Répartition des Dépenses
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">Part de chaque catégorie ce mois-ci</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {categoryStats.length > 0 ? (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {categoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => [formatMoney(Number(val), currency), ""]}
                      contentStyle={{ backgroundColor: "#0F172A", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
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
                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="truncate">{cat.name} : {Math.round(cat.percent)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Insights & Top Postes de Dépenses */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Top 3 Postes */}
        <Card className="md:col-span-4 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
              <Award className="h-5 w-5 text-amber-500" />
              Top Postes de Dépenses ({capitalizedMonth})
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">Les postes qui consomment le plus votre salaire</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {top3Categories.map((cat, index) => (
              <div key={cat.name} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] text-white flex items-center justify-center font-bold text-sm">
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{cat.name}</p>
                    <p className="text-xs text-slate-500">
                      Plafond alloué : {formatMoney(cat.allocated, currency)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-slate-900">{formatMoney(cat.value, currency)}</p>
                  <p className="text-xs text-amber-600 font-medium">{Math.round(cat.percent)}% des sorties</p>
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
        <Card className="md:col-span-3 border-none shadow-sm bg-gradient-to-br from-[#1E3A5F] to-[#254673] text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Sparkles className="h-5 w-5 text-amber-300" />
                Diagnostic Habitudes (IA)
              </CardTitle>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30">
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
                  <span className="font-bold text-white">{aiAnalysis.breakdown.essentialsPercent}%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-sky-400 h-full rounded-full" style={{ width: `${Math.min(aiAnalysis.breakdown.essentialsPercent, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span>Famille, Solidarité & Dîmes (cible ≤ 20%)</span>
                  <span className="font-bold text-white">{aiAnalysis.breakdown.solidarityAndTithePercent}%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: `${Math.min(aiAnalysis.breakdown.solidarityAndTithePercent, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span>Épargne mensuelle (cible ≥ 10%)</span>
                  <span className="font-bold text-emerald-300">{aiAnalysis.breakdown.savingsPercent}%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${Math.min(aiAnalysis.breakdown.savingsPercent, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span>Loisirs ({aiAnalysis.breakdown.leisurePercent}%) & Ratio Dettes ({aiAnalysis.breakdown.debtRatioPercent}%)</span>
                  <span className="font-bold text-rose-300">{aiAnalysis.breakdown.debtRatioPercent}% dettes</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-rose-400 h-full rounded-full" style={{ width: `${Math.min(aiAnalysis.breakdown.debtRatioPercent, 100)}%` }} />
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
  );
}
