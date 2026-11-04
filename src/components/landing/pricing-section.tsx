import { Check, Sparkles, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingPricingSection() {
  const plans = [
    {
      name: "Découverte",
      badge: "Gratuit à vie",
      price: "0 FCFA",
      subtext: "Sans carte bancaire • Idéal pour démarrer",
      description: "Pour prendre en main la méthode MonBudget et organiser son premier budget mensuel.",
      features: [
        "Suivi des revenus et des dépenses en direct",
        "Jusqu'à 6 enveloppes budgétaires personnalisées",
        "1 objectif d'épargne avec barre d'avancement",
        "Calcul du reste à vivre journalier",
        "Accès complet sur mobile & ordinateur",
        "Sécurité et isolation des données RLS",
      ],
      cta: "Commencer gratuitement",
      ctaHref: "/register",
      popular: false,
      variant: "outline" as const,
    },
    {
      name: "Sérénité Pro",
      badge: "Le plus choisi",
      price: "2 500 FCFA",
      billingPeriod: "/ mois",
      subtext: "Soit ~3,90 € / mois • Sans engagement",
      description: "Pour ceux qui veulent piloter l'intégralité de leurs finances, de leurs dettes et booster leur épargne.",
      features: [
        "Tout ce qui est inclus dans Découverte",
        "Catégories et enveloppes illimitées",
        "Objectifs d'épargne illimités & historique des versements",
        "Gestionnaire complet des dettes & créances avec échéances",
        "Conseiller Financier IA personnalisé (analyse mensuelle)",
        "Rapports détaillés & exports officiels en PDF et CSV",
        "Notifications & rappels du jour de paie",
      ],
      cta: "Créer mon compte Pro",
      ctaHref: "/register",
      popular: true,
      variant: "default" as const,
    },
    {
      name: "Famille & Foyer",
      badge: "Multi-budgets",
      price: "4 900 FCFA",
      billingPeriod: "/ mois",
      subtext: "Soit ~7,50 € / mois • Sans engagement",
      description: "Pour les foyers, couples et entrepreneurs qui souhaitent séparer budget personnel et charges familiales.",
      features: [
        "Tout ce qui est inclus dans Sérénité Pro",
        "Gestion multi-budgets distincts (Maison, Projets, Famille)",
        "Suivi consolidé des dépenses du foyer",
        "Support prioritaire dédié 7j/7",
        "Accès anticipé à toutes les futures fonctionnalités",
      ],
      cta: "Choisir l'offre Famille",
      ctaHref: "/register",
      popular: false,
      variant: "outline" as const,
    },
  ];

  return (
    <section id="tarifs" className="py-20 md:py-28 bg-[#071324] text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            Tarifs Transparents
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Des formules simples, adaptées à votre rythme
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Commencez 100 % gratuitement dès aujourd&apos;hui. Faites évoluer votre formule uniquement si vos besoins grandissent.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                plan.popular
                  ? "bg-gradient-to-b from-[#122A4E] via-[#0E203B] to-[#0B1A30] border-2 border-sky-400 shadow-2xl shadow-sky-500/20 lg:-translate-y-2"
                  : "bg-[#0E1E36] border border-slate-800 shadow-lg hover:border-slate-700"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-sky-400 to-blue-500 text-slate-950 text-xs font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Recommandé</span>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <span className="text-xs font-medium text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/50">
                    {plan.badge}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white tracking-tight">{plan.price}</span>
                    {plan.billingPeriod && (
                      <span className="text-sm font-medium text-slate-400">{plan.billingPeriod}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{plan.subtext}</p>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed mb-6 pb-6 border-b border-slate-800">
                  {plan.description}
                </p>

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-xs text-slate-200">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Link href={plan.ctaHref} className="w-full block">
                  <Button
                    size="lg"
                    className={`w-full py-6 rounded-2xl font-semibold text-sm transition-all ${
                      plan.popular
                        ? "bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-lg shadow-sky-500/25"
                        : "bg-white/10 hover:bg-white/15 text-white border border-slate-700"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Reassurance Footer */}
        <div className="mt-12 text-center text-xs text-slate-400 flex flex-wrap items-center justify-center gap-6">
          <span className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            Aucun engagement, résiliation en 1 clic
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-sky-400" />
            Tarifs transparents sans frais cachés
          </span>
        </div>
      </div>
    </section>
  );
}

