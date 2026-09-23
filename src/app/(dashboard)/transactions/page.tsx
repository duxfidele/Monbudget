"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";

export default function TransactionsPage() {
  const { transactions, addTransaction, removeTransaction, categories, alertThreshold } = useUIStore();

  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (!newCategory) {
      if (categories.length > 0) {
        setNewCategory(categories[0].name);
      } else if (categories.length === 0) {
        setNewCategory("Autre (Hors Budget)");
      }
    }
  }, [categories, newCategory]);
  const [newType, setNewType] = useState<"expense" | "income">("expense");

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
      
      // Reset form
      setNewLabel("");
      setNewAmount("");
      setNewCategory("");
      setNewDate("");
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
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Dépenses</h2>
        <p className="text-slate-500 mt-2">
          Gérez toutes vos entrées et sorties d'argent.
        </p>
      </div>

      <div className="flex flex-col md:grid gap-6 md:grid-cols-3">
        {/* Formulaire d'ajout */}
        <Card className="md:col-span-1 border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle>Nouvelle transaction</CardTitle>
            <CardDescription>Ajoutez une dépense ou un revenu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* Liste des transactions */}
        <Card className="md:col-span-2 border-none shadow-sm">
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
            <div className="space-y-4">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">Aucune transaction trouvée.</div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition group border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {tx.type === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{tx.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500">{tx.date}</span>
                          <span className="text-xs text-slate-300">•</span>
                          <span className="text-xs text-slate-500">{tx.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString('fr-FR')} FCFA
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(tx.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
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
