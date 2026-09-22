"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart, TrendingUp } from "lucide-react";

import { useUIStore } from "@/lib/store/ui-store";

export default function ReportsPage() {
  const { transactions, categories } = useUIStore();

  const expenses = transactions.filter(tx => tx.type === "expense");
  const totalExpenses = expenses.reduce((sum, tx) => sum + tx.amount, 0);

  // Calculate actual spending per category
  const activeCategories = categories.map(cat => {
    const spent = expenses
      .filter(tx => tx.category.toLowerCase() === cat.name.toLowerCase())
      .reduce((sum, tx) => sum + tx.amount, 0);
    return {
      ...cat,
      spent,
      percent: totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0
    };
  }).filter(cat => cat.spent > 0)
    .sort((a, b) => b.spent - a.spent); // Trier par montant dépensé décroissant

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Rapports & Analyses</h2>
        <p className="text-slate-500 mt-2">
          Analysez vos habitudes de dépenses pour mieux épargner.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Résumé du mois */}
        <Card className="md:col-span-1 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-indigo-500" />
              Répartition des dépenses
            </CardTitle>
            <CardDescription>Où va votre argent ce mois-ci (Sept. 2026)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full flex h-6 rounded-full overflow-hidden mb-6">
              {activeCategories.map((cat, idx) => (
                <div key={idx} className={`h-full ${cat.color}`} style={{ width: `${cat.percent}%` }} title={`${cat.name}: ${cat.percent.toFixed(1)}%`} />
              ))}
              {activeCategories.length === 0 && (
                <div className="h-full w-full bg-slate-200" />
              )}
            </div>

            <div className="space-y-3">
              {activeCategories.map((cat, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                    <span className="font-medium text-slate-700">{cat.name}</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <span className="text-slate-400 text-xs w-8 text-right">{cat.percent.toFixed(0)}%</span>
                    <span className="font-bold text-slate-900 w-24 text-right">{cat.spent.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                </div>
              ))}
              {activeCategories.length === 0 && (
                <div className="text-center text-slate-500 py-4">Aucune dépense enregistrée.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Évolution */}
        <Card className="md:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
              Évolution de l'épargne (Données d'exemple)
            </CardTitle>
            <CardDescription>Aperçu de la tendance historique (Mock)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full flex items-end justify-between gap-2 pt-10">
              {/* Mock Bar Chart */}
              {[0, 0, 0, 0, 0, 0].map((val, idx) => {
                const months = ["Avr", "Mai", "Juin", "Juil", "Août", "Sept"];
                const height = (val / 250) * 100;
                return (
                  <div key={idx} className="w-full flex flex-col items-center gap-2 group">
                    <div className="w-full bg-slate-100 rounded-t-md relative flex items-end justify-center" style={{ height: '200px' }}>
                      <div className="w-full bg-emerald-400 group-hover:bg-emerald-500 transition-colors rounded-t-md" style={{ height: `${height}%` }} />
                      <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-2 rounded font-medium whitespace-nowrap">
                        {val}k FCFA
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{months[idx]}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
