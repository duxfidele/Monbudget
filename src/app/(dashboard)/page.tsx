"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Wallet, 
  TrendingDown, 
  PiggyBank, 
  Receipt, 
  ArrowRight, 
  ArrowDownRight, 
  ArrowUpRight, 
  Calendar,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/store/ui-store";
import { 
  getTotalExpenses, 
  getRemainingToLive, 
  getDailyBudget, 
  formatMoney, 
  getCategoryProgress,
  getSpentByCategory,
  isIncomeTransaction,
  getMonthlySavingsContributions,
  getTodayExpenses
} from "@/lib/utils/budget-calc";

export default function DashboardPage() {
  const { income, categories, transactions, savingsGoals, currency, payDay, notifications, activeMonth } = useUIStore();

  // 1. Calculs financiers purs et précis via budget-calc
  const depenses = getTotalExpenses(transactions);
  const epargne = getMonthlySavingsContributions(savingsGoals, activeMonth.year, activeMonth.month);
  const reste = getRemainingToLive(income, depenses, epargne);
  const pourcentageDepense = income > 0 ? (depenses / income) * 100 : 0;

  // Dépenses effectuées aujourd'hui (pour déduction automatique)
  const todayISO = new Date().toISOString().split("T")[0];
  const todayExpenses = getTodayExpenses(transactions, todayISO);

  // 2. Calcul du Budget Journalier Conseillé déduit automatiquement
  const dailyInfo = getDailyBudget({
    remainingAmount: reste,
    totalIncome: income,
    targetPayDay: payDay || 28,
    currentDate: new Date(),
    todayExpenses,
    currency,
  });

  // 3. Stats des catégories
  const categoryStats = categories.map((cat) => {
    const spent = getSpentByCategory(transactions, cat.name);
    const progress = getCategoryProgress(spent, cat.amount);
    return {
      ...cat,
      spent,
      percent: Math.min(progress.percent, 100),
      isOverBudget: progress.isOverBudget,
    };
  });

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Tableau de bord</h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Gérez votre salaire au jour le jour pour terminer le mois sereinement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/transactions">
            <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white shadow-sm gap-1.5">
              <Plus className="h-4 w-4" />
              <span>Ajouter une dépense</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Bannière de rappel du jour de paie si activée */}
      {notifications?.payDayReminder !== false && dailyInfo.daysRemaining <= (notifications?.payDayReminderDays || 7) && !dailyInfo.isPayDayToday && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 animate-in fade-in">
          <Calendar className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 text-xs md:text-sm">
            <span className="font-bold text-amber-800">Rappel Jour de Paie (J-{dailyInfo.daysRemaining}) : </span>
            Votre prochain salaire arrive dans {dailyInfo.daysRemaining} {dailyInfo.daysRemaining > 1 ? "jours" : "jour"} (le {payDay || 28}). Gardez le cap avec votre budget journalier de {formatMoney(dailyInfo.dailyBudget, currency)}/jour.
          </div>
        </div>
      )}

      {/* HERO CARD : Budget Journalier Conseillé déduit automatiquement */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E3A5F] via-[#24436E] to-[#152B47] text-white p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/15 text-blue-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>PILOTAGE QUOTIDIEN DU SALAIRE (DÉDUCTION AUTOMATIQUE)</span>
            </div>

            <div>
              <p className="text-slate-300 text-sm font-medium">Budget journalier conseillé pour aujourd'hui</p>
              <div className="flex flex-wrap items-baseline gap-2.5 mt-1">
                <span suppressHydrationWarning className={`text-4xl md:text-5xl font-extrabold tracking-tight ${dailyInfo.isOverDailyBudget ? "text-amber-300" : "text-white"}`}>
                  {formatMoney(Math.max(0, dailyInfo.todayRemaining), currency)}
                </span>
                <span className="text-slate-300 text-base md:text-lg font-medium">
                  restant aujourd'hui
                </span>
                <span className="text-xs bg-white/10 border border-white/15 px-2.5 py-1 rounded-full text-slate-200">
                  Alloué : {formatMoney(dailyInfo.dailyBudget, currency)}/j
                </span>
              </div>
            </div>

            {/* Jauge de déduction du jour */}
            <div className="space-y-1.5 max-w-lg">
              <div className="flex items-center justify-between text-xs text-slate-200">
                <span className="flex items-center gap-1.5">
                  <span>Dépensé aujourd'hui :</span>
                  <strong className="text-white">
                    {dailyInfo.todaySpent > 0 ? `-${formatMoney(dailyInfo.todaySpent, currency)}` : "0 " + currency}
                  </strong>
                  <span className="text-[11px] text-emerald-300 font-semibold">(déduit auto)</span>
                </span>
                {dailyInfo.isOverDailyBudget ? (
                  <span className="text-amber-300 font-bold">
                    Dépassement : +{formatMoney(Math.abs(dailyInfo.todayRemaining), currency)}
                  </span>
                ) : (
                  <span className="text-emerald-300 font-semibold">
                    Disponible : {formatMoney(dailyInfo.todayRemaining, currency)}
                  </span>
                )}
              </div>

              <div className="w-full bg-black/30 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    dailyInfo.isOverDailyBudget 
                      ? "bg-amber-400" 
                      : dailyInfo.dailyProgressPercent > 80 
                        ? "bg-amber-300" 
                        : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, dailyInfo.dailyProgressPercent))}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-slate-300 pt-1">
              <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-lg">
                <Calendar className="h-4 w-4 text-sky-300" />
                {dailyInfo.isPayDayToday ? (
                  <strong className="text-emerald-300">🎉 Jour de paie aujourd'hui !</strong>
                ) : (
                  <span>
                    <strong>{dailyInfo.daysRemaining}</strong> {dailyInfo.daysRemaining > 1 ? "jours restants" : "jour restant"} avant la paie ({dailyInfo.nextPayDate.getDate()} {dailyInfo.nextPayDate.toLocaleDateString("fr-FR", { month: "short" })})
                  </span>
                )}
              </span>

              <span className="text-slate-400">•</span>
              <span>Reste à vivre du mois : <strong className="text-white">{formatMoney(reste, currency)}</strong></span>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:min-w-[280px] max-w-sm bg-white/5 border border-white/10 backdrop-blur-sm p-4 rounded-xl self-start md:self-center">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Diagnostic du jour</span>
              {dailyInfo.status === "healthy" && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3" /> Rythme idéal
                </span>
              )}
              {dailyInfo.status === "warning" && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="h-3 w-3" /> Vigilance
                </span>
              )}
              {dailyInfo.status === "critical" && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                  <AlertTriangle className="h-3 w-3" /> Alerte budget
                </span>
              )}
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {dailyInfo.advice}
            </p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
              <Link href="/budget" className="hover:text-white underline underline-offset-2 transition-colors">
                Gérer les enveloppes &rarr;
              </Link>
              <Link href="/settings" className="hover:text-white text-slate-400 transition-colors">
                Changer jour de paie ({payDay || 28})
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Revenus du Mois</CardTitle>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className="text-2xl font-bold text-slate-800">
              {formatMoney(income, currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Salaire & revenus déclarés</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Dépenses Réalisées</CardTitle>
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className="text-2xl font-bold text-slate-800">
              {formatMoney(depenses, currency)}
            </div>
            <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${pourcentageDepense > 90 ? 'bg-red-500' : 'bg-blue-600'}`} 
                style={{ width: `${Math.min(pourcentageDepense, 100)}%` }} 
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">{Math.round(pourcentageDepense)}% du salaire dépensé</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Reste à Vivre</CardTitle>
            <div className="p-2 bg-sky-100 rounded-lg">
              <Receipt className="h-4 w-4 text-sky-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className={`text-2xl font-bold ${reste < 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {formatMoney(reste, currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {reste >= 0 ? "Disponible pour le mois" : "Déficit constaté"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Épargne Mise de Côté</CardTitle>
            <div className="p-2 bg-amber-100 rounded-lg">
              <PiggyBank className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className="text-2xl font-bold text-slate-800">
              {formatMoney(epargne, currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Sur {savingsGoals.length} {savingsGoals.length > 1 ? "objectifs actifs" : "objectif actif"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid 2 colonnes : Dernières Transactions & Progression des Budgets */}
      <div className="grid gap-6 md:grid-cols-7 mt-2">
        {/* Recent Transactions */}
        <Card className="md:col-span-4 border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transactions Récentes</CardTitle>
                <CardDescription>Vos dernières opérations enregistrées</CardDescription>
              </div>
              <Link href="/transactions">
                <Button variant="ghost" size="sm" className="text-blue-600 font-medium">
                  Voir tout <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-xl ${isIncomeTransaction(tx) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {isIncomeTransaction(tx) ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{tx.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">{tx.date}</span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className={`text-xs ${isIncomeTransaction(tx) ? "text-emerald-600 font-medium" : "text-slate-500"}`}>
                          {isIncomeTransaction(tx) ? "Revenu" : (tx.category || "Autre (Hors Budget)")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div suppressHydrationWarning className={`font-semibold text-sm ${isIncomeTransaction(tx) ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {isIncomeTransaction(tx) ? '+' : '-'}{formatMoney(tx.amount, currency)}
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Aucune transaction ce mois-ci. Saisissez votre première dépense !
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Budgets Progress */}
        <Card className="md:col-span-3 border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Enveloppes par Catégorie</CardTitle>
                <CardDescription>Consommation par rapport aux plafonds</CardDescription>
              </div>
              <Link href="/budget">
                <Button variant="ghost" size="sm" className="text-blue-600 font-medium">
                  Ajuster
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {categoryStats.map((cat, idx) => {
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{cat.name}</span>
                    <span suppressHydrationWarning className="font-medium text-slate-900 text-xs">
                      {formatMoney(cat.spent, currency)} <span className="text-slate-400 font-normal">/ {formatMoney(cat.amount, currency)}</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${cat.color || 'bg-blue-500'} rounded-full transition-all duration-500 ${cat.isOverBudget ? '!bg-red-500' : ''}`}
                      style={{ width: `${Math.min(cat.percent, 100)}%` }}
                    />
                  </div>
                  {cat.isOverBudget && (
                    <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Plafond dépassé
                    </p>
                  )}
                </div>
              );
            })}
            {categoryStats.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                Aucune enveloppe définie. Cliquez sur « Ajuster » pour configurer votre budget.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
