"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingDown, PiggyBank, Receipt, ArrowRight, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/store/ui-store";

export default function DashboardPage() {
  const { income, categories, transactions, savingsGoals } = useUIStore();

  // Calculs dynamiques
  const depenses = transactions
    .filter(tx => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Calcul dynamique de l'épargne
  const epargne = savingsGoals.reduce((sum, goal) => sum + goal.current, 0);

  const reste = income - depenses - epargne;
  const pourcentageDepense = income > 0 ? (depenses / income) * 100 : 0;

  // Calcul des dépenses par catégorie
  const categoryStats = categories.map(cat => {
    const spent = transactions
      .filter(tx => tx.type === "expense" && tx.category.toLowerCase() === cat.name.toLowerCase())
      .reduce((sum, tx) => sum + tx.amount, 0);
    return {
      ...cat,
      spent,
      percent: cat.amount > 0 ? Math.min((spent / cat.amount) * 100, 100) : 0
    };
  });

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Tableau de bord</h2>
          <p className="text-slate-500 mt-2">
            Aperçu de vos finances pour le mois en cours.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Revenus Mensuels</CardTitle>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className="text-2xl font-bold text-slate-800">{income.toLocaleString('fr-FR')} FCFA</div>
            <p className="text-xs text-emerald-600 flex items-center mt-1 font-medium">
              <ArrowUpRight className="h-3 w-3 mr-1" /> +2.5% par rapport au mois dernier
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Dépenses Réelles</CardTitle>
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className="text-2xl font-bold text-slate-800">{depenses.toLocaleString('fr-FR')} FCFA</div>
            <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
              <div 
                className="bg-red-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(pourcentageDepense, 100)}%` }} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Reste à vivre</CardTitle>
            <div className="p-2 bg-sky-100 rounded-lg">
              <Receipt className="h-4 w-4 text-sky-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className="text-2xl font-bold text-slate-800">{reste.toLocaleString('fr-FR')} FCFA</div>
            <p className="text-xs text-slate-400 mt-1">Disponible jusqu'à la fin du mois</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-[#1E3A5F] text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Épargne</CardTitle>
            <div className="p-2 bg-white/20 rounded-lg">
              <PiggyBank className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div suppressHydrationWarning className="text-2xl font-bold">{epargne.toLocaleString('fr-FR')} FCFA</div>
            <p className="text-xs text-slate-300 mt-1">Sur {savingsGoals.length} objectifs actifs</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7 mt-4">
        {/* Recent Transactions */}
        <Card className="md:col-span-4 border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transactions Récentes</CardTitle>
                <CardDescription>Vos dernières opérations du mois</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-blue-600 font-medium hidden sm:flex">
                Voir tout <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {tx.type === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{tx.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">{tx.date}</span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs text-slate-500">{tx.category}</span>
                      </div>
                    </div>
                  </div>
                  <div suppressHydrationWarning className={`font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString('fr-FR')} FCFA
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center py-4 text-slate-500">Aucune transaction pour le moment.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Budgets Progress */}
        <Card className="md:col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Budgets par Catégorie</CardTitle>
            <CardDescription>Où va votre argent par rapport à vos prévisions ?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {categoryStats.map((cat, idx) => {
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{cat.name}</span>
                    <span suppressHydrationWarning className="font-medium text-slate-900">{cat.spent.toLocaleString('fr-FR')} FCFA <span className="text-slate-400 font-normal">/ {cat.amount.toLocaleString('fr-FR')} FCFA</span></span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${cat.color} rounded-full transition-all duration-500 ease-in-out ${cat.percent > 100 ? 'bg-red-500' : ''}`}
                      style={{ width: `${Math.min(cat.percent, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {categoryStats.length === 0 && (
              <div className="text-center py-4 text-slate-500">Aucune catégorie budgétaire définie.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
