"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Download, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Scale,
  Calendar,
  Zap,
  Paperclip,
  Eye,
  Lock,
  Search,
  Clock
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";
import { canAccessFeature, getSubscriptionCountdownInfo } from "@/lib/moneriz-plans";
import { ReceiptUpload, ReceiptData } from "@/components/transactions/receipt-upload";
import { formatFileSize } from "@/lib/utils/receipt-storage";
import { escapeCsvCell } from "@/lib/utils/security";
import { 
  formatMoney, 
  formatThousands, 
  parseThousands, 
  isIncomeTransaction,
  isExpenseTransaction,
  getDailyBudget,
  getTodayExpenses,
  getTotalExpenses,
  getRemainingToLive,
  getMonthlySavingsContributions,
  AFRICAN_EXPENSE_CATEGORIES,
  INCOME_SOURCES
} from "@/lib/utils/budget-calc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function TransactionsPage() {
  const router = useRouter();
  const { 
    transactions, 
    addTransaction, 
    removeTransaction, 
    categories, 
    alertThreshold, 
    currency,
    activeMonth,
    notifications,
    income,
    savingsGoals,
    payDay,
    subscriptionPlan,
    subscriptionHydrated,
    subscriptionStatus,
    subscriptionExpiresAt,
    subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdminUser,
    pendingEntityIds,
  } = useUIStore();

  const subscriptionCountdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    trialEndsAt: subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdmin: isAdminUser,
  });
  const canUseBudgetTools =
    isAdminUser || canAccessFeature(subscriptionCountdown.effectivePlanId, "budget");
  const canExportReports =
    isAdminUser || canAccessFeature(subscriptionCountdown.effectivePlanId, "reports");
  const showBudgetTools = !subscriptionHydrated || canUseBudgetTools;
  const showReportsUnlocked = !subscriptionHydrated || canExportReports;

  const promptUnlockPersonal = (featureLabel: string) => {
    toast.info(`« ${featureLabel} » est cadenassé en mode Gratuit.`, {
      description:
        "Prenez un abonnement Particulier à 500 FCFA/mois pour débloquer toutes les fonctionnalités.",
      action: {
        label: "Abonnement 500 F",
        onClick: () => router.push("/settings?tab=subscription&plan=personal"),
      },
    });
    router.push("/settings?tab=subscription&plan=personal");
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [newLabel, setNewLabel] = useState("");
  const [newAmountStr, setNewAmountStr] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newIncomeSource, setNewIncomeSource] = useState<string>(INCOME_SOURCES[0]);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newType, setNewType] = useState<"expense" | "income">("expense");
  const [newReceipt, setNewReceipt] = useState<ReceiptData | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; name: string } | null>(null);

  // Format active month label
  const activeDate = new Date(activeMonth.year, activeMonth.month - 1, 1);
  const formattedMonth = activeDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const capitalizedMonth = formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1);

  // Liste unique des catégories combinant les catégories utilisateur et les 11 catégories africaines
  const combinedCats = [
    ...categories,
    ...AFRICAN_EXPENSE_CATEGORIES.map((ac, i) => ({
      id: `african-${i}`,
      name: ac.name,
      amount: 0,
      color: ac.color,
    })),
  ];
  const uniqueCategories = Array.from(
    new Map(combinedCats.map((c) => [c.name.trim().toLowerCase(), c])).values()
  );

  // Auto-select category pour les dépenses
  useEffect(() => {
    if (!newCategory || !uniqueCategories.some((c) => c.name.toLowerCase() === newCategory.toLowerCase())) {
      if (uniqueCategories.length > 0) {
        setNewCategory(uniqueCategories[0].name);
      } else {
        setNewCategory("Autre (Hors Budget)");
      }
    }
  }, [uniqueCategories, newCategory]);

  // Totaux concordants et synchronisés avec le Tableau de bord
  const totalIncomes = transactions
    .filter((tx) => isIncomeTransaction(tx))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const epargne = getMonthlySavingsContributions(savingsGoals, activeMonth.year, activeMonth.month);
  const totalExpenses = getTotalExpenses(transactions, epargne);
  const reste = getRemainingToLive(income, totalExpenses);
  const soldeNet = reste;

  // Dépenses effectuées aujourd'hui (pour déduction automatique)
  const todayISO = new Date().toISOString().split("T")[0];
  const todayExpenses = getTodayExpenses(transactions, todayISO);

  const dailyInfo = getDailyBudget({
    remainingAmount: reste,
    totalIncome: income,
    targetPayDay: payDay || 28,
    currentDate: new Date(),
    todayExpenses,
    currency,
  });

  const handleAddTransaction = async () => {
    const cleanLabel = newLabel.trim();
    if (!cleanLabel) {
      toast.error("Veuillez renseigner un libellé.");
      return;
    }

    const amount = parseThousands(newAmountStr);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Veuillez entrer un montant valide supérieur à 0.");
      return;
    }

    const assignedCategory = newType === "expense" 
      ? (newCategory || "Autres dépenses") 
      : (newIncomeSource || "Revenu");
    const finalLabel = newType === "income" && !cleanLabel.toLowerCase().includes(newIncomeSource.toLowerCase())
      ? `${newIncomeSource} — ${cleanLabel}`
      : cleanLabel;

    // Alerte seuil pour les dépenses (réservé aux formules avec enveloppes budgétaires)
    const isAlertEnabled = notifications?.budgetAlert !== false;
    const effectiveThreshold = notifications?.budgetAlertThreshold || alertThreshold || 80;

    if (
      canUseBudgetTools &&
      isAlertEnabled &&
      newType === "expense" &&
      assignedCategory !== "Autre (Hors Budget)"
    ) {
      const categoryObj = categories.find((c) => c.name.toLowerCase() === assignedCategory.toLowerCase());
      if (categoryObj && categoryObj.amount > 0) {
        const spentSoFar = transactions
          .filter((tx) => isExpenseTransaction(tx) && tx.category.toLowerCase() === assignedCategory.toLowerCase())
          .reduce((sum, tx) => sum + tx.amount, 0);
        
        const thresholdValue = categoryObj.amount * (effectiveThreshold / 100);
        if (spentSoFar + amount >= thresholdValue) {
          toast.warning(`Attention ! Vous avez atteint ${effectiveThreshold}% du budget "${assignedCategory}" !`, {
            description: `Le budget alloué était de ${formatMoney(categoryObj.amount, currency)}.`,
            duration: 6000,
          });
        }
      }
    }

    try {
      await addTransaction({
        id: Date.now().toString(),
        label: finalLabel,
        amount: amount,
        category: assignedCategory,
        date: newDate,
        type: newType,
        receiptUrl: newReceipt?.url,
        receiptName: newReceipt?.name,
      });
      
      toast.success(
        newType === "income" 
          ? `Revenu de ${formatMoney(amount, currency)} ajouté et synchronisé !` 
          : `Dépense de ${formatMoney(amount, currency)} enregistrée ${newReceipt ? "avec reçu !" : "!"}`
      );
      setIsDialogOpen(false);
      
      // Reset form
      setNewLabel("");
      setNewAmountStr("");
      setNewReceipt(null);
      setNewDate(new Date().toISOString().split("T")[0]);
      if (categories.length > 0) setNewCategory(categories[0].name);
      else setNewCategory("Autre (Hors Budget)");
    } catch (error: any) {
      toast.error("Erreur: " + (error.message || "Impossible d ajouter la transaction"));
    }
  };

  const handleExportCSV = () => {
    if (!subscriptionHydrated) {
      toast.info("Vérification de votre accès en cours...");
      return;
    }
    if (!canExportReports) {
      toast.info("Export Excel / CSV cadenassé en mode Gratuit.", {
        description:
          "Prenez un abonnement Particulier (500 FCFA/mois) pour exporter vos transactions en CSV.",
        action: {
          label: "Prendre 500 F",
          onClick: () => router.push("/settings?tab=subscription&plan=personal"),
        },
      });
      router.push("/settings?tab=subscription&plan=personal");
      return;
    }
    if (transactions.length === 0) {
      toast.info("Aucune transaction à exporter.");
      return;
    }
    const headers = ["Date", "Type", "Catégorie", "Libellé", `Montant (${currency})`];
    const rows = transactions.map((tx) => [
      tx.date,
      isIncomeTransaction(tx) ? "Revenu" : "Dépense",
      isIncomeTransaction(tx) ? "Revenu" : (tx.category || "Autre (Hors Budget)"),
      tx.label,
      tx.amount.toString(),
    ]);
    const csvContent =
      "\uFEFF" +
      [
        headers.map(escapeCsvCell).join(";"),
        ...rows.map((e) => e.map((item) => escapeCsvCell(item)).join(";")),
      ].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `transactions_monbudget_${activeMonth.year}_${activeMonth.month}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exportation CSV réussie !");
  };

  const handleDelete = (id: string) => {
    removeTransaction(id);
    toast.info("Transaction supprimée.");
  };

  const filteredTransactions = transactions.filter((tx) => {
    const isInc = isIncomeTransaction(tx);
    if (txTypeFilter === "income" && !isInc) return false;
    if (txTypeFilter === "expense" && isInc) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (tx.label || "").toLowerCase().includes(q) ||
      (tx.category || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#1E3A5F] dark:text-sky-300 mb-1 border border-blue-100 dark:border-blue-900/40">
            <Calendar className="h-3.5 w-3.5" />
            <span>Journal financier ({capitalizedMonth})</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Transactions</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">
            Suivi en temps réel de vos entrées (revenus) et sorties (dépenses) d argent.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger
            render={
              <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold shadow-xs w-full sm:w-auto" />
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle transaction
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-slate-900 dark:text-slate-100">Nouvelle transaction</DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Enregistrez une dépense ou un revenu additionnel (prime, vente, freelance...).
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              {/* Type Switcher */}
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button 
                  type="button"
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${newType === "expense" ? "bg-white dark:bg-slate-700 shadow-sm text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                  onClick={() => setNewType("expense")}
                >
                  <ArrowDownRight className="h-4 w-4" />
                  Dépense (Sortie)
                </button>
                <button 
                  type="button"
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${newType === "income" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                  onClick={() => setNewType("income")}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Revenu (Entrée)
                </button>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Date</label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="bg-white dark:bg-slate-800 rounded-lg" />
              </div>

              {/* Libellé */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Libellé</label>
                <Input 
                  placeholder={newType === "expense" ? "Ex: Courses marché, Carburant, Facture CIE..." : "Ex: Prime performance, Vente, Freelance..."} 
                  value={newLabel} 
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="bg-white dark:bg-slate-800 rounded-lg"
                />
              </div>

              {/* Montant avec formatage */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Montant ({currency})
                </label>
                <div className="relative flex items-center">
                  <Input 
                    type="text"
                    inputMode="numeric"
                    placeholder="0" 
                    value={newAmountStr} 
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "");
                      setNewAmountStr(digits ? formatThousands(digits) : "");
                    }} 
                    onFocus={(e) => e.target.select()}
                    className="font-bold pr-14 rounded-lg bg-white dark:bg-slate-800"
                  />
                  <span className="absolute right-3 text-xs font-semibold text-slate-400 select-none pointer-events-none">
                    {currency}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {newType === "expense" ? (
                    showBudgetTools ? (
                      <span>
                        💡 Budget journalier restant : <strong className="text-emerald-700 dark:text-emerald-400">{formatMoney(Math.max(0, dailyInfo.todayRemaining), currency)}</strong>. Cette dépense sera déduite automatiquement.
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => promptUnlockPersonal("Budget Journalier du Jour")}
                        className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                      >
                        <Lock className="h-3 w-3 shrink-0" />
                        <span>Pilotage journalier cadenassé — Abonnement 500 FCFA/mois</span>
                      </button>
                    )
                  ) : (
                    <span>
                      💡 Ce revenu s&apos;ajoutera directement aux revenus du mois de {capitalizedMonth}.
                    </span>
                  )}
                </p>
              </div>

              {/* Catégorie (Dépenses) ou Source de revenu (Revenus) */}
              {newType === "expense" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Catégorie de dépense
                  </label>
                  <select 
                    value={newCategory} 
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
                  >
                    <option value="" disabled>Sélectionnez une catégorie</option>
                    {uniqueCategories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Source de revenu
                  </label>
                  <select 
                    value={newIncomeSource} 
                    onChange={(e) => setNewIncomeSource(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
                  >
                    {INCOME_SOURCES.map((src) => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upload de reçu pour les dépenses */}
              {newType === "expense" && (
                <div className="pt-1">
                  <ReceiptUpload receipt={newReceipt} onChange={setNewReceipt} />
                </div>
              )}

              <Button 
                onClick={handleAddTransaction} 
                className={`w-full mt-3 h-10 text-white font-semibold rounded-lg ${newType === "expense" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                {newType === "expense" ? "Enregistrer la dépense" : "Ajouter le revenu"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bandeau d'information du Budget Journalier Conseillé (cadenassé en mode Gratuit) */}
      {showBudgetTools ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-[#1E3A5F]/10 via-sky-50 to-blue-50/50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-sky-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#1E3A5F] dark:bg-sky-500 text-white dark:text-slate-950 shadow-xs">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">Budget Journalier du Jour</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-[#1E3A5F] dark:text-sky-300">Déduit automatiquement</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                Disponible aujourd&apos;hui : <strong className={dailyInfo.isOverDailyBudget ? "text-amber-700 dark:text-amber-400 font-extrabold" : "text-emerald-700 dark:text-emerald-400 font-extrabold"}>{formatMoney(Math.max(0, dailyInfo.todayRemaining), currency)}</strong>
                <span className="text-slate-500 dark:text-slate-400 text-xs ml-2">
                  (Alloué : {formatMoney(dailyInfo.dailyBudget, currency)}/j | Dépensé aujourd&apos;hui : {formatMoney(dailyInfo.todaySpent, currency)})
                </span>
              </p>
            </div>
          </div>

          <Link href="/dashboard" className="text-xs font-semibold text-[#1E3A5F] dark:text-sky-400 hover:underline flex items-center gap-1 shrink-0">
            <span>Tableau de bord</span>
            <span>&rarr;</span>
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => promptUnlockPersonal("Budget Journalier du Jour")}
          className="w-full text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-dashed border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shadow-xs">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Budget Journalier du Jour</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                  Cadenassé • Mode Gratuit
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Prenez un abonnement Particulier de <strong>500 FCFA/mois</strong> pour calculer votre budget quotidien et votre reste à vivre.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#1E3A5F] text-white shrink-0">
            Débloquer (500 F) &rarr;
          </span>
        </button>
      )}

      {/* Cartes KPI Concordantes avec le Tableau de bord */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between p-3.5 sm:p-5 pb-1 sm:pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Revenus du Mois
            </CardTitle>
            <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              +{formatMoney(income, currency)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 sm:mt-1 truncate">
              Salaire ({formatMoney(income - totalIncomes, currency)}) + Extras (+{formatMoney(totalIncomes, currency)})
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between p-3.5 sm:p-5 pb-1 sm:pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dépenses Réelles
            </CardTitle>
            <div className="p-1.5 sm:p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              -{formatMoney(totalExpenses, currency)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 sm:mt-1 truncate">
              {!showBudgetTools
                ? "Sorties d'argent enregistrées ce mois"
                : epargne > 0
                ? `dont ${formatMoney(epargne, currency)} d'épargne mise de côté`
                : "Consommées sur vos enveloppes de dépenses"}
            </p>
          </CardContent>
        </Card>

        {showBudgetTools ? (
          <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3.5 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Reste à Vivre Disponible
              </CardTitle>
              <div className={`p-1.5 sm:p-2 rounded-lg ${reste >= 0 ? "bg-blue-50 dark:bg-blue-950/50 text-[#1E3A5F] dark:text-sky-300" : "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400"}`}>
                <Scale className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0">
              <div className={`text-xl sm:text-2xl font-extrabold ${reste >= 0 ? "text-[#1E3A5F] dark:text-sky-300" : "text-red-600 dark:text-red-400"}`}>
                {reste >= 0 ? "+" : ""}{formatMoney(reste, currency)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 sm:mt-1 truncate">
                Soit {formatMoney(dailyInfo.dailyBudget, currency)}/j conseillés jusqu&apos;à la paie
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card
            onClick={() => promptUnlockPersonal("Reste à Vivre Disponible")}
            className="border-dashed border-amber-300 dark:border-amber-700 shadow-sm bg-amber-50/40 dark:bg-amber-950/15 cursor-pointer hover:bg-amber-50/80 dark:hover:bg-amber-950/30 transition-colors"
          >
            <CardHeader className="flex flex-row items-center justify-between p-3.5 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Reste à Vivre Disponible
              </CardTitle>
              <div className="p-1.5 sm:p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                <Lock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0">
              <div className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Cadenassé</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold mt-0.5 sm:mt-1 truncate">
                Prendre un abonnement de 500 FCFA/mois &rarr;
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Liste des transactions (Historique, recherche et filtrage inclus dès le plan Gratuit) */}
      <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 min-w-0">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <div className="space-y-0.5 min-w-0 flex-1">
            <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Historique des Transactions</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              {filteredTransactions.length === transactions.length
                ? `${transactions.length} opération${transactions.length > 1 ? "s" : ""} enregistrée${transactions.length > 1 ? "s" : ""} pour ${capitalizedMonth}.`
                : `${filteredTransactions.length} sur ${transactions.length} opération${transactions.length > 1 ? "s" : ""} pour ${capitalizedMonth}.`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            suppressHydrationWarning
            className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title={
              showReportsUnlocked
                ? "Exporter CSV"
                : "Export CSV cadenassé — Abonnement Particulier (500 FCFA/mois)"
            }
          >
            {showReportsUnlocked ? (
              <Download className="h-4 w-4 mr-2" />
            ) : (
              <Lock className="h-3.5 w-3.5 mr-2 text-amber-500" />
            )}
            <span className="hidden sm:inline">Exporter CSV</span>
          </Button>
        </CardHeader>
        <CardContent>
          {/* Barre de recherche & filtrage accessible à tous */}
          {transactions.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-4">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par libellé ou catégorie..."
                  aria-label="Rechercher une transaction"
                  className="pl-9 h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div
                role="group"
                aria-label="Filtrer par type de transaction"
                className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setTxTypeFilter("all")}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition ${
                    txTypeFilter === "all"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Toutes
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter("expense")}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition ${
                    txTypeFilter === "expense"
                      ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Dépenses
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter("income")}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition ${
                    txTypeFilter === "income"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Entrées
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 mt-1">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-850 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-[#1E3A5F] dark:text-sky-400 rounded-full mb-3">
                  <Wallet className="h-6 w-6" />
                </div>
                <p className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Aucune transaction pour ce mois</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Cliquez sur « Nouvelle transaction » ci-dessus pour enregistrer une dépense ou un revenu supplémentaire.
                </p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-850 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center">
                <Search className="h-6 w-6 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  Aucune transaction ne correspond à votre filtre
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setTxTypeFilter("all");
                  }}
                  className="text-xs font-semibold text-[#1E3A5F] dark:text-sky-400 hover:underline mt-1"
                >
                  Réinitialiser la recherche
                </button>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const isInc = isIncomeTransaction(tx);
                return (
                  <div 
                    key={tx.id} 
                    className="flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-colors group border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                      <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${isInc ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                        {isInc ? <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" /> : <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm md:text-base truncate">{tx.label}</p>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{tx.date}</span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${isInc ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"}`}>
                            {isInc ? "Revenu" : (tx.category || "Autre (Hors Budget)")}
                          </span>
                          {(tx.pendingSync || pendingEntityIds.includes(tx.id)) && (
                            <span
                              data-testid="tx-pending-sync-badge"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              title="Enregistrée localement dans IndexedDB — en attente de confirmation serveur"
                            >
                              <Clock className="h-2.5 w-2.5" />
                              <span>En attente</span>
                            </span>
                          )}
                          {tx.receiptUrl && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingReceipt({ url: tx.receiptUrl!, name: tx.receiptName || "Justificatif" });
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/70 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                              title="Cliquer pour afficher le justificatif"
                            >
                              <Paperclip className="h-3 w-3" />
                              <span>Reçu</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                      <div className={`font-bold text-xs sm:text-sm md:text-base text-right whitespace-nowrap ${isInc ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"}`}>
                        {isInc ? "+" : "-"}{formatMoney(tx.amount, currency)}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(tx.id)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-950/30 h-8 w-8 rounded-lg"
                        title="Supprimer cette transaction"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal d'Affichage Plein Écran du Reçu Attaché */}
      {viewingReceipt && (
        <Dialog open={!!viewingReceipt} onOpenChange={(open) => !open && setViewingReceipt(null)}>
          <DialogContent className="max-w-lg p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                {viewingReceipt.name}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-3 flex items-center justify-center max-h-[75vh] overflow-auto rounded-xl bg-slate-950 p-2">
              {viewingReceipt.url.toLowerCase().includes("application/pdf") || viewingReceipt.name.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={viewingReceipt.url}
                  className="w-full h-96 rounded-lg border-0"
                  title="Justificatif PDF"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={viewingReceipt.url}
                  alt={viewingReceipt.name}
                  className="max-h-[70vh] w-auto object-contain rounded-lg"
                />
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingReceipt(null)}
                className="text-xs"
              >
                Fermer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
