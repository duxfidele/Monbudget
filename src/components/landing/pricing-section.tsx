"use client";

import { useState } from "react";
import { Check, Lock, Sparkles, Shield, Crown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BillingCycle, getPlanCatalog } from "@/lib/moneriz-plans";

export function LandingPricingSection() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const catalog = getPlanCatalog();

  const plans = [
    {
      ...catalog.free,
      cta: "Démarrer mes 30 jours offerts",
      ctaHref: "/register",
    },
    {
      ...catalog.personal,
      cta: "Tester 30j puis Particulier",
      ctaHref: "/register?plan=personal",
    },
    {
      ...catalog.business,
      cta: "Tester 30j puis Entreprise",
      ctaHref: "/register?plan=business",
    },
  ];

  return (
    <section id="tarifs" className="py-20 md:py-28 bg-[#071324] text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            Tarifs Transparents en FCFA
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Des formules accessibles, payables par Mobile Money & Carte
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            30 jours d&apos;essai gratuit complet à l&apos;inscription — puis choisissez Gratuit (0 FCFA), Particulier ({catalog.personal.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois) ou Entreprise ({catalog.business.monthlyPriceXof.toLocaleString("fr-FR")} FCFA/mois).
          </p>
        </div>

        {/* Sélecteur Mensuel / Annuel (-2 mois offerts) */}
        <div className="flex flex-col items-center justify-center mb-12 gap-3">
          <div
            role="group"
            aria-label="Choisir la périodicité"
            className="inline-flex max-w-full flex-wrap justify-center items-center p-1 sm:p-1.5 rounded-2xl bg-[#0E1E36] border border-slate-800"
          >
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                billingCycle === "monthly"
                  ? "bg-sky-500 text-slate-950 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 ${
                billingCycle === "yearly"
                  ? "bg-sky-500 text-slate-950 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <span>Annuel</span>
              <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase rounded-full bg-emerald-400 text-slate-950 whitespace-nowrap">
                2 mois offerts
              </span>
            </button>
          </div>
          <p className="text-xs text-sky-300 font-medium text-center">
            {billingCycle === "yearly"
              ? "🎉 Vous ne payez que 10 mois sur 12 avec l'abonnement annuel !"
              : "Astuce : Économisez 2 mois complets en choisissant la facturation annuelle."}
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const priceXof =
              billingCycle === "yearly" ? plan.yearlyPriceXof : plan.monthlyPriceXof;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-5 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                  plan.popular
                    ? "bg-gradient-to-b from-[#122A4E] via-[#0E203B] to-[#0B1A30] border-2 border-sky-400 shadow-2xl shadow-sky-500/20 lg:-translate-y-2"
                    : "bg-[#0E1E36] border border-slate-800 shadow-lg hover:border-slate-700"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-sky-400 to-blue-500 text-slate-950 text-xs font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{plan.badge}</span>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      {plan.id === "business" && (
                        <Crown className="w-5 h-5 text-amber-400 shrink-0" />
                      )}
                      <span>{plan.name}</span>
                    </h3>
                    <span className="text-xs font-medium text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/50">
                      {plan.badge}
                    </span>
                  </div>

                  <div className="mb-4">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                        {priceXof.toLocaleString("fr-FR")} FCFA
                      </span>
                      {plan.id !== "free" && (
                        <span className="text-sm font-medium text-slate-400">
                          / {billingCycle === "yearly" ? "an" : "mois"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {plan.id === "free"
                        ? "Après 30j d'essai complet • Entrées & Dépenses"
                        : billingCycle === "yearly"
                        ? `Soit ${plan.yearlySavingsXof.toLocaleString("fr-FR")} FCFA d'économie (2 mois offerts)`
                        : `Ou ${plan.yearlyPriceXof.toLocaleString("fr-FR")} FCFA / an (2 mois offerts)`}
                    </p>
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
                    {plan.lockedFeatures?.map((locked) => (
                      <li
                        key={locked}
                        className="flex items-start gap-2.5 text-xs text-slate-500 line-through"
                      >
                        <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Lock className="w-2.5 h-2.5 text-slate-500" />
                        </div>
                        <span>{locked}</span>
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
            );
          })}
        </div>

        {/* Reassurance Footer */}
        <div className="mt-12 text-center text-xs text-slate-400 flex flex-wrap items-center justify-center gap-6">
          <span className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            Paiement sécurisé Moneriz (Wave, Orange Money, MTN, Moov & Carte)
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-sky-400" />
            Activation immédiate après confirmation serveur
          </span>
        </div>
      </div>
    </section>
  );
}
