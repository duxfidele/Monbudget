"use client";

import { useState } from "react";
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
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";
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
    const amount = Number(newCatAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Veuillez entrer un montant valide.");
      return;
    }

    await addCategory({
      id: Date.now().toString(),
      name: newCatName.trim(),
      amount: amount,
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
    // Si l'utilisateur a déjà des catégories allouées avec un montant > 0, on demande confirmation
    const hasExistingAllocations = categories.some(c => c.amount > 0);
    if (hasExistingAllocations) {
      setIsConfirmDialogOpen(true);
    } else {
      executeDuplication();
    }
  };

  const handleSave = () => {
    toast.success("Budget validé et synchronisé !", {
      description: `Vos enveloppes pour ${capitalizedActiveMonth} sont à jour.`,
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
            Allouez votre salaire en enveloppes pour ne jamais être à sec.
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
          {/* Revenu Card */}
          <Card className="border-none shadow-md bg-gradient-to-br from-[#1E3A5F] to-[#2B4E7E] text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-200">Revenu mensuel à répartir</CardTitle>
              <CardDescription className="text-xs text-slate-300">Salaire net + primes prévues pour ce mois</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2.5">
                <Input 
                  type="number" 
                  value={income || ""} 
                  onChange={(e) => setIncome(Number(e.target.value))}
                  placeholder="0"
                  className="bg-white/10 border-white/20 text-white text-xl font-bold placeholder:text-white/40 focus-visible:ring-white/40"
                />
                <span className="font-semibold text-lg text-slate-200">{currency}</span>
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
              <span>Astuce de gestion de paie</span>
            </div>
            <p className="leading-relaxed">
              Pour démarrer rapidement un nouveau mois, cliquez sur <strong>« Dupliquer {formattedPrevMonth} »</strong> pour reconduire vos montants sans tout ressaisir. Vous restez libre de modifier chaque montant à tout moment.
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

            {/* Liste des enveloppes */}
            <div className="space-y-3.5">
              {categories.map(cat => {
                const spent = getSpentByCategory(transactions, cat.name);
                const progress = getCategoryProgress(spent, cat.amount);

                return (
                  <div key={cat.id} className="flex flex-col gap-2 p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:shadow-xs hover:border-slate-200 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${cat.color || 'bg-blue-500'}`} />
                        <span>{cat.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          value={cat.amount || ""} 
                          onChange={(e) => updateCategoryAmount(cat.id, Number(e.target.value))}
                          placeholder="0"
                          className="font-bold text-right h-8 w-28 md:w-32 bg-white"
                        />
                        <span className="text-slate-500 font-medium text-xs">{currency}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeCategory(cat.id)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 ml-1"
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
                          : `Reste : ${formatMoney(progress.remaining, currency)}`
                        }
                      </span>
                    </div>
                    
                    <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-0.5">
                      <div 
                        className={`h-full ${progress.isOverBudget ? '!bg-red-500' : cat.color || 'bg-blue-500'} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(progress.percent, 100)}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formulaire d'ajout rapide */}
            <div className="pt-6 border-t mt-6">
              <h4 className="text-xs uppercase tracking-wider font-bold mb-3 text-slate-500">Ajouter une nouvelle enveloppe</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input 
                  placeholder="Ex: Épargne projet, Imprévus..." 
                  className="flex-1"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCategory();
                  }}
                />
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    placeholder="Montant alloué" 
                    className="w-32"
                    value={newCatAmount}
                    onChange={(e) => setNewCatAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCategory();
                    }}
                  />
                  <Button onClick={handleAddCategory} className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white shrink-0">
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
