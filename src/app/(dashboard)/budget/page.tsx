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
  Wallet
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore, Category } from "@/lib/store/ui-store";
import { formatMoney, getSpentByCategory, getCategoryProgress } from "@/lib/utils/budget-calc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COLORS = ["bg-blue-500", "bg-orange-500", "bg-emerald-500", "bg-pink-500", "bg-purple-500", "bg-yellow-500"];

const DEFAULT_CATEGORIES = [
  { name: "Alimentation", amount: 50000 },
  { name: "Logement", amount: 100000 },
  { name: "Transport", amount: 20000 },
  { name: "Factures & Abonnements", amount: 30000 },
  { name: "Santé", amount: 15000 },
  { name: "Loisirs & Sorties", amount: 15000 },
  { name: "Shopping", amount: 20000 },
];

/**
 * Composant de saisie fluide pour le revenu mensuel
 * Utilise un état local pour une réactivité instantanée à la frappe sans lag réseau
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
  const [text, setText] = useState(initialIncome > 0 ? initialIncome.toString() : "");

  useEffect(() => {
    setText(initialIncome > 0 ? initialIncome.toString() : "");
  }, [initialIncome]);

  const commit = (valStr: string) => {
    const cleanNum = Number(valStr.replace(/[^0-9]/g, ""));
    const finalVal = isNaN(cleanNum) || cleanNum < 0 ? 0 : cleanNum;
    setText(finalVal > 0 ? finalVal.toString() : "");
    onCommit(finalVal);
  };

  return (
    <div className="relative flex items-center w-full">
      <Input 
        type="text"
        inputMode="numeric"
        value={text} 
        onChange={(e) => {
          const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
          setText(digitsOnly);
          // Mise à jour optimiste en direct
          const n = Number(digitsOnly);
          if (!isNaN(n)) onCommit(n);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Ex: 350000"
        className="bg-white/10 border-white/20 text-white text-xl md:text-2xl font-black placeholder:text-white/40 focus-visible:ring-white/40 h-12 pr-12 rounded-xl"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("");
            onCommit(0);
          }}
          className="absolute right-3 p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
          title="Effacer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Composant de saisie fluide pour chaque enveloppe budgétaire
 * Saisie libre sans remise à zéro intempestive au backspace
 */
function CategoryRowInput({
  category,
  currency,
  onUpdateAmount,
  onRemove,
  spent,
}: {
  category: Category;
  currency: string;
  onUpdateAmount: (id: string, amount: number) => void;
  onRemove: (id: string) => void;
  spent: number;
}) {
  const [localText, setLocalText] = useState(category.amount > 0 ? category.amount.toString() : "");
  const progress = getCategoryProgress(spent, category.amount);

  useEffect(() => {
    setLocalText(category.amount > 0 ? category.amount.toString() : "");
  }, [category.amount]);

  const commitValue = (valStr: string) => {
    const num = Number(valStr.replace(/[^0-9]/g, ""));
    const finalAmount = isNaN(num) || num < 0 ? 0 : num;
    setLocalText(finalAmount > 0 ? finalAmount.toString() : "");
    onUpdateAmount(category.id, finalAmount);
  };

  return (
    <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:shadow-xs hover:border-slate-200 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-slate-800 text-sm md:text-base flex items-center gap-2.5 truncate">
          <span className={`w-3 h-3 rounded-full shrink-0 ${category.color || 'bg-blue-500'}`} />
          <span className="truncate">{category.name}</span>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center">
            <Input 
              type="text"
              inputMode="numeric"
              value={localText} 
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                setLocalText(digits);
                // Mise à jour réactive du calcul
                const n = Number(digits);
                if (!isNaN(n)) onUpdateAmount(category.id, n);
              }}
              onBlur={(e) => commitValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitValue((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="0"
              className="font-bold text-right h-9 w-32 sm:w-36 md:w-40 bg-white pr-2 text-sm md:text-base border-slate-200 focus-visible:ring-[#1E3A5F] rounded-lg"
            />
          </div>
          <span className="text-slate-500 font-semibold text-xs md:text-sm w-12">{currency}</span>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onRemove(category.id)}
            className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 ml-0.5 rounded-lg"
            title="Supprimer cette catégorie"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-slate-500 mt-0.5">
        <span>Dépensé : <strong className="text-slate-700">{formatMoney(spent, currency)}</strong></span>
        <span className={progress.isOverBudget ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
          {progress.isOverBudget 
            ? `Dépassement : ${formatMoney(Math.abs(progress.remaining), currency)}`
            : `Disponible : ${formatMoney(progress.remaining, currency)}`
          }
        </span>
      </div>
      
      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-0.5">
        <div 
          className={`h-full ${progress.isOverBudget ? '!bg-red-500' : category.color || 'bg-blue-500'} rounded-full transition-all duration-300`}
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
    updateCategoryAmount,
    transactions,
    currency,
    activeMonth,
    duplicatePreviousMonth
  } = useUIStore();

  const [newCatName, setNewCatName] = useState("");
  const [newCatAmount, setNewCatAmount] = useState("");
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
    if (!newCatName || !newCatAmount) {
      toast.error("Veuillez renseigner le nom et le montant de la catégorie.");
      return;
    }
    const cleanAmount = Number(newCatAmount.replace(/[^0-9]/g, ""));
    if (isNaN(cleanAmount) || cleanAmount < 0) {
      toast.error("Veuillez entrer un montant valide.");
      return;
    }

    await addCategory({
      id: Date.now().toString(),
      name: newCatName.trim(),
      amount: cleanAmount,
      color: COLORS[categories.length % COLORS.length]
    });
    setNewCatName("");
    setNewCatAmount("");
    toast.success(`Catégorie "${newCatName.trim()}" ajoutée !`);
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
    toast.success("Budget validé !", {
      description: `Vos enveloppes pour ${capitalizedActiveMonth} sont synchronisées.`,
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
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <IncomeInput 
                    initialIncome={income} 
                    currency={currency} 
                    onCommit={(val) => setIncome(val)} 
                  />
                </div>
                <p className="text-[11px] text-slate-300/80">
                  Tapez votre montant librement, la mise à jour est instantanée.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Reste à allouer Card */}
          <Card className={`border-none shadow-sm ${remaining < 0 ? 'bg-red-50 border border-red-200' : remaining === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-white'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Reste à allouer</CardTitle>
            </CardHeader>
            <CardContent>
              <div suppressHydrationWarning className={`text-3xl font-extrabold ${remaining < 0 ? 'text-red-600' : remaining === 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                {formatMoney(remaining, currency)}
              </div>

              {remaining === 0 && (
                <div className="flex items-center gap-1.5 text-emerald-700 text-xs mt-3 font-medium bg-emerald-100/60 p-2 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Budget Base Zéro parfait : chaque franc est alloué !</span>
                </div>
              )}

              {remaining > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  Il vous reste ce montant à ventiler dans vos enveloppes ou à verser en épargne.
                </p>
              )}

              {remaining < 0 && (
                <div className="flex items-start gap-1.5 text-red-600 text-xs mt-3 font-medium bg-red-100/70 p-2.5 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Déficit ! Vos enveloppes dépassent votre revenu de {formatMoney(Math.abs(remaining), currency)}.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Duplication banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Saisie facile & sans blocage</span>
            </div>
            <p className="leading-relaxed">
              Vous pouvez taper directement vos chiffres au clavier ou sur mobile. Utilisez la touche <strong>Entrée</strong> ou cliquez en dehors du champ pour valider.
            </p>
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
                    onUpdateAmount={updateCategoryAmount}
                    onRemove={removeCategory}
                  />
                );
              })}
            </div>

            {/* Formulaire d'ajout rapide d'enveloppe */}
            <div className="pt-6 border-t mt-6">
              <h4 className="text-xs uppercase tracking-wider font-bold mb-3 text-slate-500">Ajouter une nouvelle enveloppe</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input 
                  placeholder="Ex: Épargne projet, Imprévus, Cadeaux..." 
                  className="flex-1 rounded-lg"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCategory();
                  }}
                />
                <div className="flex gap-2">
                  <Input 
                    type="text"
                    inputMode="numeric"
                    placeholder="Montant alloué" 
                    className="w-36 rounded-lg font-bold text-right"
                    value={newCatAmount}
                    onChange={(e) => setNewCatAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCategory();
                    }}
                  />
                  <Button onClick={handleAddCategory} className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white shrink-0 rounded-lg">
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
