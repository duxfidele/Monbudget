import { Eye, PieChart, ShieldAlert, CalendarClock, Target, Compass, CheckCircle } from "lucide-react";

export function LandingBenefitsSection() {
  const benefits = [
    {
      icon: Eye,
      title: "Visualisez votre situation en 3 secondes",
      description:
        "Finies les incertitudes devant le solde de votre compte. Ouvrez MonBudget et découvrez immédiatement ce que vous pouvez réellement dépenser aujourd'hui sans mettre en péril la fin du mois.",
    },
    {
      icon: PieChart,
      title: "Comprenez enfin vos habitudes réelles",
      description:
        "La catégorisation automatique et les graphiques de flux vous révèlent exactement où va chaque somme d'argent, vous permettant d'éliminer les dépenses superflues sans frustration.",
    },
    {
      icon: ShieldAlert,
      title: "Identifiez les dépassements avant qu'ils n'arrivent",
      description:
        "Grâce au seuil d'alerte personnalisable (ex: 80%), l'application vous avertit dès qu'une enveloppe approche de sa limite, évitant ainsi tout découvert ou mauvaise surprise.",
    },
    {
      icon: CalendarClock,
      title: "Anticipez et protégez votre jour de paie",
      description:
        "Le calcul du reste à vivre journalier s'adapte en temps réel aux jours restants jusqu'au versement de votre prochain salaire, vous garantissant de traverser le mois avec sérénité.",
    },
    {
      icon: Target,
      title: "Organisez vos projets financiers en toute clarté",
      description:
        "Qu'il s'agisse de préparer un investissement, de constituer un fonds d'urgence ou de financer les études, vos objectifs sont quantifiés, suivis et sanctuarisés mois après mois.",
    },
    {
      icon: Compass,
      title: "Prenez des décisions éclairées et objectives",
      description:
        "Fini le stress ou les suppositions. Vos décisions s'appuient sur des données financières réelles, consolidées et accompagnées des préconisations bienveillantes de votre Conseiller IA.",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-[#09182D] text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            Bénéfices Tangibles
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Une meilleure vision de vos finances commence ici
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Mon Budget n&apos;est pas une simple calculatrice : c&apos;est votre partenaire quotidien pour bâtir votre liberté et votre sécurité financière.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="p-7 rounded-2xl bg-[#0D1F38] border border-slate-800 hover:border-slate-700 transition-all shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500/20 to-blue-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 mb-5">
                  <benefit.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2.5">
                  {benefit.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  {benefit.description}
                </p>
              </div>

              <div className="pt-4 mt-6 border-t border-slate-800/80 flex items-center gap-2 text-xs font-medium text-emerald-400">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Impact mesurable dès le 1er mois</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

