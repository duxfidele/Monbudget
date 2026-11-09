import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, TrendingUp, Wallet, ArrowDownRight, ArrowUpRight, Bell, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-gradient-to-b from-[#071324] via-[#0A192F] to-[#0D1F38] text-white">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[900px] h-[400px] md:h-[500px] bg-gradient-to-tr from-blue-600/20 via-sky-500/15 to-teal-400/10 blur-[130px] rounded-full pointer-events-none -z-0" />
      <div className="absolute -top-24 right-0 w-96 h-96 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        {/* Top Tag / Pill */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-sky-400/20 backdrop-blur-md shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs md:text-sm font-medium text-slate-200">
              La gestion financière moderne, pensée pour votre sérénité
            </span>
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          </div>
        </div>

        {/* Headline & Subhead */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.12]">
            Prenez le contrôle de votre argent.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-300">
              Construisez votre tranquillité financière.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Mon Budget vous aide à suivre vos revenus, maîtriser vos dépenses et mieux planifier votre avenir financier. Toutes vos finances, enfin organisées au même endroit.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/register" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold px-8 py-6 text-base rounded-2xl shadow-xl shadow-sky-500/25 hover:shadow-sky-500/35 transition-all group"
              >
                <span>Essayer 30 jours gratuitement</span>
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>

            <a href="#fonctionnalites" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-slate-700 hover:border-slate-500 bg-white/5 hover:bg-white/10 text-slate-200 font-medium px-7 py-6 text-base rounded-2xl transition-colors"
              >
                Découvrir les fonctionnalités
              </Button>
            </a>
          </div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-3 text-xs sm:text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              30 jours d&apos;essai complet offert
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Sans carte bancaire requise
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Données strictement sécurisées & privées
            </span>
          </div>
        </div>

        {/* HERO MOCKUP CARD — INSPIRATION TASKUS FINTECH */}
        <div className="mt-12 sm:mt-16 max-w-5xl mx-auto">
          <div className="relative rounded-2xl md:rounded-3xl p-1 bg-gradient-to-b from-sky-400/30 via-slate-700/30 to-transparent shadow-2xl shadow-sky-950/50">
            {/* Inner Dashboard Simulation Card */}
            <div className="bg-[#0F1E36] rounded-[18px] md:rounded-[22px] border border-slate-700/70 overflow-hidden shadow-inner">
              {/* Fake Dashboard Top Header Bar */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#0C1A30] border-b border-slate-800 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-3 font-mono text-slate-500 hidden sm:inline">
                    app.monbudget.com/dashboard
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-[11px] font-medium border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Novembre 2026 • Budget en équilibre
                  </span>
                </div>
              </div>

              {/* Main Simulated Dashboard Body */}
              <div className="p-4 sm:p-6 md:p-8 space-y-6">
                {/* 3 Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Card 1: Solde Disponible */}
                  <div className="bg-gradient-to-br from-[#162744] to-[#12213A] border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-medium">Solde & Reste à allouer</span>
                      <span className="flex items-center text-emerald-400 font-semibold text-[11px]">
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +15%
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      485 000 <span className="text-sm font-normal text-slate-400">FCFA</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>Reste à vivre quotidien :</span>
                      <span className="text-sky-400 font-semibold">20 200 FCFA / jour</span>
                    </div>
                  </div>

                  {/* Card 2: Revenus du Mois */}
                  <div className="bg-gradient-to-br from-[#162744] to-[#12213A] border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-medium">Revenus mensuels</span>
                      <span className="text-slate-500 text-[11px]">2 sources actives</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">
                      750 000 <span className="text-sm font-normal text-slate-400">FCFA</span>
                    </div>
                    <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
                      <span>Salaire + Activité freelance</span>
                      <span className="text-emerald-400 font-medium">Reçu le 28</span>
                    </div>
                  </div>

                  {/* Card 3: Dépenses Totales */}
                  <div className="bg-gradient-to-br from-[#162744] to-[#12213A] border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-medium">Dépenses engagées</span>
                      <span className="text-sky-400 text-[11px] font-semibold">35.3% consommé</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      265 000 <span className="text-sm font-normal text-slate-400">FCFA</span>
                    </div>
                    {/* Mini progress bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                      <div className="bg-gradient-to-r from-sky-500 to-blue-500 h-full rounded-full w-[35.3%]" />
                    </div>
                  </div>
                </div>

                {/* Bottom Chart & Category Split View */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                  {/* Spending Chart (Barres style TaskUs) */}
                  <div className="lg:col-span-2 bg-[#12213A] border border-slate-700/50 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-semibold text-white">Évolution des dépenses (6 derniers mois)</h4>
                        <p className="text-xs text-slate-400">Gestion régulière et baisse continue des dépenses imprévues</p>
                      </div>
                      <span className="text-xs font-medium text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-lg">
                        Moyenne : 280 000 FCFA
                      </span>
                    </div>

                    {/* Chart Bars Representation */}
                    <div className="h-44 flex items-end justify-between gap-2 sm:gap-4 pt-6 px-2">
                      {[
                        { month: "Juin", amount: "320k", height: "70%", active: false },
                        { month: "Juil", amount: "295k", height: "65%", active: false },
                        { month: "Août", amount: "340k", height: "80%", active: false },
                        { month: "Sept", amount: "285k", height: "60%", active: false },
                        { month: "Oct", amount: "270k", height: "55%", active: false },
                        { month: "Nov (en cours)", amount: "265 000 FCFA", height: "50%", active: true },
                      ].map((bar, i) => (
                        <div key={bar.month} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                          {bar.active && (
                            <div className="bg-sky-400 text-slate-950 font-bold text-[10px] sm:text-xs px-2 py-0.5 rounded shadow-md -mb-1 animate-bounce">
                              {bar.amount}
                            </div>
                          )}
                          <div className="w-full max-w-[42px] bg-slate-800 rounded-t-lg relative flex items-end h-32 overflow-hidden">
                            <div
                              style={{ height: bar.height }}
                              className={`w-full rounded-t-md transition-all duration-500 ${
                                bar.active
                                  ? "bg-gradient-to-t from-blue-600 via-sky-400 to-cyan-300 shadow-lg shadow-sky-500/40"
                                  : "bg-slate-700 group-hover:bg-slate-600"
                              }`}
                            />
                          </div>
                          <span className={`text-[11px] font-medium ${bar.active ? "text-sky-300 font-semibold" : "text-slate-400"}`}>
                            {bar.month}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Real Categories Breakdown & Advice */}
                  <div className="bg-[#12213A] border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1">Enveloppes budgétaires</h4>
                      <p className="text-xs text-slate-400 mb-4">Répartition en temps réel</p>

                      <div className="space-y-3">
                        {[
                          { name: "Alimentation & Courses", amount: "85 000", total: "120 000", color: "bg-emerald-400", pct: 70 },
                          { name: "Loyer & Charges", amount: "110 000", total: "110 000", color: "bg-blue-400", pct: 100 },
                          { name: "Transport & Carburant", amount: "40 000", total: "50 000", color: "bg-amber-400", pct: 80 },
                          { name: "Épargne de précaution", amount: "100 000", total: "100 000", color: "bg-pink-400", pct: 100 },
                        ].map((cat) => (
                          <div key={cat.name} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-300 font-medium">{cat.name}</span>
                              <span className="text-slate-400 font-mono text-[11px]">
                                {cat.amount} / {cat.total} F
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${cat.pct}%` }}
                                className={`h-full rounded-full ${cat.color}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Advisor Badge preview */}
                    <div className="mt-4 p-3 rounded-xl bg-sky-950/40 border border-sky-500/20 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-sky-200/90 leading-relaxed">
                        <strong className="text-sky-300">Conseiller IA :</strong> Votre rythme de dépense actuel vous permet d&apos;épargner 15 000 FCFA supplémentaires d&apos;ici la paie.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

