"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  Copy, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  RefreshCw,
  X,
  Wallet,
  Edit2,
  Check,
  Zap,
  RotateCcw,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  PiggyBank,
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore, Category } from "@/lib/store/ui-store";
import { PlanGate } from "@/components/payments/plan-gate";
import { canAccessFeature, getSubscriptionCountdownInfo } from "@/lib/moneriz-plans";
import { 
  formatMoney, 
  getSpentByCategory, 
  getCategoryProgress,
  getEffectiveTotalAllocated,
  formatThousands,
  parseThousands,
  isIncomeTransaction,
  getTotalExpenses,
  getRemainingToLive,
  getDailyBudget,
  getTodayExpenses,
  getMonthlySavingsContributions,
  getTotalPayableDebts,
  getTotalReceivableDebts,
  AFRICAN_EXPENSE_CATEGORIES,
  INCOME_SOURCES
} from "@/lib/utils/budget-calc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COLORS = [
  "bg-blue-500", 
  "bg-emerald-500", 
  "bg-amber-500", 
  "bg-purple-500", 
  "bg-pink-500", 
  "bg-indigo-500",
  "bg-rose-500",
  "bg-teal-500"
];

const DEFAULT_CATEGORIES = AFRICAN_EXPENSE_CATEGORIES;

/**
 * Composant de saisie numérique ergonomique
 * - Séparateurs de milliers en temps réel (ex: 50 000)
 * - Sélection automatique au clic pour remplacer immédiatement
 * - Backspace intelligent
 * - Synchronisation locale instantanée (0 lag)
 */
function BudgetAmountInput({
  value,
  onChange,
  currency,
  placeholder = "0",
  className = "",
  inputClassName = "",
  id,
}: {
  value: number;
  onChange: (val: number) => void;
  currency: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);
  const [displayValue, setDisplayValue] = useState<string>(
    value > 0 ? formatThousands(value) : value === 0 ? "0" : ""
  );

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplayValue(value > 0 ? formatThousands(value) : value === 0 ? "0" : "");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const raw = input.value;
    const oldCursor = input.selectionStart || 0;

    // Calcul du nombre de chiffres présents avant la position du curseur
    const digitsBefore = raw.slice(0, oldCursor).replace(/[^0-9]/g, "").length;
    const digitsOnly = raw.replace(/[^0-9]/g, "");

    if (!digitsOnly) {
      setDisplayValue("");
      onChange(0);
      return;
    }

    const formatted = formatThousands(digitsOnly);
    setDisplayValue(formatted);
    const parsed = parseInt(digitsOnly, 10);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }

    // Repositionnement précis du curseur sans aucun saut intempestif
    requestAnimationFrame(() => {
      if (inputRef.current) {
        let newCursor = 0;
        let count = 0;
        while (newCursor < formatted.length && count < digitsBefore) {
          if (formatted[newCursor] !== " ") count++;
          newCursor++;
        }
        inputRef.current.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <Input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        onFocus={(e) => {
          isFocusedRef.current = true;
          e.target.select();
        }}
        onBlur={(e) => {
          isFocusedRef.current = false;
          const digits = e.target.value.replace(/[^0-9]/g, "");
          const parsed = digits ? parseInt(digits, 10) : 0;
          setDisplayValue(parsed > 0 ? formatThousands(parsed) : "0");
          onChange(parsed);
        }}
        placeholder={placeholder}
        className={`font-bold pr-14 text-right rounded-lg transition-all focus-visible:ring-[#1E3A5F] ${inputClassName}`}
      />
      <span className="absolute right-3 text-xs font-semibold text-slate-400 select-none pointer-events-none">
        {currency}
      </span>
    </div>
  );
}

/**
 * Composant de saisie fluide pour le revenu mensuel
 */
function IncomeInput({
  initialIncome,
  currency,
  onCommit,
}: {
  initialIncome: number;
  currency: string;
  onCommit: (val: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);
  const [displayValue, setDisplayValue] = useState<string>(
    initialIncome > 0 ? formatThousands(initialIncome) : ""
  );

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplayValue(initialIncome > 0 ? formatThousands(initialIncome) : "");
    }
  }, [initialIncome]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const raw = input.value;
    const oldCursor = input.selectionStart || 0;

    const digitsBefore = raw.slice(0, oldCursor).replace(/[^0-9]/g, "").length;
    const digitsOnly = raw.replace(/[^0-9]/g, "");

    if (!digitsOnly) {
      setDisplayValue("");
      onCommit(0);
      return;
    }

    const formatted = formatThousands(digitsOnly);
    setDisplayValue(formatted);
    const parsed = parseInt(digitsOnly, 10);
    if (!isNaN(parsed)) {
      onCommit(parsed);
    }

    requestAnimationFrame(() => {
      if (inputRef.current) {
        let newCursor = 0;
        let count = 0;
        while (newCursor < formatted.length && count < digitsBefore) {
          if (formatted[newCursor] !== " ") count++;
          newCursor++;
        }
        inputRef.current.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  return (
    <div className="relative flex items-center w-full">
      <Input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        onFocus={(e) => {
          isFocusedRef.current = true;
          e.target.select();
        }}
        onBlur={(e) => {
          isFocusedRef.current = false;
          const digits = e.target.value.replace(/[^0-9]/g, "");
          const parsed = digits ? parseInt(digits, 10) : 0;
          setDisplayValue(parsed > 0 ? formatThousands(parsed) : "");
          onCommit(parsed);
        }}
        placeholder="Ex: 350 000"
        className="bg-white/10 border-white/20 text-white text-xl md:text-2xl font-black placeholder:text-white/40 focus-visible:ring-white/40 h-12 pr-16 rounded-xl"
      />
      <div className="absolute right-3 flex items-center gap-1.5">
        <span className="text-white/70 font-bold text-xs select-none">
          {currency}
        </span>
        {displayValue && (
          <button
            type="button"
            onClick={() => {
              setDisplayValue("");
              onCommit(0);
            }}
            className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
            title="Effacer le montant"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Ligne d envelope budgétaire avec saisie ultra fluide, chips rapides et renommage inline
 */
function CategoryRowInput({
  category,
  currency,
  onUpdateAmount,
  onUpdateCategory,
  onRemove,
  spent,
  remainingToAllocate,
}: {
  category: Category;
  currency: string;
  onUpdateAmount: (id: string, amount: number) => void;
  onUpdateCategory: (id: string, updates: Partial<{ name: string; color: string }>) => void;
  onRemove: (id: string) => void;
  spent: number;
  remainingToAllocate: number;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameText, setEditNameText] = useState(category.name);
  const [showQuickPills, setShowQuickPills] = useState(false);
  const progress = getCategoryProgress(spent, category.amount);

  const saveName = () => {
    const trimmed = editNameText.trim();
    if (trimmed && trimmed !== category.name) {
      onUpdateCategory(category.id, { name: trimmed });
      toast.success(`Catégorie renommée en "${trimmed}"`);
    }
    setIsEditingName(false);
  };

  const handleAddQuickAmount = (increment: number) => {
    const current = Number(category.amount) || 0;
    const newAmount = Math.max(0, current + increment);
    onUpdateAmount(category.id, newAmount);
  };

  const handleAllocateRemainder = () => {
    if (remainingToAllocate <= 0) return;
    const current = Number(category.amount) || 0;
    const newAmount = current + remainingToAllocate;
    onUpdateAmount(category.id, newAmount);
    toast.success(`Reliquat de ${formatMoney(remainingToAllocate, currency)} alloué à ${category.name} !`);
  };

  const handleResetToZero = () => {
    onUpdateAmount(category.id, 0);
  };

  return (
    <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs hover:border-slate-200 dark:hover:border-slate-700 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Nom de la catégorie avec renommage inline */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${category.color || "bg-blue-500"}`} />
          
          {isEditingName ? (
            <div className="flex items-center gap-1.5 flex-1 max-w-xs">
              <Input
                type="text"
                value={editNameText}
                onChange={(e) => setEditNameText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setEditNameText(category.name);
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                className="h-8 text-sm font-semibold rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={saveName} 
                className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded"
                title="Enregistrer"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => {
                  setEditNameText(category.name);
                  setIsEditingName(false);
                }} 
                className="h-7 w-7 text-slate-400 hover:bg-slate-100 rounded"
                title="Annuler"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group truncate">
              <span 
                className="font-semibold text-slate-800 text-sm md:text-base truncate cursor-pointer hover:text-[#1E3A5F]"
                onClick={() => setIsEditingName(true)}
                title="Cliquer pour renommer"
              >
                {category.name}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-600 rounded"
                title="Renommer la catégorie"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        
        {/* Champ de saisie ergonomique et actions */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <BudgetAmountInput
            value={category.amount}
            onChange={(val) => onUpdateAmount(category.id, val)}
            currency={currency}
            className="flex-1 sm:w-40 md:w-44"
            inputClassName="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-sm md:text-base text-slate-900 dark:text-slate-100"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowQuickPills(!showQuickPills)}
            className={`h-9 w-9 rounded-lg text-slate-400 hover:text-[#1E3A5F] dark:hover:text-sky-300 hover:bg-blue-50 dark:hover:bg-slate-800 ${showQuickPills ? "bg-blue-50 dark:bg-slate-800 text-[#1E3A5F] dark:text-sky-300" : ""}`}
            title="Ajustements rapides (+ / -)"
          >
            <Zap className="h-4 w-4" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onRemove(category.id)}
            className="text-slate-400 hover:text-red-600 dark:hover:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-950/30 h-9 w-9 rounded-lg"
            title="Supprimer cette catégorie"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Barre d ajustements rapides (Chips interactifs) */}
      {showQuickPills && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 pb-0.5 border-t border-slate-200/60 dark:border-slate-800 text-xs">
          <span className="text-[11px] font-medium text-slate-400 mr-1">Ajuster :</span>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(5000)}
            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#1E3A5F] dark:hover:border-sky-400 hover:bg-blue-50/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition"
          >
            +5 000
          </button>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(10000)}
            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#1E3A5F] dark:hover:border-sky-400 hover:bg-blue-50/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition"
          >
            +10 000
          </button>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(25000)}
            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#1E3A5F] dark:hover:border-sky-400 hover:bg-blue-50/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition"
          >
            +25 000
          </button>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(50000)}
            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#1E3A5F] dark:hover:border-sky-400 hover:bg-blue-50/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition"
          >
            +50 000
          </button>
          {remainingToAllocate > 0 && (
            <button
              type="button"
              onClick={handleAllocateRemainder}
              className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-semibold transition flex items-center gap-1"
            >
              <span>+ Reste ({formatThousands(remainingToAllocate)})</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleResetToZero}
            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-rose-950/40 hover:text-red-600 dark:hover:text-rose-400 text-slate-500 font-medium transition ml-auto flex items-center gap-1"
            title="Remettre à 0"
          >
            <RotateCcw className="h-3 w-3" />
            <span>0</span>
          </button>
        </div>
      )}
      
      {/* Jauge et indicateur de dépenses */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        <span>Dépensé : <strong className="text-slate-700 dark:text-slate-200">{formatMoney(spent, currency)}</strong></span>
        <span className={progress.isOverBudget ? "text-red-600 dark:text-rose-400 font-semibold" : "text-emerald-600 dark:text-emerald-400 font-semibold"}>
          {progress.isOverBudget 
            ? `Dépassement : ${formatMoney(Math.abs(progress.remaining), currency)}`
            : `Disponible : ${formatMoney(progress.remaining, currency)}`
          }
        </span>
      </div>
      
      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-0.5">
        <div 
          className={`h-full ${progress.isOverBudget ? "!bg-red-500" : category.color || "bg-blue-500"} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(progress.percent, 100)}%` }} 
        />
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const { 
    income, 
    baseSalary, 
    incomeEntries,
    setSalary,
    addIncomeEntry,
    removeIncomeEntry,
    saveBudget,
    categories, 
    addCategory, 
    removeCategory, 
    updateCategory,
    updateCategoryAmount,
    transactions,
    currency,
    activeMonth,
    duplicatePreviousMonth,
    savingsGoals,
    debts,
    payDay,
    subscriptionPlan,
    subscriptionStatus,
    subscriptionExpiresAt,
    subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdminUser,
  } = useUIStore();

  const subscriptionCountdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    trialEndsAt: subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdmin: isAdminUser,
  });
  const canUseBudget =
    isAdminUser || canAccessFeature(subscriptionCountdown.effectivePlanId, "budget");

  const [newCatName, setNewCatName] = useState("");
  const [newCatAmount, setNewCatAmount] = useState<number>(0);
  const [newCatColor, setNewCatColor] = useState(COLORS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  // Nouvel ajout de source de revenu (Pilier B)
  const [incomeSourceType, setIncomeSourceType] = useState<string>(INCOME_SOURCES[0]);
  const [incomeLabel, setIncomeLabel] = useState("");
  const [incomeAmount, setIncomeAmount] = useState<number>(0);
  const [showAddIncomeForm, setShowAddIncomeForm] = useState(false);

  // Mois actif formaté
  const activeDate = new Date(activeMonth.year, activeMonth.month - 1, 1);
  const formattedActiveMonth = activeDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric"
  });
  const capitalizedActiveMonth = formattedActiveMonth.charAt(0).toUpperCase() + formattedActiveMonth.slice(1);

  // Mois précédent formaté
  const prevDate = new Date(
    activeMonth.month === 1 ? activeMonth.year - 1 : activeMonth.year,
    activeMonth.month === 1 ? 11 : activeMonth.month - 2,
    1
  );
  const formattedPrevMonth = prevDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric"
  });

  const additionalIncomes = transactions
    .filter((tx) => isIncomeTransaction(tx))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const rawMonthlySavings = getMonthlySavingsContributions(savingsGoals, activeMonth.year, activeMonth.month);
  const epargne = Math.max(rawMonthlySavings, getSpentByCategory(transactions, "Épargne", rawMonthlySavings));
  const depenses = getTotalExpenses(transactions, epargne);
  const resteReel = getRemainingToLive(income, depenses);

  const totalAllocated = getEffectiveTotalAllocated(categories, transactions, epargne);
  const remaining = income - totalAllocated;
  const totalRealOutflows = depenses;
  const reservedInEnvelopes = Math.max(0, totalAllocated - totalRealOutflows);

  // Liaison directe avec Dettes & Créances
  const totalPayableDebts = getTotalPayableDebts(debts);
  const totalReceivableDebts = getTotalReceivableDebts(debts);
  const repaidThisMonth = getSpentByCategory(transactions, "Remboursement de dette");
  const recoveredThisMonth = transactions
    .filter(
      (tx) =>
        isIncomeTransaction(tx) &&
        (tx.category === "Recouvrement de créance" || tx.label.startsWith("Remboursement reçu :"))
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
  const debtEnvelope = categories.find(
    (c) => c.name.trim().toLowerCase() === "remboursement de dette"
  );
  const savingsEnvelope = categories.find(
    (c) => c.name.trim().toLowerCase() === "épargne" || c.name.trim().toLowerCase() === "epargne"
  );
  const totalSavingsAccumulated = savingsGoals.reduce((sum, g) => sum + (Number(g.current) || 0), 0);

  // Comptabilisation automatique de l'épargne dans Mon Budget même si elle n'a pas été budgétisée manuellement
  useEffect(() => {
    if (!canUseBudget || epargne <= 0) return;
    if (!savingsEnvelope) {
      const uuid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `cat-sav-${Date.now()}`;
      addCategory({
        id: uuid,
        name: "Épargne",
        amount: epargne,
        color: "bg-emerald-600",
      });
    } else if ((Number(savingsEnvelope.amount) || 0) < epargne) {
      updateCategoryAmount(savingsEnvelope.id, epargne);
    }
  }, [canUseBudget, epargne, savingsEnvelope, addCategory, updateCategoryAmount]);

  const handleBudgetizeSavingsEnvelope = async () => {
    const suggestedAmount =
      income > 0
        ? Math.max(10000, Math.round((income * 0.1) / 1000) * 1000)
        : 25000;

    if (savingsEnvelope) {
      await updateCategoryAmount(savingsEnvelope.id, suggestedAmount);
      toast.success(
        `Enveloppe « Épargne » ajustée à ${formatMoney(suggestedAmount, currency)} !`
      );
    } else {
      const uuid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString();
      await addCategory({
        id: uuid,
        name: "Épargne",
        amount: suggestedAmount,
        color: "bg-emerald-600",
      });
      toast.success(
        `Enveloppe « Épargne » (${formatMoney(suggestedAmount, currency)}) créée dans votre budget !`
      );
    }
  };

  const handleBudgetizeDebtEnvelope = async () => {
    const suggestedAmount =
      totalPayableDebts > 0
        ? remaining > 0
          ? Math.min(totalPayableDebts, remaining)
          : totalPayableDebts
        : 25000;

    if (debtEnvelope) {
      await updateCategoryAmount(debtEnvelope.id, suggestedAmount);
      toast.success(
        `Enveloppe « Remboursement de dette » ajustée à ${formatMoney(suggestedAmount, currency)} !`
      );
    } else {
      const uuid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString();
      await addCategory({
        id: uuid,
        name: "Remboursement de dette",
        amount: suggestedAmount,
        color: "bg-rose-500",
      });
      toast.success(
        `Enveloppe « Remboursement de dette » (${formatMoney(suggestedAmount, currency)}) créée dans votre budget !`
      );
    }
  };

  const todayISO = new Date().toISOString().split("T")[0];
  const todayExpenses = getTodayExpenses(transactions, todayISO);

  const dailyInfo = getDailyBudget({
    remainingAmount: resteReel,
    totalIncome: income,
    targetPayDay: payDay || 28,
    currentDate: new Date(),
    todayExpenses,
    currency,
  });

  const handleAddCategory = async () => {
    const trimmedName = newCatName.trim();
    if (!trimmedName) {
      toast.error("Veuillez renseigner un nom pour la catégorie.");
      return;
    }

    const alreadyExists = categories.some((c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (alreadyExists) {
      toast.error(`La catégorie "${trimmedName}" existe déjà dans votre budget.`);
      return;
    }

    const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    await addCategory({
      id: uuid,
      name: trimmedName,
      amount: newCatAmount,
      color: newCatColor,
    });

    setNewCatName("");
    setNewCatAmount(0);
    setNewCatColor(COLORS[(categories.length + 1) % COLORS.length]);
    toast.success(`Catégorie "${trimmedName}" ajoutée avec succès !`);
  };

  const executeDuplication = async () => {
    setIsDuplicating(true);
    try {
      const res = await duplicatePreviousMonth();
      toast.success("Budget dupliqué avec succès !", {
        description: `${res.allocationsCount} enveloppes et ${formatMoney(res.income, currency)} importés depuis ${res.prevMonthName}.`,
      });
    } catch (e: any) {
      toast.error("Impossible de dupliquer le budget", {
        description: e.message || "Une erreur est survenue lors de la duplication.",
      });
    } finally {
      setIsDuplicating(false);
      setIsConfirmDialogOpen(false);
    }
  };

  const handleDuplicateClick = () => {
    const hasExistingAllocations = categories.some(c => c.amount > 0);
    if (hasExistingAllocations) {
      setIsConfirmDialogOpen(true);
    } else {
      executeDuplication();
    }
  };

  const handleSave = async () => {
    await saveBudget();
    toast.success("Budget mensuel validé !", {
      description: `Vos enveloppes et revenus pour ${capitalizedActiveMonth} sont enregistrés et synchronisés.`,
    });
  };

  return (
    <PlanGate
      feature="budget"
      featureTitle="Budget Mensuel par Enveloppes"
      featureDescription="Répartissez votre salaire par enveloppes (Alimentation, Loyer, Transport, Scolarité, Solidarité...), suivez votre Reste à vivre journalier jusqu'à la paie et recevez des alertes de dépassement."
    >
    <div className="flex flex-col gap-8 pb-12">
      {/* Dialogue de confirmation de duplication */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Copy className="h-5 w-5 text-[#1E3A5F] dark:text-sky-400" />
              Dupliquer le budget de {formattedPrevMonth} ?
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-300 pt-2 text-sm leading-relaxed">
              Vous avez déjà configuré des montants pour <strong>{capitalizedActiveMonth}</strong>.
              <br /><br />
              Cette action va reconduire les enveloppes et le salaire du mois précédent en écrasant les plafonds actuels. Voulez-vous continuer ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsConfirmDialogOpen(false)}
              disabled={isDuplicating}
            >
              Annuler
            </Button>
            <Button 
              onClick={executeDuplication}
              disabled={isDuplicating}
              className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white gap-2"
            >
              {isDuplicating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Duplication en cours...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Oui, dupliquer le budget
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1E3A5F] mb-1 border border-blue-100">
            <Layers className="h-3.5 w-3.5" />
            <span>Feuille mensuelle de répartition</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Budget de {capitalizedActiveMonth}
          </h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Saisissez votre salaire et ajustez vos enveloppes de dépenses en toute fluidité.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={handleDuplicateClick} 
            disabled={isDuplicating}
            className="flex-1 sm:flex-none border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs gap-1.5 h-10 text-xs sm:text-sm font-semibold"
            title="Copier les enveloppes et le salaire du mois précédent"
          >
            {isDuplicating ? (
              <RefreshCw className="h-4 w-4 animate-spin text-slate-600" />
            ) : (
              <Copy className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400" />
            )}
            <span className="truncate">Dupliquer {formattedPrevMonth}</span>
          </Button>

          <Button onClick={handleSave} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5 h-10 text-xs sm:text-sm font-bold">
            <Save className="h-4 w-4" />
            <span>Enregistrer</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Résumé & Pilotage */}
        <div className="lg:col-span-1 space-y-5">
          {/* Revenu Card avec multi-sources (Pilier B) */}
          <Card className="border-none shadow-md bg-gradient-to-br from-[#1E3A5F] to-[#2B4E7E] text-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-300" />
                  Sources de Revenus du Mois
                </CardTitle>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddIncomeForm(!showAddIncomeForm)}
                  className="h-7 px-2.5 text-xs bg-white/15 hover:bg-white/25 text-white rounded-lg gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Ajouter une source</span>
                </Button>
              </div>
              <CardDescription className="text-xs text-slate-300">
                Salaire, Commerce, Activités secondaires, Prestations, Loyers...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold block mb-1">
                    Revenu principal ou total déclaré
                  </span>
                  <IncomeInput 
                    initialIncome={baseSalary > 0 ? baseSalary : income} 
                    currency={currency} 
                    onCommit={(val) => setSalary(val)} 
                  />
                </div>

                {/* Formulaire d'ajout d'une source de revenu spécifique */}
                {showAddIncomeForm && (
                  <div className="p-3 rounded-xl bg-white/10 border border-white/20 space-y-2.5 animate-in fade-in">
                    <div className="text-xs font-semibold text-emerald-300">
                      Nouvelle source de revenu
                    </div>
                    <select
                      value={incomeSourceType}
                      onChange={(e) => setIncomeSourceType(e.target.value)}
                      className="flex h-9 w-full rounded-lg bg-slate-900/70 border border-white/20 px-2.5 text-xs text-white focus:outline-none"
                    >
                      {INCOME_SOURCES.map((src) => (
                        <option key={src} value={src} className="bg-slate-900 text-white">
                          {src}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Précision (ex: Boutique, Chantier, Loyer studio...)"
                      value={incomeLabel}
                      onChange={(e) => setIncomeLabel(e.target.value)}
                      className="h-9 text-xs bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                    <BudgetAmountInput
                      value={incomeAmount}
                      onChange={(val) => setIncomeAmount(val)}
                      currency={currency}
                      placeholder="Montant"
                      inputClassName="bg-white/10 border-white/20 text-white h-9 text-xs"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAddIncomeForm(false)}
                        className="h-8 text-xs text-slate-300 hover:text-white hover:bg-white/10"
                      >
                        Annuler
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          if (incomeAmount <= 0) {
                            toast.error("Veuillez saisir un montant supérieur à 0.");
                            return;
                          }
                          await addIncomeEntry({
                            sourceType: incomeSourceType,
                            label: incomeLabel.trim() || incomeSourceType,
                            amount: incomeAmount,
                          });
                          setIncomeLabel("");
                          setIncomeAmount(0);
                          setShowAddIncomeForm(false);
                          toast.success(`Source "${incomeSourceType}" ajoutée à vos revenus !`);
                        }}
                        className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                      >
                        Ajouter ce revenu
                      </Button>
                    </div>
                  </div>
                )}

                {/* Liste des sources de revenus enregistrées */}
                {incomeEntries && incomeEntries.length > 0 && (
                  <div className="space-y-1.5 bg-black/20 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Détail des sources ({incomeEntries.length})
                    </div>
                    {incomeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-none"
                      >
                        <div className="truncate pr-2">
                          <span className="font-semibold text-emerald-300">{entry.sourceType}</span>
                          {entry.label && entry.label !== entry.sourceType && (
                            <span className="text-slate-300"> • {entry.label}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <strong className="text-white">{formatMoney(entry.amount, currency)}</strong>
                          <button
                            type="button"
                            onClick={() => {
                              removeIncomeEntry(entry.id);
                              toast.info("Source de revenu retirée.");
                            }}
                            className="text-slate-400 hover:text-red-300 p-0.5"
                            title="Supprimer cette source"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {income > 0 && (
                  <div className="bg-white/10 p-2.5 rounded-lg border border-white/10 text-xs space-y-1.5 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200">Budget journalier conseillé :</span>
                      <strong className="text-white">{formatMoney(dailyInfo.dailyBudget, currency)}/j</strong>
                    </div>
                    <div className="flex items-center justify-between text-emerald-300 font-semibold text-[11px]">
                      <span>Disponible aujourd'hui (déduit auto) :</span>
                      <span>{formatMoney(Math.max(0, dailyInfo.todayRemaining), currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300 text-[11px] pt-1 border-t border-white/10">
                      <span>Solde disponible en caisse :</span>
                      <strong className="text-white">{formatMoney(resteReel, currency)}</strong>
                    </div>
                  </div>
                )}
                {additionalIncomes > 0 && (
                  <div className="text-[11px] bg-white/10 p-2 rounded-lg text-slate-200 space-y-0.5 border border-white/10">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Revenus fixes / déclarés :</span>
                      <strong>{formatMoney(baseSalary, currency)}</strong>
                    </div>
                    <div className="flex justify-between text-emerald-300">
                      <span>Entrées additionnelles (Transactions) :</span>
                      <strong>+{formatMoney(additionalIncomes, currency)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Solde réel restant & Répartition Card */}
          <Card className={`border-none shadow-sm transition-colors ${resteReel < 0 ? "bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60" : resteReel === 0 ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60" : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">Solde réel restant</CardTitle>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Solde disponible réel
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div suppressHydrationWarning className={`text-2xl sm:text-3xl font-extrabold ${resteReel < 0 ? "text-red-600 dark:text-rose-400" : resteReel === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100"}`}>
                {formatMoney(resteReel, currency)}
              </div>

              <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Dépenses + Épargne déjà sorties :</span>
                  <strong className="text-slate-800 dark:text-slate-100">{formatMoney(totalRealOutflows, currency)}</strong>
                </div>
                {epargne > 0 && (
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-[11px]">
                    <span>• dont Épargne comptabilisée auto :</span>
                    <strong>{formatMoney(epargne, currency)}</strong>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-700 text-[11px]">
                  <span>Réservé dans vos enveloppes restantes :</span>
                  <strong className="text-amber-700 dark:text-amber-400">{formatMoney(reservedInEnvelopes, currency)}</strong>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Marge libre non affectée (à allouer) :</span>
                  <strong className={remaining < 0 ? "text-red-600 dark:text-rose-400" : "text-[#1E3A5F] dark:text-sky-300"}>
                    {formatMoney(remaining, currency)}
                  </strong>
                </div>
              </div>

              {remaining === 0 && resteReel >= 0 && (
                <div className="flex items-center gap-1.5 text-emerald-700 text-xs mt-3 font-medium bg-emerald-100/60 p-2.5 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Budget Base Zéro parfait : chaque franc de votre solde a une affectation précise !</span>
                </div>
              )}

              {remaining > 0 && (
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Sur vos <strong>{formatMoney(resteReel, currency)}</strong> en caisse, <strong>{formatMoney(reservedInEnvelopes, currency)}</strong> sont réservés dans vos enveloppes et <strong>{formatMoney(remaining, currency)}</strong> sont libres à allouer.
                </p>
              )}

              {remaining < 0 && (
                <div className="flex items-start gap-1.5 text-red-600 text-xs mt-3 font-medium bg-red-100/70 p-2.5 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Vos enveloppes prévues dépassent votre solde disponible de {formatMoney(Math.abs(remaining), currency)}. Réduisez certains plafonds.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Carte Liaison directe Dettes & Créances <-> Mon Budget */}
          <Card className="border border-amber-200/80 shadow-sm bg-gradient-to-br from-amber-50/70 via-white to-rose-50/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-amber-600" />
                  Lien Dettes & Créances
                </CardTitle>
                <Link
                  href="/debts"
                  className="text-xs font-semibold text-[#1E3A5F] hover:underline flex items-center gap-1"
                >
                  <span>Gérer</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Synchronisation automatique avec votre budget du mois
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-rose-50/80 border border-rose-100 space-y-1">
                <div className="flex items-center justify-between text-rose-900">
                  <span className="flex items-center gap-1 font-medium">
                    <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />
                    Dettes restant à payer :
                  </span>
                  <strong className="font-bold">{formatMoney(totalPayableDebts, currency)}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600 text-[11px]">
                  <span>Remboursé ce mois-ci :</span>
                  <strong className="text-rose-700">{formatMoney(repaidThisMonth, currency)}</strong>
                </div>
                {debtEnvelope ? (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-rose-200/60 text-slate-700">
                    <span>Enveloppe prévue :</span>
                    <strong>{formatMoney(debtEnvelope.amount, currency)}</strong>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleBudgetizeDebtEnvelope}
                    className="w-full mt-1.5 h-7 text-[11px] border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-semibold"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Créer l&apos;enveloppe « Remboursement de dette »
                  </Button>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 space-y-1">
                <div className="flex items-center justify-between text-emerald-900 dark:text-emerald-200">
                  <span className="flex items-center gap-1 font-medium">
                    <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Créances à récupérer :
                  </span>
                  <strong className="font-bold">{formatMoney(totalReceivableDebts, currency)}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                  <span>Encaissé ce mois (+ Revenu) :</span>
                  <strong className="text-emerald-700 dark:text-emerald-300">+{formatMoney(recoveredThisMonth, currency)}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Carte Liaison directe Épargne & Objectifs <-> Mon Budget */}
          <Card className="border border-emerald-200/80 dark:border-emerald-900/40 shadow-sm bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Lien Épargne & Objectifs
                </CardTitle>
                <Link
                  href="/savings"
                  className="text-xs font-semibold text-[#1E3A5F] dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>Voir objectifs</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Synchronisé avec vos versements d&apos;épargne et vos transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 space-y-1">
                <div className="flex items-center justify-between text-emerald-900 dark:text-emerald-200">
                  <span className="font-medium">Épargné ce mois-ci :</span>
                  <strong className="font-bold">{formatMoney(epargne, currency)}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                  <span>Cumul total des objectifs ({savingsGoals.length}) :</span>
                  <strong className="text-emerald-700 dark:text-emerald-300">{formatMoney(totalSavingsAccumulated, currency)}</strong>
                </div>
                {savingsEnvelope ? (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-200/60 dark:border-emerald-800 text-slate-700 dark:text-slate-300">
                    <span>Enveloppe Épargne prévue :</span>
                    <strong>{formatMoney(savingsEnvelope.amount, currency)}</strong>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleBudgetizeSavingsEnvelope}
                    className="w-full mt-1.5 h-7 text-[11px] border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Créer l&apos;enveloppe « Épargne » (10%)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Astuce Ergonomie */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Astuces de saisie ultra rapide</span>
            </div>
            <ul className="space-y-1.5 text-slate-500 leading-relaxed list-disc list-inside">
              <li><strong>Cliquez sur un montant</strong> : la valeur entière se surligne automatiquement pour être remplacée d un seul coup.</li>
              <li><strong>Bouton éclair ⚡</strong> : affiche les boutons rapides (+5k, +10k, +50k) et le bouton « + Reste » pour allouer le reliquat d un clic.</li>
              <li><strong>Renommer</strong> : cliquez sur le nom d une enveloppe pour la modifier directement.</li>
            </ul>
          </div>
        </div>

        {/* Répartition par Catégorie (Pilier C) */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Enveloppes Budgétaires (Réalité Africaine)</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Alimentation, Loyer, Transport, Santé, Scolarité, Électricité & eau, Solidarité, Dîmes...
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating}
                  onClick={async () => {
                    if (isGenerating) return;
                    setIsGenerating(true);
                    try {
                      let addedCount = 0;
                      for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
                        const cat = DEFAULT_CATEGORIES[i];
                        const exists = categories.some(
                          (c) => c.name.trim().toLowerCase() === cat.name.toLowerCase()
                        );
                        if (!exists) {
                          await addCategory({
                            id: Date.now().toString() + i,
                            name: cat.name,
                            amount: cat.amount,
                            color: cat.color || COLORS[i % COLORS.length],
                          });
                          addedCount++;
                        }
                      }
                      if (addedCount > 0) {
                        toast.success(`${addedCount} catégorie(s) africaine(s) ajoutée(s) !`);
                      } else {
                        toast.info("Toutes les 11 catégories africaines sont déjà présentes.");
                      }
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                  className="h-8 text-xs border-blue-200 text-[#1E3A5F] hover:bg-blue-50"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
                  {isGenerating ? "Ajout..." : "11 Catégories Africaines"}
                </Button>
                <div className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700">
                  Total alloué : {formatMoney(totalAllocated, currency)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {categories.length === 0 && (
              <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center">
                <div className="p-3 bg-blue-50 text-[#1E3A5F] rounded-full mb-3">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">Aucune enveloppe définie pour ce mois</h3>
                <p className="text-slate-500 text-sm mb-6 max-w-md">
                  Gagnez du temps en dupliquant le mois précédent ou chargez les 11 catégories adaptées à la réalité africaine (Alimentation, Loyer, Transport, Santé, Scolarité, Électricité et eau, Communication et Internet, Famille et solidarité, Dîmes et offrandes, Loisirs, Autres dépenses).
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button 
                    onClick={executeDuplication}
                    disabled={isDuplicating}
                    className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Dupliquer {formattedPrevMonth}</span>
                  </Button>

                  <Button 
                    variant="outline" 
                    disabled={isGenerating}
                    onClick={async () => {
                      if (isGenerating) return;
                      setIsGenerating(true);
                      try {
                        for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
                          const cat = DEFAULT_CATEGORIES[i];
                          await addCategory({
                            id: Date.now().toString() + i,
                            name: cat.name,
                            amount: cat.amount,
                            color: cat.color || COLORS[i % COLORS.length]
                          });
                        }
                        toast.success("Les 11 catégories africaines ont été générées !");
                      } finally {
                        setIsGenerating(false);
                      }
                    }}
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  >
                    {isGenerating ? "Création en cours..." : "Charger les 11 catégories africaines"}
                  </Button>
                </div>
              </div>
            )}

            {/* Liste des enveloppes avec composants de saisie fluide */}
            <div className="space-y-3">
              {categories.map((cat) => {
                const spent = getSpentByCategory(transactions, cat.name, epargne);
                const isSav =
                  cat.name.trim().toLowerCase() === "épargne" ||
                  cat.name.trim().toLowerCase() === "epargne";
                const displayCat =
                  isSav && (Number(cat.amount) || 0) < spent
                    ? { ...cat, amount: spent }
                    : cat;
                return (
                  <CategoryRowInput 
                    key={cat.id}
                    category={displayCat}
                    currency={currency}
                    spent={spent}
                    remainingToAllocate={remaining}
                    onUpdateAmount={updateCategoryAmount}
                    onUpdateCategory={updateCategory}
                    onRemove={removeCategory}
                  />
                );
              })}
            </div>

            {/* Formulaire d ajout rapide d enveloppe */}
            <div className="pt-6 border-t mt-6">
              <h4 className="text-xs uppercase tracking-wider font-bold mb-3 text-slate-500 flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-[#1E3A5F]" />
                Ajouter une nouvelle enveloppe
              </h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input 
                  placeholder="Ex: Épargne projet, Imprévus, Cadeaux..." 
                  className="flex-1 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCategory();
                  }}
                />
                <div className="flex gap-2">
                  <BudgetAmountInput
                    value={newCatAmount}
                    onChange={(val) => setNewCatAmount(val)}
                    currency={currency}
                    placeholder="Montant alloué"
                    className="w-36 sm:w-40"
                    inputClassName="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <Button 
                    onClick={handleAddCategory} 
                    className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white shrink-0 rounded-lg h-10 px-4"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Ajouter
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </PlanGate>
  );
}
