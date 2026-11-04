import {
  Wallet,
  PiggyBank,
  HandCoins,
  Brain,
  LineChart,
  BellRing,
  Check,
  Layers,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

export function LandingFeaturesSection() {
  const features = [
    {
      icon: Wallet,
      color: "from-blue-500 to-sky-400",
      badge: "Indispensable",
      title: "Suivi des revenus & dépenses en temps réel",
      description:
        "Enregistrez vos salaires, primes et activités secondaires. Saisissez vos dépenses en un clic et visualisez instantanément votre solde restant et votre reste à vivre par jour jusqu'à la paie.",
      perks: [
        "Prise en charge multi-sources de revenus",
        "Calcul automatique du reste à vivre quotidien",
        "Rapprochement en direct des encaissements",
      ],
    },
    {
      icon: Layers,
      color: "from-emerald-500 to-teal-400",
      badge: "Méthode éprouvée",
      title: "Enveloppes budgétaires par catégorie",
      description:
        "Attribuez un montant précis à chaque poste de dépense (Alimentation, Loyer, Transport, Famille, Factures). Vos barres de progression colorées vous indiquent l'état de chaque enveloppe.",
      perks: [
        "Catégories adaptées aux réalités africaines et internationales",
        "Report et duplication facile d'un mois sur l'autre",
        "Détection automatique des doublons",
      ],
    },
    {
      icon: PiggyBank,
      color: "from-pink-500 to-rose-400",
      badge: "Patrimoine",
      title: "Objectifs d'épargne sanctuarisés",
      description:
        "Créez des cagnottes dédiées pour vos projets : Fonds d'urgence, Voyage, Investissement, Santé. Enregistrez vos versements mensuels et observez votre taux d'avancement grandir.",
      perks: [
        "Progression visuelle vers vos montants cibles",
        "Isolation totale des fonds d'épargne du reste à vivre",
        "Historique complet des contributions",
      ],
    },
    {
      icon: HandCoins,
      color: "from-amber-500 to-orange-400",
      badge: "Zéro oubli",
      title: "Gestionnaire de dettes & créances",
      description:
        "Distinguez clairement l'argent que vous devez (dettes) de l'argent que l'on vous doit (créances). Associez les coordonnées des personnes, notez les remboursements partiels et suivez les échéances.",
      perks: [
        "Suivi des prêts accordés et des dettes contractées",
        "Alertes visuelles en cas d'échéance dépassée",
        "Enregistrement des paiements partiels échelonnés",
      ],
    },
    {
      icon: Brain,
      color: "from-cyan-500 to-blue-400",
      badge: "Exclusivité IA",
      title: "Conseiller Financier IA personnalisé",
      description:
        "Un assistant intelligent analyse vos ratios de dépenses, détecte les anomalies (consommation rapide en début de mois, dérapages imprévus) et vous prodigue des conseils pragmatiques et bienveillants.",
      perks: [
        "Analyse de santé financière en 1 clic",
        "Recommandations réalistes adaptées à votre contexte",
        "Détection précoce du risque de découvert",
      ],
    },
    {
      icon: LineChart,
      color: "from-violet-500 to-purple-400",
      badge: "Analytique",
      title: "Rapports graphiques & exports officiels",
      description:
        "Comprenez vos habitudes de consommation grâce à des graphiques clairs et exportez vos bilans mensuels complets en PDF ou CSV pour vos démarches personnelles ou bancaires.",
      perks: [
        "Graphiques de répartition interactifs Recharts",
        "Exportation PDF imprimable en haute qualité",
        "Export tableur CSV compatible Excel et Google Sheets",
      ],
    },
  ];

  return (
    <section id="fonctionnalites" className="py-20 md:py-28 bg-[#071324] text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            Fonctionnalités opérationnelles
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Tout ce dont vous avez besoin pour maîtriser vos finances
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Pas de promesses inutiles. Chaque outil ci-dessous est déjà développé, testé et prêt à vous aider à mieux gérer votre argent au quotidien.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-2xl p-7 bg-[#0E1E36] border border-slate-800 hover:border-sky-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-sky-950/40 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${feature.color} p-0.5 shadow-md flex items-center justify-center`}
                  >
                    <div className="w-full h-full bg-[#0E1E36] rounded-[10px] flex items-center justify-center">
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/50">
                    {feature.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-sky-300 transition-colors">
                  {feature.title}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed mb-6 font-normal">
                  {feature.description}
                </p>
              </div>

              {/* Bullet perks */}
              <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
                {feature.perks.map((perk) => (
                  <div key={perk} className="flex items-start gap-2 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA Bar */}
        <div className="mt-14 text-center">
          <Link href="/login">
            <button className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 font-semibold text-sm transition-colors group">
              <span>Prêt à explorer toutes ces fonctionnalités gratuitement ?</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

