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
  Zap
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";
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
    payDay
  } = useUIStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newAmountStr, setNewAmountStr] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newIncomeSource, setNewIncomeSource] = useState<string>(INCOME_SOURCES[0]);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newType, setNewType] = useState<"expense" | "income">("expense");

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

  const totalExpenses = getTotalExpenses(transactions);

  const epargne = getMonthlySavingsContributions(savingsGoals, activeMonth.year, activeMonth.month);
  const reste = getRemainingToLive(income, totalExpenses, epargne);
  const soldeNet = income - totalExpenses;

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

    // Alerte seuil pour les dépenses (si notifications d'alerte activées)
    const isAlertEnabled = notifications?.budgetAlert !== false;
    const effectiveThreshold = notifications?.budgetAlertThreshold || alertThreshold || 80;

    if (isAlertEnabled && newType === "expense" && assignedCategory !== "Autre (Hors Budget)") {
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
      });
      
      toast.success(
        newType === "income" 
          ? `Revenu de ${formatMoney(amount, currency)} ajouté et synchronisé !` 
          : `Dépense de ${formatMoney(amount, currency)} enregistrée !`
      );
      setIsDialogOpen(false);
      
      // Reset form
      setNewLabel("");
      setNewAmountStr("");
      setNewDate(new Date().toISOString().split("T")[0]);
      if (categories.length > 0) setNewCategory(categories[0].name);
      else setNewCategory("Autre (Hors Budget)");
    } catch (error: any) {
      toast.error("Erreur: " + (error.message || "Impossible d ajouter la transaction"));
    }
  };

  const handleExportCSV = () => {
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
    const csvContent = [
      headers.join(","),
      ...rows.map((e) => e.map((item) => `"${item}"`).join(",")),
    ].join("\n");
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
                    <span>
                      💡 Budget journalier restant : <strong className="text-emerald-700 dark:text-emerald-400">{formatMoney(Math.max(0, dailyInfo.todayRemaining), currency)}</strong>. Cette dépense sera déduite automatiquement.
                    </span>
                  ) : (
                    <span>
                      💡 Ce revenu s'ajoutera directement aux revenus du mois de {capitalizedMonth}.
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

      {/* Bandeau d'information du Budget Journalier Conseillé déduit automatiquement */}
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
              Disponible aujourd'hui : <strong className={dailyInfo.isOverDailyBudget ? "text-amber-700 dark:text-amber-400 font-extrabold" : "text-emerald-700 dark:text-emerald-400 font-extrabold"}>{formatMoney(Math.max(0, dailyInfo.todayRemaining), currency)}</strong>
              <span className="text-slate-500 dark:text-slate-400 text-xs ml-2">
                (Alloué : {formatMoney(dailyInfo.dailyBudget, currency)}/j | Dépensé aujourd'hui : {formatMoney(dailyInfo.todaySpent, currency)})
              </span>
            </p>
          </div>
        </div>

        <Link href="/dashboard" className="text-xs font-semibold text-[#1E3A5F] dark:text-sky-400 hover:underline flex items-center gap-1 shrink-0">
          <span>Tableau de bord</span>
          <span>&rarr;</span>
        </Link>
      </div>

      {/* Cartes KPI Concordantes avec le Tableau de bord */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Revenus du Mois
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              +{formatMoney(income, currency)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Salaire ({formatMoney(income - totalIncomes, currency)}) + Extras (+{formatMoney(totalIncomes, currency)})
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dépenses Réelles
            </CardTitle>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              -{formatMoney(totalExpenses, currency)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Consommées sur vos enveloppes de dépenses
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Reste à Vivre Disponible
            </CardTitle>
            <div className={`p-2 rounded-lg ${reste >= 0 ? "bg-blue-50 dark:bg-blue-950/50 text-[#1E3A5F] dark:text-sky-300" : "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400"}`}>
              <Scale className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${reste >= 0 ? "text-[#1E3A5F] dark:text-sky-300" : "text-red-600 dark:text-red-400"}`}>
              {reste >= 0 ? "+" : ""}{formatMoney(reste, currency)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Soit {formatMoney(dailyInfo.dailyBudget, currency)}/j conseillés jusqu'à la paie
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des transactions */}
      <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-0.5">
            <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Historique des Transactions</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              {transactions.length} opération{transactions.length > 1 ? "s" : ""} enregistrée{transactions.length > 1 ? "s" : ""} pour {capitalizedMonth}.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Exporter CSV</span>
          </Button>
        </CardHeader>
        <CardContent>
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
            ) : (
              transactions.map((tx) => {
                const isInc = isIncomeTransaction(tx);
                return (
                  <div 
                    key={tx.id} 
                    className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-colors group border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${isInc ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                        {isInc ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm md:text-base truncate">{tx.label}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{tx.date}</span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${isInc ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"}`}>
                            {isInc ? "Revenu" : (tx.category || "Autre (Hors Budget)")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`font-bold text-sm md:text-base text-right ${isInc ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"}`}>
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
    </div>
  );
}
