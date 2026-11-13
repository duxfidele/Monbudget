"use client";

import { useState } from "react";
import { Smartphone, Monitor, CheckCircle2, TrendingUp, Sparkles, CreditCard, ShoppingCart, Utensils, Zap, Car } from "lucide-react";

export function LandingPreviewSection() {
  const [activeTab, setActiveTab] = useState<"desktop" | "mobile">("mobile");

  return (
    <section id="apercu" className="py-20 md:py-28 bg-[#071324] text-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            Expérience Immersion
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Une interface épurée, fluide sur mobile comme sur ordinateur
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Consultez votre budget dans le creux de votre main ou sur grand écran. Chaque écran a été pensé pour vous faire gagner du temps et vous apporter une clarté absolue.
          </p>

          {/* Switcher Tab */}
          <div className="flex items-center justify-center pt-4">
            <div className="p-1 rounded-2xl bg-[#0E203B] border border-slate-800 inline-flex max-w-full flex-wrap justify-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("mobile")}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${activeTab === "mobile"
                    ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30"
                    : "text-slate-400 hover:text-white"
                  }`}
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span className="sm:hidden">Mobile</span>
                <span className="hidden sm:inline">Expérience Mobile (Smartphone)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("desktop")}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${activeTab === "desktop"
                    ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30"
                    : "text-slate-400 hover:text-white"
                  }`}
              >
                <Monitor className="w-4 h-4 shrink-0" />
                <span className="sm:hidden">Bureau</span>
                <span className="hidden sm:inline">Vue Bureau (Desktop)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: DUAL MOBILE PREVIEW (INSPIRATION IMAGE 2) */}
        {activeTab === "mobile" && (
          <div className="pt-4 flex flex-col lg:flex-row items-center justify-center gap-8 md:gap-12 animate-in fade-in duration-300">
            {/* Phone 1: Dashboard & Transactions Screen */}
            <div className="w-full max-w-[320px] sm:max-w-[340px] rounded-[44px] p-3.5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 shadow-2xl shadow-sky-950/80 border border-slate-700">
              <div className="w-full bg-[#0F1E36] rounded-[36px] overflow-hidden border border-slate-800 text-white p-4 space-y-4">
                {/* Dynamic Island / Notch */}
                <div className="flex justify-between items-center text-[10px] text-slate-400 px-3 pt-1">
                  <span className="font-semibold text-slate-200">09:41</span>
                  <div className="w-16 h-3.5 bg-black rounded-full" />
                  <span>5G • 100%</span>
                </div>

                {/* User Header */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs text-slate-400">Bonjour 👋</span>
                    <h4 className="text-base font-bold text-white">Fidèle A.</h4>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                    FA
                  </div>
                </div>

                {/* Blue Top Spends Card with Circular Progress */}
                <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 rounded-2xl p-4 text-white shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-blue-200 font-medium">Dépenses du mois</p>
                      <h5 className="text-2xl font-black text-white mt-0.5">265 000 F</h5>
                      <p className="text-[10px] text-blue-200 mt-1">Limite : 750 000 FCFA</p>
                    </div>

                    {/* Circular 35% Gauge */}
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <svg className="w-16 h-16 -rotate-90">
                        <circle cx="32" cy="32" r="26" stroke="#1E3A8A" strokeWidth="6" fill="transparent" />
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke="#38BDF8"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray="163"
                          strokeDashoffset="105"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-xs font-black text-white">35%</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-500/40 flex justify-between text-[11px]">
                    <span className="text-blue-200">Reste disponible :</span>
                    <span className="font-bold text-cyan-300">485 000 FCFA</span>
                  </div>
                </div>

                {/* Last Transactions list */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Dernières opérations</span>
                    <span className="text-sky-400 text-[11px]">Voir tout</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { icon: ShoppingCart, label: "Supermarché & Courses", date: "Aujourd'hui, 11:20", amount: "-18 500 F", color: "bg-emerald-500/20 text-emerald-400" },
                      { icon: Car, label: "Carburant & Transport", date: "Hier, 18:45", amount: "-10 000 F", color: "bg-amber-500/20 text-amber-400" },
                      { icon: Zap, label: "Facture Électricité", date: "02 Nov, 14:10", amount: "-25 000 F", color: "bg-blue-500/20 text-sky-400" },
                      { icon: TrendingUp, label: "Vente en ligne (Revenu)", date: "01 Nov, 09:30", amount: "+85 000 F", color: "bg-emerald-500/20 text-emerald-400", isIncome: true },
                    ].map((tx) => (
                      <div key={tx.label} className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.color}`}>
                            <tx.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white truncate max-w-[130px]">{tx.label}</p>
                            <p className="text-[10px] text-slate-400">{tx.date}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold font-mono ${tx.isIncome ? "text-emerald-400" : "text-white"}`}>
                          {tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Phone 2: Budget Envelopes & Curve Screen */}
            <div className="w-full max-w-[320px] sm:max-w-[340px] rounded-[44px] p-3.5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 shadow-2xl shadow-sky-950/80 border border-slate-700">
              <div className="w-full bg-[#0F1E36] rounded-[36px] overflow-hidden border border-slate-800 text-white p-4 space-y-4">
                {/* Dynamic Island / Notch */}
                <div className="flex justify-between items-center text-[10px] text-slate-400 px-3 pt-1">
                  <span className="font-semibold text-slate-200">09:41</span>
                  <div className="w-16 h-3.5 bg-black rounded-full" />
                  <span>5G • 100%</span>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <h4 className="text-base font-bold text-white">Enveloppes Budgétaires</h4>
                    <p className="text-[11px] text-slate-400">Plafonds & Consommation</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                    Sous contrôle
                  </span>
                </div>

                {/* Mini Graph card */}
                <div className="bg-[#142642] rounded-2xl p-3 border border-slate-700/60 space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Dépenses de Novembre</span>
                    <span className="text-sky-300 font-bold">265 000 F</span>
                  </div>
                  {/* Stylized curve representation */}
                  <div className="h-16 flex items-end justify-between gap-1 px-1 pt-2">
                    <svg className="w-full h-12 overflow-visible" viewBox="0 0 100 40">
                      <path
                        d="M0,35 Q20,15 40,25 T80,10 T100,5"
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <circle cx="100" cy="5" r="4" fill="#38BDF8" className="animate-ping" />
                      <circle cx="100" cy="5" r="3" fill="#FFFFFF" />
                    </svg>
                  </div>
                </div>

                {/* Category Envelopes */}
                <div className="space-y-2.5 pt-1">
                  <p className="text-xs font-semibold text-slate-300">Catégories actives</p>
                  {[
                    { label: "Alimentation", spent: "65 000 F", max: "120 000 F", pct: 54, color: "bg-emerald-400" },
                    { label: "Loyer & Charges", spent: "110 000 F", max: "110 000 F", pct: 100, color: "bg-blue-400" },
                    { label: "Transport & Carburant", spent: "40 000 F", max: "50 000 F", pct: 80, color: "bg-amber-400" },
                    { label: "Épargne de Sécurité", spent: "50 000 F", max: "50 000 F", pct: 100, color: "bg-pink-400" },
                  ].map((env) => (
                    <div key={env.label} className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40 space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-white">{env.label}</span>
                        <span className="text-slate-300 font-mono">{env.spent} / {env.max}</span>
                      </div>
                      <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div style={{ width: `${env.pct}%` }} className={`h-full rounded-full ${env.color}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: DESKTOP VIEW PREVIEW */}
        {activeTab === "desktop" && (
          <div className="pt-4 max-w-5xl mx-auto rounded-2xl bg-[#0F1E36] border border-slate-700 p-6 md:p-8 shadow-2xl animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Cockpit Financier MonBudget (Grand Écran)</h3>
                <p className="text-xs text-slate-400">Une vision panoramique pour vos arbitrages mensuels et votre bilan d&apos;épargne</p>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-medium">
                Synchronisé avec vos mobiles
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[#142642] border border-slate-700">
                <span className="text-xs text-slate-400">Revenus</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">750 000 F</p>
                <span className="text-[10px] text-slate-500">2 sources d&apos;entrées</span>
              </div>
              <div className="p-4 rounded-xl bg-[#142642] border border-slate-700">
                <span className="text-xs text-slate-400">Dépenses engagées</span>
                <p className="text-2xl font-bold text-white mt-1">265 000 F</p>
                <span className="text-[10px] text-sky-400">35.3% du budget</span>
              </div>
              <div className="p-4 rounded-xl bg-[#142642] border border-slate-700">
                <span className="text-xs text-slate-400">Reste à allouer</span>
                <p className="text-2xl font-bold text-cyan-300 mt-1">485 000 F</p>
                <span className="text-[10px] text-slate-500">Prêt pour investissement</span>
              </div>
              <div className="p-4 rounded-xl bg-[#142642] border border-slate-700">
                <span className="text-xs text-slate-400">Épargne sécurisée</span>
                <p className="text-2xl font-bold text-pink-400 mt-1">150 000 F</p>
                <span className="text-[10px] text-emerald-400">Objectif 75% atteint</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span className="text-slate-200">
                  <strong className="text-white">Analyse de synthèse :</strong> Vos charges fixes représentent 32% de vos revenus, un ratio excellent inférieur à la recommandation des 50%.
                </span>
              </div>
              <span className="text-sky-300 font-semibold cursor-pointer hover:underline hidden sm:inline">
                Voir l&apos;audit complet &rarr;
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

