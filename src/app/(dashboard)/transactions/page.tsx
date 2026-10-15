"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function TransactionsPage() {
  const { transactions, addTransaction, removeTransaction, categories, alertThreshold } = useUIStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newType, setNewType] = useState<"expense" | "income">("expense");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!newCategory) {
      if (categories.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNewCategory(categories[0].name);
      } else if (categories.length === 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNewCategory("Autre (Hors Budget)");
      }
    }
  }, [categories, newCategory]);

  const handleAddTransaction = async () => {
    if (!newLabel || !newAmount || !newCategory || !newDate) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }

    const amount = Number(newAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (newType === 'expense' && newCategory !== "Autre (Hors Budget)") {
      const categoryObj = categories.find(c => c.name.toLowerCase() === newCategory.toLowerCase());
      if (categoryObj) {
        const spentSoFar = transactions
          .filter(tx => tx.type === "expense" && tx.category.toLowerCase() === newCategory.toLowerCase())
          .reduce((sum, tx) => sum + tx.amount, 0);
        
        const thresholdValue = categoryObj.amount * ((alertThreshold || 80) / 100);
        if (spentSoFar + amount >= thresholdValue) {
          toast.warning(`Attention ! Vous avez atteint ${alertThreshold || 80}% du budget "${newCategory}" !`, {
            description: `Le budget alloué était de ${categoryObj.amount.toLocaleString('fr-FR')} FCFA.`,
            duration: 6000,
          });
        }
      }
    }

    try {
      await addTransaction({
        id: Date.now().toString(),
        label: newLabel,
        amount: amount,
        category: newCategory,
        date: newDate,
        type: newType,
      });
      
      toast.success("Transaction ajoutée avec succès !");
      setIsDialogOpen(false);
      
      // Reset form
      setNewLabel("");
      setNewAmount("");
      setNewDate(new Date().toISOString().split("T")[0]);
      
      if (categories.length > 0) setNewCategory(categories[0].name);
      else setNewCategory("Autre (Hors Budget)");
      
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error("Erreur: " + (error.message || "Impossible d'ajouter la transaction"));
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      toast.info("Aucune transaction à exporter.");
      return;
    }
    const headers = ["Date", "Type", "Catégorie", "Libellé", "Montant (FCFA)"];
    const rows = transactions.map(tx => [
      tx.date,
      tx.type === "income" ? "Revenu" : "Dépense",
      tx.category,
      tx.label,
      tx.amount.toString()
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(item => `"${item}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "transactions_monbudget.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exportation réussie !");
  };

  const handleDelete = (id: string) => {
    removeTransaction(id);
    toast.info("Transaction supprimée.");
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Dépenses</h2>
          <p className="text-slate-500 mt-2">
            Gérez toutes vos entrées et sorties d&apos;argent.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger
            render={
              <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 w-full md:w-auto" />
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle transaction
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Nouvelle transaction</DialogTitle>
              <DialogDescription>
                Ajoutez une dépense ou un revenu à votre budget.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                <button 
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${newType === 'expense' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setNewType('expense')}
                >
                  Dépense
                </button>
                <button 
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${newType === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setNewType('income')}
                >
                  Revenu
                </button>
              </div>

              {categories.length === 0 && newType === 'expense' && (
                <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-md border border-amber-200 flex flex-col gap-2">
                  <span>💡 Astuce : Vous n&apos;avez pas encore créé de budget. Les dépenses seront classées dans &quot;Autre&quot;.</span>
                  <Button 
                    type="button"
                    size="sm" 
                    variant="outline" 
                    disabled={isGenerating}
                    onClick={async () => {
                      if (isGenerating) return;
                      setIsGenerating(true);
                      try {
                        const defaults = [
                          { name: "Alimentation", amount: 50000 },
                          { name: "Logement", amount: 100000 },
                          { name: "Transport", amount: 20000 },
                          { name: "Factures & Abonnements", amount: 30000 },
                          { name: "Santé", amount: 15000 },
                          { name: "Loisirs & Sorties", amount: 15000 },
                          { name: "Shopping", amount: 20000 },
                        ];
                        const COLORS = ["bg-blue-500", "bg-orange-500", "bg-emerald-500", "bg-pink-500", "bg-purple-500", "bg-yellow-500"];
                        for (let i = 0; i < defaults.length; i++) {
                          await useUIStore.getState().addCategory({
                            id: Date.now().toString() + i,
                            name: defaults[i].name,
                            amount: defaults[i].amount,
                            color: COLORS[i % COLORS.length]
                          });
                        }
                        toast.success("Catégories générées !");
                      } finally {
                        setIsGenerating(false);
                      }
                    }}
                    className="w-full bg-white text-amber-900 border-amber-200 hover:bg-amber-100"
                  >
                    {isGenerating ? "Création en cours..." : "Générer les catégories de base"}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Date</label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Libellé</label>
                <Input placeholder="Ex: Courses" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Montant (FCFA)</label>
                <Input type="number" placeholder="0" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Catégorie</label>
                {newType === 'expense' ? (
                  <select 
                    value={newCategory} 
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    <option value="" disabled>Sélectionnez une catégorie</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="Autre (Hors Budget)">Autre (Hors Budget)</option>
                  </select>
                ) : (
                  <Input placeholder="Ex: Salaire, Remboursement..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                )}
              </div>

              <Button onClick={handleAddTransaction} className={`w-full mt-2 ${newType === 'expense' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="w-full">
        {/* Liste des transactions */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Historique</CardTitle>
              <CardDescription>Vos dépenses et revenus pour le mois sélectionné.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Exporter</span>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-2">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-lg font-medium text-slate-700 mb-1">Aucune transaction</p>
                  <p>Commencez à suivre vos finances en ajoutant votre première transaction.</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition group border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {tx.type === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-base">{tx.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{tx.date}</span>
                          <span className="text-xs text-slate-500">{tx.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`font-bold text-base ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString('fr-FR')} FCFA
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(tx.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 md:opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
