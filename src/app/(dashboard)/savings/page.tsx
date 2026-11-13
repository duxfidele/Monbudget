"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Target,
  CheckCircle2,
  PlusCircle,
  Trash2,
  PiggyBank,
  History,
  Calendar,
  TrendingUp,
  Sparkles,
  Pause,
  Play,
  ArrowUpRight,
  Wallet,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUIStore, SavingsGoal } from "@/lib/store/ui-store";
import { PlanGate } from "@/components/payments/plan-gate";
import {
  formatMoney,
  getTotalExpenses,
  getRemainingToLive,
  getMonthlySavingsContributions,
  SAVINGS_GOAL_TEMPLATES,
} from "@/lib/utils/budget-calc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GOAL_COLORS = [
  { name: "Bleu Océan", class: "bg-blue-600", text: "text-blue-600", bgLight: "bg-blue-50" },
  { name: "Émeraude", class: "bg-emerald-600", text: "text-emerald-600", bgLight: "bg-emerald-50" },
  { name: "Ambre", class: "bg-amber-600", text: "text-amber-600", bgLight: "bg-amber-50" },
  { name: "Violet", class: "bg-purple-600", text: "text-purple-600", bgLight: "bg-purple-50" },
  { name: "Rose Bonbon", class: "bg-pink-600", text: "text-pink-600", bgLight: "bg-pink-50" },
  { name: "Cyan", class: "bg-cyan-600", text: "text-cyan-600", bgLight: "bg-cyan-50" },
];

export default function SavingsPage() {
  const {
    savingsGoals,
    addSavingsGoal,
    removeSavingsGoal,
    addSavingsContribution,
    removeSavingsContribution,
    updateSavingsGoalStatus,
    currency,
    income,
    transactions,
    categories,
    activeMonth,
  } = useUIStore();

  // Dialog states
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);

  // New Goal form
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [goalColor, setGoalColor] = useState(GOAL_COLORS[0].class);

  // Deposit form
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNotes, setDepositNotes] = useState("");
  const [depositDate, setDepositDate] = useState(() => new Date().toISOString().split("T")[0]);

  // KPIs
  const totalSaved = savingsGoals.reduce((sum, g) => sum + g.current, 0);
  const totalTarget = savingsGoals.reduce((sum, g) => sum + g.target, 0);
  const globalProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
  const completedGoalsCount = savingsGoals.filter(g => g.current >= g.target).length;

  // Liaison directe avec Mon Budget & Transactions
  const monthlySavings = getMonthlySavingsContributions(savingsGoals, activeMonth.year, activeMonth.month);
  const totalExpenses = getTotalExpenses(transactions, monthlySavings);
  const availableBalance = getRemainingToLive(income, totalExpenses);
  const savingsEnvelope = categories.find(
    (c) => c.name.trim().toLowerCase() === "épargne"
  );

  const handleCreateGoal = async () => {
    if (!goalName || !goalTarget) {
      toast.error("Veuillez remplir le nom et le montant cible.");
      return;
    }
    const target = Number(goalTarget);
    if (isNaN(target) || target <= 0) {
      toast.error("Veuillez indiquer un montant cible valide.");
      return;
    }

    await addSavingsGoal({
      name: goalName.trim(),
      target,
      color: goalColor,
      target_date: goalTargetDate || undefined,
    });

    setGoalName("");
    setGoalTarget("");
    setGoalTargetDate("");
    setIsNewGoalOpen(false);
    toast.success("Objectif d'épargne créé avec succès !");
  };

  const handleOpenDeposit = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setDepositAmount("");
    setDepositNotes("");
    setDepositDate(new Date().toISOString().split("T")[0]);
    setIsDepositOpen(true);
  };

  const handleOpenHistory = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setIsHistoryOpen(true);
  };

  const handleSubmitDeposit = async () => {
    if (!selectedGoal) return;
    const amount = Number(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Veuillez saisir un montant de versement valide.");
      return;
    }

    try {
      await addSavingsContribution(
        selectedGoal.id,
        amount,
        depositNotes.trim() || undefined,
        depositDate
      );
      toast.success(`Versement de ${formatMoney(amount, currency)} enregistré !`, {
        description: `Ajouté à "${selectedGoal.name}" et synchronisé automatiquement avec vos Transactions et Mon Budget.`,
      });
      setIsDepositOpen(false);
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement", {
        description: e.message || "Impossible d'ajouter le versement.",
      });
    }
  };

  const handleDeleteContribution = async (contributionId: string) => {
    if (!selectedGoal) return;
    try {
      await removeSavingsContribution(contributionId, selectedGoal.id);
      toast.success("Versement supprimé.");
    } catch (e: any) {
      toast.error("Erreur lors de la suppression du versement.");
    }
  };

  return (
    <PlanGate
      feature="savings"
      featureTitle="Épargne & Projets"
      featureDescription="Créez des objectifs d'épargne concrets (Fonds d'urgence, Terrain, Scolarité, Voyage...), suivez chaque versement et synchronisez automatiquement votre épargne avec votre budget."
    >
      <div className="flex flex-col gap-8 pb-12">
        {/* 1. Modale de Création d'Objectif */}
        <Dialog open={isNewGoalOpen} onOpenChange={setIsNewGoalOpen}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Target className="h-5 w-5 text-[#1E3A5F] dark:text-sky-400" />
                Nouvel Objectif d&apos;Épargne
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Fixez un cap clair pour votre projet financier.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Modèles rapides (Pilier D) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Projets fréquents (clic rapide)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SAVINGS_GOAL_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => {
                        setGoalName(tpl.name);
                        if (!goalTarget) setGoalTarget(tpl.suggestedTarget.toString());
                        setGoalColor(tpl.color);
                      }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${goalName === tpl.name
                          ? "bg-[#1E3A5F] dark:bg-sky-600 text-white border-[#1E3A5F] dark:border-sky-600 font-semibold"
                          : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                        }`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Nom du projet</label>
                <Input
                  placeholder="Ex: Acheter une moto, Construire une maison, Scolarité..."
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Montant cible ({currency})</label>
                <Input
                  type="number"
                  placeholder="Ex: 500000"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Date d&apos;échéance souhaitée (optionnelle)</label>
                <Input
                  type="date"
                  value={goalTargetDate}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Couleur d&apos;identification</label>
                <div className="flex items-center gap-2.5 pt-1">
                  {GOAL_COLORS.map((c) => (
                    <button
                      key={c.class}
                      type="button"
                      onClick={() => setGoalColor(c.class)}
                      className={`w-7 h-7 rounded-full ${c.class} transition-transform ${goalColor === c.class ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : "opacity-80 hover:opacity-100"}`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsNewGoalOpen(false)}>Annuler</Button>
              <Button onClick={handleCreateGoal} className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold">
                Créer l&apos;objectif
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 2. Modale de Versement / Contribution */}
        <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <PiggyBank className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Verser vers {selectedGoal?.name}
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Ajoutez un montant épargné pour rapprocher votre objectif du but.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Montant à verser ({currency})</label>
                <Input
                  type="number"
                  placeholder="Ex: 25000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Date du versement</label>
                <Input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Note ou provenance (optionnelle)</label>
                <Input
                  placeholder="Ex: Épargne de paie, Prime trimestrielle, Reliquat du mois..."
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsDepositOpen(false)}>Annuler</Button>
              <Button onClick={handleSubmitDeposit} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <PlusCircle className="h-4 w-4" />
                Confirmer le versement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 3. Modale d'Historique des Contributions */}
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <History className="h-5 w-5 text-blue-600 dark:text-sky-400" />
                Historique des versements : {selectedGoal?.name}
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Total cumulé : <strong>{selectedGoal ? formatMoney(selectedGoal.current, currency) : 0}</strong> sur un objectif de {selectedGoal ? formatMoney(selectedGoal.target, currency) : 0}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
              {selectedGoal && selectedGoal.contributions && selectedGoal.contributions.length > 0 ? (
                selectedGoal.contributions.map((contrib) => (
                  <div key={contrib.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/60 dark:hover:bg-slate-800 transition">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                          +{formatMoney(contrib.amount, currency)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{new Date(contrib.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
                          {contrib.notes && (
                            <>
                              <span>•</span>
                              <span className="italic text-slate-600">{contrib.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteContribution(contrib.id)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                      title="Supprimer ce versement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Aucun versement enregistré pour le moment.
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>Fermer</Button>
              <Button
                onClick={() => {
                  setIsHistoryOpen(false);
                  if (selectedGoal) handleOpenDeposit(selectedGoal);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <Plus className="h-4 w-4" /> Nouveau versement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* En-tête de la page */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 mb-1 border border-emerald-100">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              <span>Patrimoine & Vision Long Terme</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Épargne & Projets
            </h2>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Mettez votre argent au travail et suivez vos cagnottes personnelles.
            </p>
          </div>

          <Button onClick={() => setIsNewGoalOpen(true)} className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white shadow-xs gap-1.5 w-full sm:w-auto h-10 text-xs sm:text-sm font-bold">
            <Plus className="h-4 w-4" />
            <span>Créer un objectif</span>
          </Button>
        </div>

        {/* KPI Cards (2x2 sur mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Total Épargné</CardTitle>
              <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg shrink-0">
                <PiggyBank className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div suppressHydrationWarning className="text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 truncate">
                {formatMoney(totalSaved, currency)}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">Cumulé sur vos projets</p>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Objectif Global</CardTitle>
              <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-950/60 rounded-lg shrink-0">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-sky-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div suppressHydrationWarning className="text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 truncate">
                {formatMoney(totalTarget, currency)}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">Somme des cibles visées</p>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Progression</CardTitle>
              <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-950/60 rounded-lg shrink-0">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div suppressHydrationWarning className="text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                {Math.round(globalProgress)}%
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(globalProgress, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Complétés</CardTitle>
              <div className="p-1.5 sm:p-2 bg-amber-100 dark:bg-amber-950/60 rounded-lg shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div suppressHydrationWarning className="text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                {completedGoalsCount} <span className="text-xs sm:text-sm font-normal text-slate-400">/ {savingsGoals.length}</span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                {savingsGoals.length - completedGoalsCount} projet(s) en cours
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bandeau de liaison directe avec Mon Budget & Transactions */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/80 via-white to-blue-50/60 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-700 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Wallet className="h-4 w-4 text-[#1E3A5F] shrink-0" />
              <span>Solde disponible (Mon Budget) :</span>
              <strong className={availableBalance < 0 ? "text-red-600" : "text-emerald-700"}>
                {formatMoney(availableBalance, currency)}
              </strong>
            </div>
            <span className="hidden sm:inline text-slate-300">|</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <PiggyBank className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Épargné ce mois-ci :</span>
              <strong className="text-emerald-700">{formatMoney(monthlySavings, currency)}</strong>
              {savingsEnvelope && (
                <span className="text-xs text-slate-500">
                  (sur {formatMoney(savingsEnvelope.amount, currency)} prévus dans Mon Budget)
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link href="/budget">
              <Button
                variant="outline"
                size="sm"
                className="border-blue-200 bg-white hover:bg-blue-50 text-[#1E3A5F] text-xs h-8 gap-1.5"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Mon Budget</span>
              </Button>
            </Link>
            <Link href="/transactions">
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800 text-xs h-8 gap-1.5"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Transactions</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Grille des Objectifs d'Épargne */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {savingsGoals.map((goal) => {
            const percent = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
            const isCompleted = goal.current >= goal.target;
            const isPaused = goal.status === "paused";
            const remainingAmount = Math.max(0, goal.target - goal.current);

            return (
              <Card key={goal.id} className="min-w-0 border-none shadow-sm flex flex-col group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-xl ${goal.color || "bg-blue-600"} text-white shadow-xs`}>
                      <Target className="h-6 w-6" />
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Pause / Resume Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateSavingsGoalStatus(goal.id, isPaused ? "active" : "paused")}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 h-8 w-8"
                        title={isPaused ? "Reprendre l'objectif" : "Mettre en pause"}
                      >
                        {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      </Button>

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Supprimer définitivement l'objectif "${goal.name}" ?`)) {
                            removeSavingsGoal(goal.id);
                            toast.success("Objectif supprimé.");
                          }
                        }}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-950/30 h-8 w-8"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate min-w-0">{goal.name}</CardTitle>
                      {isPaused && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          En pause
                        </span>
                      )}
                    </div>
                    {goal.target_date && (
                      <CardDescription className="text-xs flex items-center gap-1 mt-1 text-slate-400">
                        <Calendar className="h-3 w-3" />
                        Échéance : {new Date(goal.target_date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                      </CardDescription>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between pt-0 space-y-5">
                  <div>
                    <div className="flex flex-wrap justify-between items-baseline gap-1 mb-1.5">
                      <span suppressHydrationWarning className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                        {formatMoney(goal.current, currency)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Cible : {formatMoney(goal.target, currency)}
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${isCompleted ? 'bg-emerald-500' : goal.color || 'bg-blue-600'} rounded-full transition-all duration-700`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs mt-2 text-slate-500">
                      <span className="font-semibold text-slate-700">{Math.round(percent)}% atteint</span>
                      <span>
                        {isCompleted ? (
                          <span className="text-emerald-600 font-bold">100% financé 🎉</span>
                        ) : (
                          <span>Reste : {formatMoney(remainingAmount, currency)}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleOpenDeposit(goal)}
                        disabled={isPaused}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] sm:text-xs h-9 px-2 sm:px-3 gap-1 sm:gap-1.5"
                      >
                        <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span>Verser</span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => handleOpenHistory(goal)}
                        className="border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] sm:text-xs h-9 px-2 sm:px-3 gap-1 sm:gap-1.5"
                      >
                        <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 shrink-0" />
                        <span className="truncate">Versements ({goal.contributions?.length || 0})</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {savingsGoals.length === 0 && (
            <div className="col-span-full p-6 sm:p-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-[#1E3A5F] dark:text-sky-400 rounded-full mb-3">
                <PiggyBank className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Aucun projet d&apos;épargne pour l&apos;instant</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 max-w-md">
                Choisissez un objectif concret ci-dessous ou créez votre propre projet d&apos;épargne :
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-xl">
                {SAVINGS_GOAL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => {
                      setGoalName(tpl.name);
                      setGoalTarget(tpl.suggestedTarget.toString());
                      setGoalColor(tpl.color);
                      setIsNewGoalOpen(true);
                    }}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-[#1E3A5F] dark:hover:text-sky-300 border border-slate-200 dark:border-slate-700 hover:border-blue-200 transition"
                  >
                    + {tpl.name}
                  </button>
                ))}
              </div>
              <Button onClick={() => setIsNewGoalOpen(true)} className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold gap-2">
                <Plus className="h-4 w-4" />
                <span>Créer mon premier objectif</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </PlanGate>
  );
}
