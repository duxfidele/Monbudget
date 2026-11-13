"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Plus,
  HandCoins,
  Target,
  BrainCircuit,
  ArrowDownLeft,
  FileText,
  FileSpreadsheet,
  Lock,
  Clock,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickAddTransactionDialog } from "@/components/transactions/quick-add-transaction-dialog";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";
import {
  canAccessFeature,
  getPlanCatalog,
  getSubscriptionCountdownInfo,
} from "@/lib/moneriz-plans";
import { exportMonthlyReportCSV, exportMonthlyReportPDF } from "@/lib/utils/report-export";
import {
  getTotalExpenses,
  getRemainingToLive,
  getDailyBudget,
  formatMoney,
  getCategoryProgress,
  getSpentByCategory,
  isIncomeTransaction,
  getMonthlySavingsContributions,
  getTodayExpenses,
  getTotalPayableDebts,
  getTotalReceivableDebts,
  getDebtAlerts,
  generateFinancialAIAnalysis
} from "@/lib/utils/budget-calc";

export default function DashboardPage() {
  const router = useRouter();
  const {
    income,
    incomeEntries,
    categories,
    transactions,
    savingsGoals,
    debts,
    currency,
    payDay,
    notifications,
    activeMonth,
    subscriptionHydrated,
    subscriptionPlan,
    subscriptionStatus,
    subscriptionExpiresAt,
    subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdminUser,
  } = useUIStore();

  const planCatalog = getPlanCatalog();
  const subscriptionCountdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    trialEndsAt: subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdmin: isAdminUser,
  });
  const canUseBudgetTools =
    isAdminUser || canAccessFeature(subscriptionCountdown.effectivePlanId, "daily_pilotage");
  const canViewSavings =
    isAdminUser || canAccessFeature(subscriptionCountdown.effectivePlanId, "savings");
  const canViewDebts =
    isAdminUser || canAccessFeature(subscriptionCountdown.effectivePlanId, "debts");
  const canExportReports =
    isAdminUser || canAccessFeature(subscriptionCountdown.effectivePlanId, "reports");
  const canAccessAdvisor =
    isAdminUser || canAccessFeature(subscriptionCountdown.effectivePlanId, "advisor");

  const showBudgetSection = !subscriptionHydrated || canUseBudgetTools;
  const showSavingsSection = !subscriptionHydrated || canViewSavings;
  const showDebtsSection = !subscriptionHydrated || canViewDebts;
  const showReportsUnlocked = !subscriptionHydrated || canExportReports;
  const showAdvisorSection = !subscriptionHydrated || canAccessAdvisor;

  const promptUnlockPersonal = (featureLabel: string) => {
    toast.info(`« ${featureLabel} » est cadenassé en mode Gratuit.`, {
      description:
        "Prenez un abonnement Particulier à 500 FCFA/mois pour débloquer toutes les fonctionnalités.",
      action: {
        label: "Abonnement 500 F",
        onClick: () => router.push("/settings?tab=subscription&plan=personal#plan-card-personal"),
      },
    });
    router.push("/settings?tab=subscription&plan=personal#plan-card-personal");
  };

  // 1. Calculs financiers purs et précis via budget-calc
  const epargneMois = getMonthlySavingsContributions(savingsGoals, activeMonth.year, activeMonth.month);
  const depenses = getTotalExpenses(transactions, epargneMois);
  const depensesPrevues = categories.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const resteAAllouer = income - depensesPrevues;
  const epargneConstituee = savingsGoals.reduce((sum, g) => sum + g.current, 0);
  const totalTargetSavings = savingsGoals.reduce((sum, g) => sum + g.target, 0);
  const globalGoalsProgress = totalTargetSavings > 0 ? Math.round((epargneConstituee / totalTargetSavings) * 100) : 0;
  const reste = getRemainingToLive(income, depenses);
  const pourcentageDepense = income > 0 ? (depenses / income) * 100 : 0;

  // Dettes & Créances (Pilier A & E)
  const dettesARembourser = getTotalPayableDebts(debts);
  const dettesARecuperer = getTotalReceivableDebts(debts);
  const debtAlerts = getDebtAlerts(debts, new Date(), 7, currency);

  // Intelligence Artificielle Financière (Pilier F)
  const aiAnalysis = generateFinancialAIAnalysis({
    income,
    incomeSourcesCount: Math.max(1, incomeEntries?.length || 1),
    categories,
    transactions,
    savingsGoals,
    debts,
    monthlySavings: epargneMois,
    currency,
    payDay: payDay || 28,
  });

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

  const activeDate = new Date(activeMonth.year, activeMonth.month - 1, 1);
  const monthName = activeDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const handleDownloadPDF = () => {
    if (!subscriptionHydrated) {
      toast.info("Vérification de votre accès en cours...");
      return;
    }
    if (!canExportReports) {
      toast.info("Export PDF cadenassé en mode Gratuit.", {
        description:
          "Prenez un abonnement Particulier (500 FCFA/mois) pour générer vos bilans PDF officiels.",
        action: {
          label: "Prendre 500 F",
          onClick: () => router.push("/settings?tab=subscription&plan=personal"),
        },
      });
      router.push("/settings?tab=subscription&plan=personal");
      return;
    }
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
    toast.success(`Rapport PDF (${capitalizedMonth}) généré !`);
  };

  const handleDownloadCSV = () => {
    if (!subscriptionHydrated) {
      toast.info("Vérification de votre accès en cours...");
      return;
    }
    if (!canExportReports) {
      toast.info("Export Excel / CSV cadenassé en mode Gratuit.", {
        description:
          "Prenez un abonnement Particulier (500 FCFA/mois) pour télécharger vos rapports CSV.",
        action: {
          label: "Prendre 500 F",
          onClick: () => router.push("/settings?tab=subscription&plan=personal"),
        },
      });
      router.push("/settings?tab=subscription&plan=personal");
      return;
    }
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

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-16">
      {/* En-tête Mobile-First */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Tableau de bord
            </h2>
            <Link
              href={
                isAdminUser
                  ? "/admin"
                  : subscriptionCountdown.effectivePlanId === "free"
                  ? "/settings?tab=subscription&plan=personal#plan-card-personal"
                  : "/settings?tab=subscription"
              }
              suppressHydrationWarning
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-opacity hover:opacity-90 ${
                isAdminUser
                  ? "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
                  : !subscriptionHydrated
                  ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
                  : subscriptionCountdown.isTrialActive
                  ? subscriptionCountdown.isTrialExpiringSoon
                    ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700"
                    : "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
                  : subscriptionCountdown.needsPlanChoice
                  ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700"
                  : subscriptionCountdown.isPaidActive
                  ? subscriptionCountdown.isExpiringSoon
                    ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  : subscriptionCountdown.isExpired
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                  : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              }`}
            >
              <Crown className="h-3 w-3 shrink-0" />
              <span>
                {isAdminUser
                  ? "Super-Admin • Illimité"
                  : !subscriptionHydrated
                  ? "Vérification de l'accès..."
                  : subscriptionCountdown.isTrialActive
                  ? `Essai 30j • ${subscriptionCountdown.trialDaysRemaining}j restant${
                      (subscriptionCountdown.trialDaysRemaining || 0) > 1 ? "s" : ""
                    }`
                  : subscriptionCountdown.needsPlanChoice
                  ? "Fin d'essai • Choix requis"
                  : subscriptionCountdown.isPaidActive
                  ? `Plan ${planCatalog[subscriptionCountdown.effectivePlanId].name}${
                      subscriptionCountdown.daysRemaining !== null
                        ? ` • ${subscriptionCountdown.daysRemaining}j restant${
                            subscriptionCountdown.daysRemaining > 1 ? "s" : ""
                          }`
                        : ""
                    }`
                  : subscriptionCountdown.isExpired
                  ? "Abonnement expiré • Mode Gratuit"
                  : "Plan Gratuit • Débloquer (500 F)"}
              </span>
            </Link>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-xs sm:text-sm">
            Gérez votre salaire au jour le jour pour terminer le mois sereinement.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none">
            <QuickAddTransactionDialog
              customTrigger={
                <Button className="w-full sm:w-auto bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white shadow-sm gap-1.5 text-xs sm:text-sm h-10 px-4 font-bold rounded-xl active:scale-95 transition-all">
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>Ajouter une dépense</span>
                </Button>
              }
            />
          </div>
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            suppressHydrationWarning
            className={`border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 gap-1 text-xs h-10 px-3 rounded-xl shrink-0 ${
              !showReportsUnlocked ? "opacity-80" : ""
            }`}
            title={
              showReportsUnlocked
                ? "Télécharger le rapport PDF"
                : "Prendre un abonnement Particulier (500 FCFA/mois)"
            }
          >
            {showReportsUnlocked ? (
              <FileText className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button
            onClick={handleDownloadCSV}
            variant="outline"
            suppressHydrationWarning
            className={`border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 gap-1 text-xs h-10 px-3 rounded-xl shrink-0 ${
              !showReportsUnlocked ? "opacity-80" : ""
            }`}
            title={
              showReportsUnlocked
                ? "Télécharger le rapport Excel"
                : "Prendre un abonnement Particulier (500 FCFA/mois)"
            }
          >
            {showReportsUnlocked ? (
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {/* Alerte J-3 avant fin de l'essai gratuit complet (30 jours) */}
      {subscriptionHydrated &&
        !isAdminUser &&
        subscriptionCountdown.isTrialActive &&
        subscriptionCountdown.isTrialExpiringSoon && (
          <div
            suppressHydrationWarning
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200"
          >
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs md:text-sm">
                <span className="font-bold">
                  Fin d&apos;essai gratuit dans J-{subscriptionCountdown.trialDaysRemaining} :{" "}
                </span>
                Vos 30 jours d&apos;accès complet se terminent
                {subscriptionCountdown.formattedTrialEndsAt
                  ? ` le ${subscriptionCountdown.formattedTrialEndsAt}`
                  : " bientôt"}
                . Choisissez votre formule : <strong>Gratuit limité (0 FCFA)</strong>,{" "}
                <strong>
                  Particulier ({planCatalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois)
                </strong>{" "}
                ou{" "}
                <strong>
                  Entreprise ({planCatalog.business.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois)
                </strong>
                .
              </div>
            </div>
            <Link href="/settings?tab=subscription" className="shrink-0">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold">
                Choisir ma formule
              </Button>
            </Link>
          </div>
        )}

      {/* Bannière Jour 31 : Choix requis après expiration de l'essai 30j */}
      {subscriptionHydrated && !isAdminUser && subscriptionCountdown.needsPlanChoice && (
        <div
          suppressHydrationWarning
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 text-slate-900 dark:text-sky-100"
        >
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="text-xs md:text-sm">
              <span className="font-bold">
                Essai 30 jours terminé — Choix d&apos;abonnement requis :{" "}
              </span>
              Vos données sont intactes. Les modules avancés sont cadenassés jusqu&apos;à votre choix :{" "}
              <strong>Gratuit (Entrées &amp; Dépenses)</strong>,{" "}
              <strong>
                Particulier ({planCatalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois)
              </strong>{" "}
              ou{" "}
              <strong>
                Entreprise ({planCatalog.business.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois)
              </strong>
              .
            </div>
          </div>
          <Link href="/settings?tab=subscription&plan=personal#plan-card-personal" className="shrink-0">
            <Button size="sm" className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs font-bold">
              Choisir mon abonnement
            </Button>
          </Link>
        </div>
      )}

      {/* Alerte J-5 avant expiration ou notification d'expiration d'abonnement payant */}
      {subscriptionHydrated &&
        !isAdminUser &&
        subscriptionCountdown.isPaidActive &&
        subscriptionCountdown.isExpiringSoon && (
        <div
          suppressHydrationWarning
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-xs md:text-sm">
              <span className="font-bold">
                Renouvellement imminent (J-{subscriptionCountdown.daysRemaining}) :{" "}
              </span>
              Votre abonnement{" "}
              <strong>{planCatalog[subscriptionCountdown.effectivePlanId].name}</strong> arrive à
              échéance{" "}
              {subscriptionCountdown.formattedExpiresAt
                ? `le ${subscriptionCountdown.formattedExpiresAt}`
                : "bientôt"}
              . Renouvelez pour conserver vos enveloppes, épargne, dettes, rapports et Conseiller IA.
            </div>
          </div>
          <Link href="/settings?tab=subscription" className="shrink-0">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold">
              Renouveler maintenant
            </Button>
          </Link>
        </div>
      )}

      {subscriptionHydrated && !isAdminUser && subscriptionCountdown.isExpired && (
        <div
          suppressHydrationWarning
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div className="text-xs md:text-sm">
              <span className="font-bold">Abonnement expiré : </span>
              Votre précédent plan a pris fin
              {subscriptionCountdown.formattedExpiresAt
                ? ` le ${subscriptionCountdown.formattedExpiresAt}`
                : ""}
              . Votre compte utilise le <strong>Mode Gratuit limité</strong> (vos données restent sauvegardées). Prenez un abonnement <strong>Particulier (500 FCFA/mois)</strong> pour tout débloquer.
            </div>
          </div>
          <Link href="/settings?tab=subscription&plan=personal#plan-card-personal" className="shrink-0">
            <Button size="sm" className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs font-bold">
              Réactiver (500 FCFA)
            </Button>
          </Link>
        </div>
      )}

      {/* Bannière de rappel du jour de paie si activée et débloquée */}
      {subscriptionHydrated &&
        canUseBudgetTools &&
        notifications?.payDayReminder !== false &&
        dailyInfo.daysRemaining <= (notifications?.payDayReminderDays || 7) &&
        !dailyInfo.isPayDayToday && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 animate-in fade-in">
          <Calendar className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 text-xs md:text-sm">
            <span className="font-bold text-amber-800">Rappel Jour de Paie (J-{dailyInfo.daysRemaining}) : </span>
            Votre prochain salaire arrive dans {dailyInfo.daysRemaining} {dailyInfo.daysRemaining > 1 ? "jours" : "jour"} (le {payDay || 28}). Gardez le cap avec votre budget journalier de {formatMoney(dailyInfo.dailyBudget, currency)}/jour.
          </div>
        </div>
      )}

      {/* HERO CARD : Budget Journalier Conseillé déduit automatiquement (Cadenassé en mode Gratuit) */}
      {showBudgetSection ? (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E3A5F] via-[#24436E] to-[#152B47] text-white p-4 sm:p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-3 sm:space-y-4 flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/15 text-blue-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>PILOTAGE QUOTIDIEN DU SALAIRE</span>
            </div>

            <div>
              <p className="text-slate-300 text-xs sm:text-sm font-medium">Budget journalier conseillé pour aujourd&apos;hui</p>
              <div className="flex flex-wrap items-baseline gap-2 mt-1">
                <span suppressHydrationWarning className={`text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight ${dailyInfo.isOverDailyBudget ? "text-amber-300" : "text-white"}`}>
                  {formatMoney(Math.max(0, dailyInfo.todayRemaining), currency)}
                </span>
                <span className="text-slate-300 text-sm sm:text-base font-medium">
                  restant aujourd&apos;hui
                </span>
                <span className="text-[11px] sm:text-xs bg-white/10 border border-white/15 px-2 py-0.5 rounded-full text-slate-200">
                  Alloué : {formatMoney(dailyInfo.dailyBudget, currency)}/j
                </span>
              </div>
            </div>

            {/* Jauge de déduction du jour */}
            <div className="space-y-1.5 max-w-lg">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs text-slate-200">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span>Dépensé aujourd&apos;hui :</span>
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
                  className={`h-full rounded-full transition-all duration-500 ${dailyInfo.isOverDailyBudget
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
                  <strong className="text-emerald-300">🎉 Jour de paie aujourd&apos;hui !</strong>
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

          <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[280px] max-w-sm bg-white/5 border border-white/10 backdrop-blur-sm p-3.5 sm:p-4 rounded-xl self-stretch md:self-center min-w-0">
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
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => promptUnlockPersonal("Pilotage Quotidien & Budget Journalier")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              promptUnlockPersonal("Pilotage Quotidien & Budget Journalier");
            }
          }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E3A5F] via-[#24436E] to-[#152B47] text-white p-5 sm:p-6 md:p-8 shadow-xl border border-amber-400/30 cursor-pointer hover:border-amber-300/60 transition-all group"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-400/20 border border-amber-400/40 text-amber-300">
                <Lock className="h-3.5 w-3.5" />
                <span>PILOTAGE QUOTIDIEN CADENASSÉ</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Budget journalier conseillé &amp; reste à vivre automatique
              </h3>
              <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
                En mode Gratuit, vous profitez des Entrées, Dépenses et de la page Budget (salaire &amp; enveloppes). Prenez un abonnement{" "}
                <strong className="text-amber-300">Particulier (500 FCFA / mois)</strong> pour débloquer votre budget journalier conseillé et le diagnostic du jour.
              </p>
            </div>
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                promptUnlockPersonal("Pilotage Quotidien & Budget Journalier");
              }}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl gap-1.5 shrink-0 h-10 px-4"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Prendre 500 FCFA/mois</span>
            </Button>
          </div>
        </div>
      )}

      {/* KPI Cards : Les 6 Indicateurs Financiers Clés (Format 2x2 optimisé Mobile-First) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        {/* 1. Revenus du mois */}
        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Revenus du Mois</CardTitle>
            <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg shrink-0">
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <div suppressHydrationWarning className="text-base sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 truncate">
              {formatMoney(income, currency)}
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
              {incomeEntries && incomeEntries.length > 1
                ? `${incomeEntries.length} sources déclarées`
                : "Salaire & déclarés"}
            </p>
          </CardContent>
        </Card>

        {/* 2. Dépenses du mois & Budget Prévu */}
        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Dépenses Réalisées</CardTitle>
            <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-950/60 rounded-lg shrink-0">
              <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <div suppressHydrationWarning className="text-base sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 truncate">
              {formatMoney(depenses, currency)}
            </div>
            {showBudgetSection && epargneMois > 0 ? (
              <p className="text-[10px] sm:text-xs text-sky-600 dark:text-sky-400 mt-0.5 sm:mt-1 font-medium truncate">
                dont {formatMoney(epargneMois, currency)} épargnés
              </p>
            ) : showBudgetSection ? (
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                Prévu : {formatMoney(depensesPrevues, currency)}
              </p>
            ) : (
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                Sorties enregistrées ce mois
              </p>
            )}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 sm:h-1.5 mt-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pourcentageDepense > 90 ? 'bg-red-500' : 'bg-blue-600'}`}
                style={{ width: `${Math.min(pourcentageDepense, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. Solde disponible & Reste à allouer */}
        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Solde Disponible</CardTitle>
            <div className="p-1.5 sm:p-2 bg-sky-100 dark:bg-sky-950/60 rounded-lg shrink-0">
              <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 dark:text-sky-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <div suppressHydrationWarning className={`text-base sm:text-2xl font-extrabold truncate ${reste < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
              {formatMoney(reste, currency)}
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
              {reste >= 0 ? "Reste en caisse" : "Déficit constaté"}
            </p>
          </CardContent>
        </Card>

        {/* 4. Épargne constituée */}
        {showSavingsSection ? (
        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Épargne Constituée</CardTitle>
            <div className="p-1.5 sm:p-2 bg-amber-100 dark:bg-amber-950/60 rounded-lg shrink-0">
              <PiggyBank className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <div suppressHydrationWarning className="text-base sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 truncate">
              {formatMoney(epargneConstituee > 0 ? epargneConstituee : epargneMois, currency)}
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
              +{formatMoney(epargneMois, currency)} ce mois
            </p>
          </CardContent>
        </Card>
        ) : (
        <Card
          onClick={() => promptUnlockPersonal("Épargne Constituée")}
          className="border-none shadow-xs bg-slate-50/90 dark:bg-slate-900/70 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl overflow-hidden cursor-pointer hover:border-amber-400 transition-colors"
        >
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Épargne Constituée</CardTitle>
            <div className="p-1.5 sm:p-2 bg-amber-100 dark:bg-amber-950/60 rounded-lg shrink-0">
              <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <div className="text-sm sm:text-base font-extrabold text-slate-700 dark:text-slate-200 truncate">
              Cadenassé
            </div>
            <p className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-400 font-semibold mt-0.5 sm:mt-1 truncate">
              Abonnement 500 FCFA/mois &rarr;
            </p>
          </CardContent>
        </Card>
        )}

        {/* 5. Dettes à rembourser */}
        {showDebtsSection ? (
        <Link href="/debts" className="block group">
          <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden group-hover:shadow-md transition-shadow h-full">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-5 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Dettes à Payer</CardTitle>
              <div className="p-1.5 sm:p-2 bg-rose-100 dark:bg-rose-950/60 rounded-lg shrink-0">
                <HandCoins className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 dark:text-rose-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
              <div suppressHydrationWarning className="text-base sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 truncate">
                {formatMoney(dettesARembourser, currency)}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                {debts.filter((d) => d.type === "payable" && d.remainingAmount > 0).length} à solder &rarr;
              </p>
            </CardContent>
          </Card>
        </Link>
        ) : (
        <Card
          onClick={() => promptUnlockPersonal("Dettes à Payer")}
          className="border-none shadow-xs bg-slate-50/90 dark:bg-slate-900/70 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl overflow-hidden cursor-pointer hover:border-amber-400 transition-colors h-full"
        >
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Dettes à Payer</CardTitle>
            <div className="p-1.5 sm:p-2 bg-amber-100 dark:bg-amber-950/60 rounded-lg shrink-0">
              <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <div className="text-sm sm:text-base font-extrabold text-slate-700 dark:text-slate-200 truncate">
              Cadenassé
            </div>
            <p className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-400 font-semibold mt-0.5 sm:mt-1 truncate">
              Abonnement 500 FCFA/mois &rarr;
            </p>
          </CardContent>
        </Card>
        )}

        {/* 6. Dettes à récupérer */}
        {showDebtsSection ? (
        <Link href="/debts" className="block group">
          <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden group-hover:shadow-md transition-shadow h-full">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-5 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Créances</CardTitle>
              <div className="p-1.5 sm:p-2 bg-teal-100 dark:bg-teal-950/60 rounded-lg shrink-0">
                <ArrowDownLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-teal-600 dark:text-teal-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
              <div suppressHydrationWarning className="text-base sm:text-2xl font-extrabold text-teal-700 dark:text-teal-300 truncate">
                {formatMoney(dettesARecuperer, currency)}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                {debts.filter((d) => d.type === "receivable" && d.remainingAmount > 0).length} à récupérer &rarr;
              </p>
            </CardContent>
          </Card>
        </Link>
        ) : (
        <Card
          onClick={() => promptUnlockPersonal("Créances")}
          className="border-none shadow-xs bg-slate-50/90 dark:bg-slate-900/70 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl overflow-hidden cursor-pointer hover:border-amber-400 transition-colors h-full"
        >
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-5 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Créances</CardTitle>
            <div className="p-1.5 sm:p-2 bg-amber-100 dark:bg-amber-950/60 rounded-lg shrink-0">
              <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <div className="text-sm sm:text-base font-extrabold text-slate-700 dark:text-slate-200 truncate">
              Cadenassé
            </div>
            <p className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-400 font-semibold mt-0.5 sm:mt-1 truncate">
              Abonnement 500 FCFA/mois &rarr;
            </p>
          </CardContent>
        </Card>
        )}
      </div>

      {/* 7. Progression des Objectifs Financiers & Intelligence Artificielle Financière (Piliers A, D, F) */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Progression des objectifs financiers */}
        <Card className="lg:col-span-3 min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg text-slate-900 dark:text-slate-100">
                  <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Progression des Objectifs
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  {showSavingsSection
                    ? `Avancement global : ${globalGoalsProgress}% (${formatMoney(epargneConstituee, currency)})`
                    : "Module cadenassé en mode Gratuit"}
                </CardDescription>
              </div>
              {showSavingsSection ? (
                <Link href="/savings">
                  <Button variant="ghost" size="sm" className="text-blue-600 dark:text-sky-400 font-medium text-xs">
                    Gérer &rarr;
                  </Button>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  <Lock className="h-3 w-3" /> 500 F
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showSavingsSection ? (
              <>
                {savingsGoals.slice(0, 4).map((goal) => {
                  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
                  return (
                    <div key={goal.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate min-w-0">{goal.name}</span>
                        <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 text-right">
                          {formatMoney(goal.current, currency)}{" "}
                          <span className="text-slate-400 font-normal">/ {formatMoney(goal.target, currency)} ({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${goal.color || "bg-emerald-600"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {savingsGoals.length === 0 && (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs space-y-2">
                    <p>Aucun objectif financier configuré (Moto, Maison, Scolarité, Urgence...).</p>
                    <Link href="/savings">
                      <Button size="sm" variant="outline" className="mt-1 text-xs dark:border-slate-700 dark:text-slate-300">
                        + Définir un objectif
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => promptUnlockPersonal("Progression des Objectifs d'Épargne")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    promptUnlockPersonal("Progression des Objectifs d'Épargne");
                  }
                }}
                className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-center space-y-2.5 cursor-pointer hover:border-amber-400 transition-colors"
              >
                <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400 mx-auto" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Cagnottes &amp; Objectifs d&apos;Épargne cadenassés
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Prenez un abonnement Particulier à <strong>500 FCFA / mois</strong> pour débloquer vos objectifs d&apos;épargne.
                </p>
                <Button size="sm" className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs font-bold rounded-xl">
                  Prendre l&apos;abonnement 500 F
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Intelligence Artificielle Financière */}
        <Card className="lg:col-span-4 min-w-0 border-none shadow-sm bg-gradient-to-br from-slate-900 via-[#1E3A5F] to-slate-900 text-white">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base md:text-lg text-white">
                    Intelligence Artificielle Financière
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-300">
                    Analyse de vos habitudes et recommandations sur mesure
                  </CardDescription>
                </div>
              </div>
              {showAdvisorSection ? (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-emerald-300">
                    Santé : {aiAnalysis.healthScore}/100 ({aiAnalysis.healthLabel})
                  </div>
                  <Link href="/advisor">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold"
                    >
                      Conseiller IA &rarr;
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Plan Particulier (500 F)</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showAdvisorSection ? (
              <>
                <p className="text-xs text-slate-200 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
                  {aiAnalysis.summary}
                </p>
                <div className="space-y-2">
                  {aiAnalysis.recommendations.slice(0, 3).map((rec) => (
                    <div
                      key={rec.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white/10 border border-white/10"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${rec.priority === "high"
                                ? "bg-rose-400"
                                : rec.priority === "medium"
                                  ? "bg-amber-300"
                                  : "bg-sky-300"
                              }`}
                          />
                          <span className="text-xs font-bold text-white">{rec.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">{rec.description}</p>
                      </div>
                      {rec.actionHref && (
                        <Link href={rec.actionHref} className="shrink-0 self-end sm:self-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-[11px] bg-white text-[#1E3A5F] hover:bg-slate-100 font-semibold"
                          >
                            {rec.actionLabel || "Agir"}
                          </Button>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
                {debtAlerts.length > 0 && (
                  <div className="text-[11px] text-amber-300 flex items-center justify-between pt-1">
                    <span>🔔 {debtAlerts.length} alerte(s) d&apos;échéance de dette active(s)</span>
                    <Link href="/debts" className="underline hover:text-white">
                      Voir les échéances &rarr;
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => promptUnlockPersonal("Conseiller Financier IA")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    promptUnlockPersonal("Conseiller Financier IA");
                  }
                }}
                className="p-5 rounded-2xl bg-white/5 border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:border-amber-300/50 transition-colors"
              >
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-300 shrink-0" />
                    <span>Débloquez votre Conseiller Financier IA personnalisé</span>
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-lg">
                    Obtenez votre score de santé financière /100, un simulateur de fin de mois et des plans d&apos;action en 1 clic dès le <strong>Plan Particulier</strong> (500 FCFA/mois).
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    promptUnlockPersonal("Conseiller Financier IA");
                  }}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl gap-1.5 shrink-0"
                >
                  <Crown className="h-3.5 w-3.5" />
                  <span>Prendre Particulier (500 F)</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grid 2 colonnes : Dernières Transactions & Progression des Budgets */}
      <div className="grid gap-6 md:grid-cols-7 mt-2">
        {/* Recent Transactions */}
        <Card className="md:col-span-4 min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-slate-900 dark:text-slate-100">Transactions Récentes</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">Vos dernières opérations enregistrées</CardDescription>
              </div>
              <Link href="/transactions" className="shrink-0">
                <Button variant="ghost" size="sm" className="text-blue-600 dark:text-sky-400 font-medium">
                  Voir tout <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5 sm:space-y-4">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                    <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${isIncomeTransaction(tx) ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                      {isIncomeTransaction(tx) ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{tx.label}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{tx.date}</span>
                        <span className="text-xs text-slate-300 dark:text-slate-600">•</span>
                        <span className={`text-xs truncate max-w-[140px] sm:max-w-none ${isIncomeTransaction(tx) ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-500 dark:text-slate-400"}`}>
                          {isIncomeTransaction(tx) ? "Revenu" : (tx.category || "Autre (Hors Budget)")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div suppressHydrationWarning className={`font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 text-right ${isIncomeTransaction(tx) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {isIncomeTransaction(tx) ? '+' : '-'}{formatMoney(tx.amount, currency)}
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                  Aucune transaction ce mois-ci. Saisissez votre première dépense !
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Budgets Progress */}
        <Card className="md:col-span-3 min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-slate-900 dark:text-slate-100">Enveloppes par Catégorie</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  {showBudgetSection
                    ? "Consommation par rapport aux plafonds prévus"
                    : "Cadenassé en mode Gratuit limité"}
                </CardDescription>
              </div>
              {showBudgetSection ? (
                <Link href="/budget">
                  <Button variant="ghost" size="sm" className="text-blue-600 dark:text-sky-400 font-medium">
                    Ajuster
                  </Button>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  <Lock className="h-3 w-3" /> 500 F
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {showBudgetSection ? (
              <>
                {categoryStats.map((cat, idx) => {
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate min-w-0">{cat.name}</span>
                        <span suppressHydrationWarning className="font-medium text-slate-900 dark:text-slate-100 text-xs shrink-0 text-right">
                          {formatMoney(cat.spent, currency)} <span className="text-slate-400 dark:text-slate-500 font-normal">/ {formatMoney(cat.amount, currency)}</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${cat.color || 'bg-blue-500'} rounded-full transition-all duration-500 ${cat.isOverBudget ? '!bg-red-500' : ''}`}
                          style={{ width: `${Math.min(cat.percent, 100)}%` }}
                        />
                      </div>
                      {cat.isOverBudget && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Plafond dépassé
                        </p>
                      )}
                    </div>
                  );
                })}
                {categoryStats.length === 0 && (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                    Aucune enveloppe définie. Cliquez sur « Ajuster » pour configurer votre budget.
                  </div>
                )}
              </>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => promptUnlockPersonal("Enveloppes par Catégorie")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    promptUnlockPersonal("Enveloppes par Catégorie");
                  }
                }}
                className="p-5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-center space-y-2.5 cursor-pointer hover:border-amber-400 transition-colors"
              >
                <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400 mx-auto" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Enveloppes budgétaires cadenassées
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Prenez un abonnement Particulier à <strong>500 FCFA / mois</strong> pour fixer vos plafonds par catégorie et recevoir les alertes de seuil.
                </p>
                <Button size="sm" className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs font-bold rounded-xl">
                  Prendre l&apos;abonnement 500 F
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
