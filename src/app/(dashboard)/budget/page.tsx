"use client";

import { useState, useEffect, useRef } from "react";
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
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore, Category } from "@/lib/store/ui-store";
import { 
  formatMoney, 
  getSpentByCategory, 
  getCategoryProgress,
  formatThousands,
  parseThousands
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

const DEFAULT_CATEGORIES = [
  { name: "Alimentation", amount: 50000 },
  { name: "Logement & Loyer", amount: 100000 },
  { name: "Transport & Carburant", amount: 25000 },
  { name: "Factures (Eau, Électricité, Canal+)", amount: 30000 },
  { name: "Santé & Pharmacie", amount: 15000 },
  { name: "Loisirs & Sorties", amount: 20000 },
  { name: "Épargne & Imprévus", amount: 30000 },
];

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
    const raw = e.target.value;
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
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Backspace") {
      const input = e.currentTarget;
      const { selectionStart, selectionEnd } = input;
      if (
        selectionStart !== null &&
        selectionStart === selectionEnd &&
        selectionStart > 1 &&
        input.value[selectionStart - 1] === " "
      ) {
        e.preventDefault();
        const before = input.value.slice(0, selectionStart - 2);
        const after = input.value.slice(selectionStart);
        const digits = (before + after).replace(/[^0-9]/g, "");
        const formatted = formatThousands(digits);
        setDisplayValue(formatted);
        const parsed = digits ? parseInt(digits, 10) : 0;
        onChange(parsed);
        setTimeout(() => {
          const newPos = Math.max(0, selectionStart - 2);
          input.setSelectionRange(newPos, newPos);
        }, 0);
      }
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
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
    const raw = e.target.value;
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
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Backspace") {
      const input = e.currentTarget;
      const { selectionStart, selectionEnd } = input;
      if (
        selectionStart !== null &&
        selectionStart === selectionEnd &&
        selectionStart > 1 &&
        input.value[selectionStart - 1] === " "
      ) {
        e.preventDefault();
        const before = input.value.slice(0, selectionStart - 2);
        const after = input.value.slice(selectionStart);
        const digits = (before + after).replace(/[^0-9]/g, "");
        const formatted = formatThousands(digits);
        setDisplayValue(formatted);
        const parsed = digits ? parseInt(digits, 10) : 0;
        onCommit(parsed);
        setTimeout(() => {
          const newPos = Math.max(0, selectionStart - 2);
          input.setSelectionRange(newPos, newPos);
        }, 0);
      }
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <Input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
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
    <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:shadow-xs hover:border-slate-200 transition-all">
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
                className="h-8 text-sm font-semibold rounded-md bg-white border-slate-300"
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
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <BudgetAmountInput
            value={category.amount}
            onChange={(val) => onUpdateAmount(category.id, val)}
            currency={currency}
            className="w-36 sm:w-40 md:w-44"
            inputClassName="bg-white border-slate-200 h-9 text-sm md:text-base"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowQuickPills(!showQuickPills)}
            className={`h-8 w-8 rounded-lg text-slate-400 hover:text-[#1E3A5F] hover:bg-blue-50 ${showQuickPills ? "bg-blue-50 text-[#1E3A5F]" : ""}`}
            title="Ajustements rapides (+ / -)"
          >
            <Zap className="h-4 w-4" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onRemove(category.id)}
            className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg"
            title="Supprimer cette catégorie"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Barre d ajustements rapides (Chips interactifs) */}
      {showQuickPills && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 pb-0.5 border-t border-slate-200/60 text-xs">
          <span className="text-[11px] font-medium text-slate-400 mr-1">Ajuster :</span>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(5000)}
            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-[#1E3A5F] hover:bg-blue-50/50 text-slate-700 font-medium transition"
          >
            +5 000
          </button>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(10000)}
            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-[#1E3A5F] hover:bg-blue-50/50 text-slate-700 font-medium transition"
          >
            +10 000
          </button>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(25000)}
            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-[#1E3A5F] hover:bg-blue-50/50 text-slate-700 font-medium transition"
          >
            +25 000
          </button>
          <button
            type="button"
            onClick={() => handleAddQuickAmount(50000)}
            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-[#1E3A5F] hover:bg-blue-50/50 text-slate-700 font-medium transition"
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
            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 font-medium transition ml-auto flex items-center gap-1"
            title="Remettre à 0"
          >
            <RotateCcw className="h-3 w-3" />
            <span>0</span>
          </button>
        </div>
      )}
      
      {/* Jauge et indicateur de dépenses */}
      <div className="flex items-center justify-between text-xs text-slate-500 mt-0.5">
        <span>Dépensé : <strong className="text-slate-700">{formatMoney(spent, currency)}</strong></span>
        <span className={progress.isOverBudget ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
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
    setIncome, 
    categories, 
    addCategory, 
    removeCategory, 
    updateCategory,
    updateCategoryAmount,
    transactions,
    currency,
    activeMonth,
    duplicatePreviousMonth
  } = useUIStore();

  const [newCatName, setNewCatName] = useState("");
  const [newCatAmount, setNewCatAmount] = useState<number>(0);
  const [newCatColor, setNewCatColor] = useState(COLORS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

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

  const totalAllocated = categories.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const remaining = income - totalAllocated;

  const handleAddCategory = async () => {
    const trimmedName = newCatName.trim();
    if (!trimmedName) {
      toast.error("Veuillez renseigner un nom pour la catégorie.");
      return;
    }

    await addCategory({
      id: Date.now().toString(),
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

  const handleSave = () => {
    toast.success("Budget mensuel validé !", {
      description: `Vos enveloppes pour ${capitalizedActiveMonth} sont enregistrées.`,
    });
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Dialogue de confirmation de duplication */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Copy className="h-5 w-5 text-[#1E3A5F]" />
              Dupliquer le budget de {formattedPrevMonth} ?
            </DialogTitle>
            <DialogDescription className="text-slate-600 pt-2 text-sm leading-relaxed">
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

        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            variant="outline" 
            onClick={handleDuplicateClick} 
            disabled={isDuplicating}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs gap-1.5"
            title="Copier les enveloppes et le salaire du mois précédent"
          >
            {isDuplicating ? (
              <RefreshCw className="h-4 w-4 animate-spin text-slate-600" />
            ) : (
              <Copy className="h-4 w-4 text-[#1E3A5F]" />
            )}
            <span>Dupliquer {formattedPrevMonth}</span>
          </Button>

          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5">
            <Save className="h-4 w-4" />
            <span>Enregistrer</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Résumé & Pilotage */}
        <div className="lg:col-span-1 space-y-5">
          {/* Revenu Card avec saisie fluide */}
          <Card className="border-none shadow-md bg-gradient-to-br from-[#1E3A5F] to-[#2B4E7E] text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-300" />
                Revenu mensuel à répartir
              </CardTitle>
              <CardDescription className="text-xs text-slate-300">Salaire net + primes prévues pour ce mois</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2.5">
                <IncomeInput 
                  initialIncome={income} 
                  currency={currency} 
                  onCommit={(val) => setIncome(val)} 
                />
                
                {income > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-slate-300/90 pt-1">
                    <span>Moyenne journalière :</span>
                    <strong className="text-white">
                      ~{formatMoney(Math.round(income / 30), currency)} / jour
                    </strong>
                  </div>
                )}
                <p className="text-[11px] text-slate-300/70">
                  Les chiffres se formatent automatiquement avec des espaces (ex: 350 000).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Reste à allouer Card */}
          <Card className={`border-none shadow-sm transition-colors ${remaining < 0 ? "bg-red-50 border border-red-200" : remaining === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-white"}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Reste à allouer</CardTitle>
            </CardHeader>
            <CardContent>
              <div suppressHydrationWarning className={`text-3xl font-extrabold ${remaining < 0 ? "text-red-600" : remaining === 0 ? "text-emerald-600" : "text-slate-800"}`}>
                {formatMoney(remaining, currency)}
              </div>

              {remaining === 0 && (
                <div className="flex items-center gap-1.5 text-emerald-700 text-xs mt-3 font-medium bg-emerald-100/60 p-2.5 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Budget Base Zéro parfait : chaque franc a une affectation précise !</span>
                </div>
              )}

              {remaining > 0 && (
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Il vous reste ce montant à ventiler dans vos enveloppes ou à verser en épargne.
                </p>
              )}

              {remaining < 0 && (
                <div className="flex items-start gap-1.5 text-red-600 text-xs mt-3 font-medium bg-red-100/70 p-2.5 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Déficit ! Vos enveloppes dépassent votre revenu de {formatMoney(Math.abs(remaining), currency)}. Réduisez certains plafonds.</span>
                </div>
              )}
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

        {/* Répartition par Catégorie */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Enveloppes Budgétaires</CardTitle>
                <CardDescription>Plafonds de dépenses prévus par catégorie pour {capitalizedActiveMonth}.</CardDescription>
              </div>
              <div className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                Total alloué : {formatMoney(totalAllocated, currency)}
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
                  Gagnez du temps en dupliquant le mois précédent ou chargez notre modèle standard de catégories pour salariés.
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
                            color: COLORS[i % COLORS.length]
                          });
                        }
                        toast.success("Catégories par défaut générées !");
                      } finally {
                        setIsGenerating(false);
                      }
                    }}
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  >
                    {isGenerating ? "Création en cours..." : "Générer les catégories standards"}
                  </Button>
                </div>
              </div>
            )}

            {/* Liste des enveloppes avec composants de saisie fluide */}
            <div className="space-y-3">
              {categories.map((cat) => {
                const spent = getSpentByCategory(transactions, cat.name);
                return (
                  <CategoryRowInput 
                    key={cat.id}
                    category={cat}
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
                  className="flex-1 rounded-lg bg-white border-slate-200 text-sm"
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
                    inputClassName="bg-white border-slate-200 h-10 text-sm"
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
  );
}
