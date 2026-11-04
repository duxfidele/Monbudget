"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export function LandingFAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Qu'est-ce que Mon Budget ?",
      answer:
        "Mon Budget est une application moderne de gestion financière personnelle et familiale conçue pour vous redonner le contrôle absolu sur votre argent. Elle repose sur la méthode éprouvée des enveloppes budgétaires, vous permet de suivre vos revenus multi-sources, calcule votre reste à vivre en direct et intègre un Conseiller IA pour vous aider à atteindre vos objectifs d'épargne.",
    },
    {
      question: "À qui s'adresse l'application ?",
      answer:
        "Mon Budget s'adresse aux salariés, indépendants, chefs de famille, étudiants et entrepreneurs qui souhaitent en finir avec l'angoisse des fins de mois. Elle est particulièrement optimisée pour prendre en compte les réalités du quotidien (dépenses familiales, tontines, dettes et créances entre proches, salaires avec jour de paie paramétrable).",
    },
    {
      question: "Comment créer un compte ?",
      answer:
        "L'inscription prend moins de 30 secondes. Cliquez sur le bouton « Commencer gratuitement », entrez votre email et votre mot de passe. Aucun numéro de carte bancaire n'est requis pour démarrer. Vous pouvez immédiatement définir vos revenus et commencer à organiser votre mois.",
    },
    {
      question: "Puis-je utiliser Mon Budget sur mon téléphone portable ?",
      answer:
        "Oui, absolument ! Mon Budget est une Progressive Web App (PWA) 100 % responsive. Vous pouvez l'utiliser directement dans le navigateur de votre smartphone (iPhone ou Android) ou l'ajouter à votre écran d'accueil d'un simple geste pour une expérience identique à une application native, rapide et accessible partout.",
    },
    {
      question: "Mes données financières sont-elles protégées ?",
      answer:
        "La sécurité et la confidentialité de vos données constituent notre priorité absolue. L'application a fait l'objet d'un audit de sécurité rigoureux : toutes les requêtes sont chiffrées en HTTPS (HSTS forcé), la base de données PostgreSQL applique des politiques Row Level Security (RLS) strictes garantissant qu'aucun autre utilisateur ne peut accéder à vos données, et le cache local est hermétiquement partitionné et purgé à la déconnexion.",
    },
    {
      question: "Puis-je annuler mon abonnement à tout moment ?",
      answer:
        "Oui. Toutes nos formules sont sans engagement de durée. Vous pouvez modifier, suspendre ou résilier votre formule payante à tout moment depuis vos paramètres en un simple clic. Vos données existantes restent conservées et accessibles sur la formule Découverte gratuite.",
    },
    {
      question: "Quelle est la différence entre l'offre gratuite et l'offre payante ?",
      answer:
        "L'offre Découverte est gratuite à vie et vous permet de gérer l'essentiel de vos dépenses quotidiennes avec jusqu'à 6 enveloppes budgétaires et 1 objectif d'épargne. Les offres Sérénité Pro et Famille débloquent l'illimité sur les catégories, le suivi complet des dettes et créances avec échéances, les recommandations avancées du Conseiller IA, les exports officiels PDF/CSV et la gestion multi-budgets.",
    },
  ];

  return (
    <section id="faq" className="py-20 md:py-28 bg-[#09182D] text-white relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            Questions Fréquentes
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Tout ce que vous devez savoir
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Vous avez des questions avant de vous lancer ? Voici les réponses aux interrogations les plus fréquentes.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className="rounded-2xl bg-[#0D1F38] border border-slate-800 transition-all overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 hover:bg-white/5 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-base sm:text-lg font-semibold text-white">
                    {faq.question}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180 bg-sky-500 text-slate-950" : "text-slate-400"
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-sm sm:text-base text-slate-300 leading-relaxed border-t border-slate-800/60 animate-in fade-in duration-200">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

