import { UserPlus, SlidersHorizontal, LineChart, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingHowItWorks() {
  const steps = [
    {
      number: "01",
      icon: UserPlus,
      title: "Créez votre compte en 30 secondes",
      description:
        "Renseignez votre email et un mot de passe sécurisé. Aucune carte bancaire n'est exigée. Vous accédez immédiatement à votre espace personnel sécurisé.",
      preview: "Inscription instantanée • Données 100% isolées",
    },
    {
      number: "02",
      icon: SlidersHorizontal,
      title: "Définissez vos revenus & enveloppes",
      description:
        "Indiquez votre salaire ou vos rentrées d'argent, précisez votre jour de paie et répartissez votre budget dans vos catégories indispensables (loyer, nourriture, transport, épargne).",
      preview: "Calcul automatique du reste à allouer",
    },
    {
      number: "03",
      icon: LineChart,
      title: "Pilotez au jour le jour et progressez",
      description:
        "Notez vos dépenses quotidiennes en 3 secondes. MonBudget recalcule en direct votre reste à vivre journalier et vous alerte avant tout dépassement imprévu.",
      preview: "Conseils IA & Barres d'alerte actives",
    },
  ];

  return (
    <section id="comment-ca-marche" className="py-20 md:py-28 bg-[#09182D] text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            Simplicité & Efficacité
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Comment ça marche ?
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Pas besoin d&apos;être un expert en comptabilité. Mon Budget a été conçu pour être pris en main en quelques minutes seulement.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative rounded-2xl p-8 bg-[#0E203B] border border-slate-800 flex flex-col justify-between shadow-lg"
            >
              {/* Step Number Watermark */}
              <div className="text-5xl font-black text-slate-800/80 mb-4 select-none">
                {step.number}
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 mb-5">
                  <step.icon className="w-6 h-6" />
                </div>

                <h3 className="text-xl font-bold text-white mb-3">
                  {step.title}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  {step.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 text-xs font-medium text-sky-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                {step.preview}
              </div>
            </div>
          ))}
        </div>

        {/* Quick CTA */}
        <div className="mt-14 text-center">
          <Link href="/login">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-semibold px-8 py-6 rounded-2xl shadow-xl shadow-sky-500/20 text-base"
            >
              Créer mon compte en 30 secondes
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

