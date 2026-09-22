"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PiggyBank, Plus, Target, CheckCircle2, TrendingUp, AlertCircle, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";

export default function SavingsPage() {
  const { savingsGoals, addSavingsGoal, removeSavingsGoal, addSavingsAmount } = useUIStore();
  
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [addingAmountId, setAddingAmountId] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("");

  const handleAddGoal = () => {
    if(!newGoalName || !newGoalTarget) return;
    const target = Number(newGoalTarget);
    if(isNaN(target) || target <= 0) return;
    
    addSavingsGoal({
      id: Date.now().toString(),
      name: newGoalName,
      target,
      current: 0,
      color: "bg-blue-500"
    });
    setNewGoalName("");
    setNewGoalTarget("");
    toast.success("Objectif d'épargne créé !");
  };

  const handleAddAmount = (id: string) => {
    const amount = Number(addAmount);
    if (amount > 0) {
      addSavingsAmount(id, amount);
      setAddingAmountId(null);
      setAddAmount("");
      toast.success("Épargne ajoutée avec succès !");
    }
  };

  const totalSaved = savingsGoals.reduce((sum, g) => sum + g.current, 0);
  const totalTarget = savingsGoals.reduce((sum, g) => sum + g.target, 0);

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Épargne & Projets</h2>
          <p className="text-slate-500 mt-2">
            Suivez la progression de vos objectifs financiers.
          </p>
        </div>
      </div>

      <Card className="border-none shadow-sm mb-6 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-lg">Créer un nouvel objectif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium text-slate-700">Nom de l'objectif</label>
              <Input placeholder="Ex: Achat maison..." value={newGoalName} onChange={(e) => setNewGoalName(e.target.value)} />
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium text-slate-700">Montant cible (FCFA)</label>
              <Input type="number" placeholder="Ex: 5000000" value={newGoalTarget} onChange={(e) => setNewGoalTarget(e.target.value)} />
            </div>
            <Button onClick={handleAddGoal} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {savingsGoals.map((goal) => {
          const percent = Math.min((goal.current / goal.target) * 100, 100);
          const isCompleted = goal.current >= goal.target;
          
          return (
            <Card key={goal.id} className="border-none shadow-sm flex flex-col group">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className={`p-3 rounded-xl ${goal.color} bg-opacity-10 text-slate-700`}>
                    <Target className="h-6 w-6" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeSavingsGoal(goal.id)} className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4">
                  <CardTitle className="text-xl">{goal.name}</CardTitle>
                  <CardDescription>Objectif: {goal.target.toLocaleString('fr-FR')} FCFA</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-2xl font-bold text-slate-800">{goal.current.toLocaleString('fr-FR')} <span className="text-sm text-slate-500 font-normal">FCFA</span></span>
                    <span className="text-sm font-medium text-slate-500">{percent.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${goal.color} rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t">
                  {isCompleted ? (
                    <div className="flex items-center justify-center text-emerald-600 font-medium py-2">
                      <CheckCircle2 className="mr-2 h-5 w-5" /> Objectif atteint !
                    </div>
                  ) : (
                    addingAmountId === goal.id ? (
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          placeholder="Montant (FCFA)" 
                          value={addAmount}
                          onChange={(e) => setAddAmount(e.target.value)}
                          className="h-9"
                        />
                        <Button size="sm" onClick={() => handleAddAmount(goal.id)} className="bg-blue-600">Valider</Button>
                        <Button size="sm" variant="ghost" onClick={() => setAddingAmountId(null)}>Annuler</Button>
                      </div>
                    ) : (
                      <Button onClick={() => setAddingAmountId(goal.id)} variant="outline" className="w-full font-medium text-slate-600">
                        <PlusCircle className="mr-2 h-4 w-4" /> Ajouter des fonds
                      </Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {savingsGoals.length === 0 && (
          <div className="col-span-3 text-center py-10 text-slate-500">
            Aucun objectif d'épargne. Créez-en un pour commencer !
          </div>
        )}
      </div>
    </div>
  );
}
