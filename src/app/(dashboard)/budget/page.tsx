"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";

const COLORS = ["bg-blue-500", "bg-orange-500", "bg-emerald-500", "bg-pink-500", "bg-purple-500", "bg-yellow-500"];

export default function BudgetPage() {
  const { 
    income, setIncome, 
    categories, addCategory, removeCategory, updateCategoryAmount,
    transactions
  } = useUIStore();

  const [newCatName, setNewCatName] = useState("");
  const [newCatAmount, setNewCatAmount] = useState("");

  const totalAllocated = categories.reduce((sum, item) => sum + item.amount, 0);
  const remaining = income - totalAllocated;

  const handleAddCategory = () => {
    if (!newCatName || !newCatAmount) return;
    addCategory({
      id: Date.now().toString(),
      name: newCatName,
      amount: Number(newCatAmount),
      color: COLORS[categories.length % COLORS.length]
    });
    setNewCatName("");
    setNewCatAmount("");
  };

  const handleSave = () => {
    toast.success("Budget enregistré avec succès !", {
      description: "Vos modifications sont synchronisées avec le tableau de bord.",
    });
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Mon Budget</h2>
          <p className="text-slate-500 mt-2">
            Répartissez votre salaire librement pour le mois.
          </p>
        </div>
        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
          <Save className="h-4 w-4 mr-2" />
          Enregistrer
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Résumé */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border-none shadow-md bg-[#1E3A5F] text-white">
            <CardHeader>
              <CardTitle className="text-lg">Revenu du mois</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  value={income} 
                  onChange={(e) => setIncome(Number(e.target.value))}
                  className="bg-white/10 border-white/20 text-white text-lg font-bold"
                />
                <span className="font-semibold text-xl">FCFA</span>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-none shadow-md ${remaining < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <CardHeader>
              <CardTitle className="text-lg text-slate-800">Reste à allouer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {remaining.toLocaleString('fr-FR')} FCFA
              </div>
              {remaining < 0 && (
                <div className="flex items-center text-red-600 text-sm mt-3 font-medium">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Vous avez dépassé votre revenu !
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Répartition */}
        <Card className="md:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Répartition par catégorie</CardTitle>
            <CardDescription>Ajustez les montants alloués pour chaque poste de dépense.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {categories.map(cat => {
                const spent = transactions
                  .filter(tx => tx.type === "expense" && tx.category.toLowerCase() === cat.name.toLowerCase())
                  .reduce((sum, tx) => sum + tx.amount, 0);
                const remainingInCat = cat.amount - spent;
                const percent = cat.amount > 0 ? (spent / cat.amount) * 100 : 0;

                return (
                  <div key={cat.id} className="flex flex-col gap-2 p-3 rounded-lg border border-slate-100 bg-slate-50/50 group hover:bg-white hover:shadow-sm transition">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-700">{cat.name}</div>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          value={cat.amount} 
                          onChange={(e) => updateCategoryAmount(cat.id, Number(e.target.value))}
                          className="font-semibold text-right h-8 w-32"
                        />
                        <span className="text-slate-500 font-medium w-12 text-sm">FCFA</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeCategory(cat.id)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 ml-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                      <span>Dépensé: <span className="font-semibold text-slate-700">{spent.toLocaleString('fr-FR')} FCFA</span></span>
                      <span className={remainingInCat < 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                        Reste: {remainingInCat.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                      <div 
                        className={`h-full ${percent > 100 ? 'bg-red-500' : cat.color} rounded-full`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-6 border-t mt-6">
              <h4 className="text-sm font-semibold mb-4 text-slate-700">Ajouter une nouvelle catégorie</h4>
              <div className="flex gap-4">
                <Input 
                  placeholder="Ex: Loisirs" 
                  className="flex-1"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
                <Input 
                  type="number" 
                  placeholder="Montant" 
                  className="w-32"
                  value={newCatAmount}
                  onChange={(e) => setNewCatAmount(e.target.value)}
                />
                <Button onClick={handleAddCategory} variant="secondary">
                  <Plus className="h-4 w-4 mr-1" /> Ajouter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
