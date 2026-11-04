import { AlertTriangle, TrendingDown, HelpCircle, Flame, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";

export function LandingProblemSection() {
  const painPoints = [
    {
      icon: Flame,
      title: "Les petites dépenses s'accumulent en silence",
      description:
        "Cafés, courses imprévues, abonnements ou retraits d'espèces : ces fuites invisibles rongent votre budget sans que vous ne vous en rendiez compte avant la fin du mois.",
    },
    {
      icon: TrendingDown,
      title: "Le respect du budget devient un combat",
      description:
        "Sans enveloppes claires ni plafonds définis à l'avance, on dépense au jugé et on se retrouve à découvert ou en restriction dès la deuxième quinzaine du mois.",
    },
    {
      icon: AlertTriangle,
      title: "Les imprévus déstabilisent vos projets",
      description:
        "Une urgence familiale, une panne ou des frais de santé : faute d'un fonds de précaution sanctuarisé, chaque aléa oblige à s'endetter ou à piocher dans ses économies.",
    },
    {
      icon: HelpCircle,
      title: "Épargner devient impossible sans vision claire",
      description:
        "Vous tentez d'épargner « ce qu'il reste » à la fin du mois... et il ne reste jamais rien. Sans planification automatisée, votre épargne stagne année après année.",
    },
    {
      icon: AlertTriangle,
      title: "Dettes et créances dispersées",
      description:
        "L'argent que vous devez et l'argent que des amis ou collègues vous doivent sont notés sur des bouts de papier ou oubliés, créant tensions et pertes financières sèches.",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-slate-900 text-white relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-rose-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider">
            La réalité du quotidien
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Savez-vous réellement où passe votre argent ?
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Pour la majorité des familles et des actifs, la gestion financière ressemble souvent à une navigation à vue, génératrice de stress et de frustrations.
          </p>
        </div>

        {/* Pain Points Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {painPoints.map((point, index) => (
            <div
              key={point.title}
              className={`p-6 sm:p-7 rounded-2xl bg-[#0D1F38]/90 border border-slate-800 hover:border-slate-700 transition-all shadow-lg ${
                index === 4 ? "md:col-span-2 lg:col-span-1" : ""
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-5">
                <point.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2.5">
                {point.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {point.description}
              </p>
            </div>
          ))}

          {/* Solution Highlight Card */}
          <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-blue-900/40 via-[#102A4C] to-sky-950/40 border border-sky-500/30 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 mb-5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-sky-300 mb-2.5">
                La méthode MonBudget
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Une approche structurée inspirée de la méthode des enveloppes budgétaires, couplée à une IA qui veille sur votre rythme de vie.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-sky-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Chaque franc ou euro a un objectif précis</span>
            </div>
          </div>
        </div>

        {/* Conclusion Banner */}
        <div className="mt-14 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-blue-950 via-[#10243E] to-slate-900 border border-sky-500/20 text-center max-w-4xl mx-auto shadow-2xl">
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-relaxed">
            « Avec Mon Budget, vous passez de l&apos;improvisation à une gestion financière organisée, sereine et prévisible. »
          </p>
        </div>
      </div>
    </section>
  );
}

