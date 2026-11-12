import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { getPlanCatalog } from "@/lib/moneriz-plans";
import {
  FileText,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation (CGU) — MonBudget | monbudgetpro.com",
  description:
    "Conditions Générales d'Utilisation officielles du SaaS MonBudget (monbudgetpro.com). Règles d'accès, abonnements, paiements Moneriz, sécurité et responsabilités.",
};

export default function TermsPage() {
  const lastUpdated = "12 novembre 2026";
  const catalog = getPlanCatalog();
  const businessMonthly = catalog.business.monthlyPriceXof.toLocaleString("fr-FR");
  const businessYearly = catalog.business.yearlyPriceXof.toLocaleString("fr-FR");

  return (
    <div className="flex flex-col min-h-screen bg-[#071324] text-white selection:bg-sky-500 selection:text-slate-950">
      <LandingNavbar />

      <main className="flex-1 pt-28 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Fil d'Ariane & Titre */}
          <div className="mb-10 space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour à l&apos;accueil
            </Link>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold tracking-wide">
              <FileText className="w-3.5 h-3.5" />
              Document Juridique Officiel
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Conditions Générales d&apos;Utilisation{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
                (CGU)
              </span>
            </h1>

            <p className="text-slate-400 text-sm sm:text-base">
              Dernière mise à jour : <strong className="text-slate-200">{lastUpdated}</strong> • S&apos;applique à la plateforme SaaS{" "}
              <strong className="text-sky-400">MonBudget</strong> accessible à l&apos;adresse{" "}
              <a href="https://monbudgetpro.com" className="underline hover:text-white">
                monbudgetpro.com
              </a>
              .
            </p>
          </div>

          {/* Sommaire Rapide */}
          <div className="mb-12 p-6 rounded-2xl bg-[#0D1D33] border border-slate-800 text-sm">
            <p className="font-semibold text-white mb-3 text-xs uppercase tracking-wider text-slate-400">
              Sommaire des articles
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <a href="#art1" className="hover:text-emerald-400 transition-colors">1. Préambule et Objet</a>
              <a href="#art2" className="hover:text-emerald-400 transition-colors">2. Accès et Inscription</a>
              <a href="#art3" className="hover:text-emerald-400 transition-colors">3. Formules SaaS & Tarifs</a>
              <a href="#art4" className="hover:text-emerald-400 transition-colors">4. Modalités de Paiement Moneriz</a>
              <a href="#art5" className="hover:text-emerald-400 transition-colors">5. Sécurité et Données</a>
              <a href="#art6" className="hover:text-emerald-400 transition-colors">6. Avertissement & Non-Responsabilité</a>
              <a href="#art7" className="hover:text-emerald-400 transition-colors">7. Propriété Intellectuelle</a>
              <a href="#art8" className="hover:text-emerald-400 transition-colors">8. Résiliation et Support</a>
            </div>
          </div>

          {/* Corps des CGU */}
          <div className="space-y-10 text-slate-300 leading-relaxed text-sm sm:text-base">
            {/* Article 1 */}
            <section id="art1" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2.5 text-lg font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h2>Préambule et Présentation du Service</h2>
              </div>
              <p>
                Les présentes Conditions Générales d&apos;Utilisation (ci-après les « <strong>CGU</strong> ») régissent l&apos;ensemble des relations contractuelles entre l&apos;utilisateur (ci-après « <strong>l&apos;Utilisateur</strong> » ou « <strong>le Membre</strong> ») et la plateforme SaaS <strong>MonBudget</strong>, accessible en ligne via le domaine officiel <strong>https://monbudgetpro.com</strong> et sous forme d&apos;application progressive (PWA).
              </p>
              <p>
                MonBudget est un progiciel de gestion financière personnelle et professionnelle en ligne conçu spécifiquement pour structurer le budget, suivre les entrées et dépenses en Francs CFA (FCFA) et autres devises, planifier les objectifs d&apos;épargne, gérer le recouvrement des créances et dettes, et bénéficier de recommandations d&apos;optimisation budgétaire assistées par intelligence artificielle.
              </p>
            </section>

            {/* Article 2 */}
            <section id="art2" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2.5 text-lg font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h2>Accès au Service et Création de Compte</h2>
              </div>
              <p>
                L&apos;accès à MonBudget nécessite la création préalable d&apos;un compte personnel. L&apos;Utilisateur peut créer son compte :
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-300">
                <li>
                  Par saisie directe d&apos;une adresse email valide et d&apos;un mot de passe sécurisé d&apos;au moins 8 caractères.
                </li>
                <li>
                  Par authentification unique via <strong>Google (« Se connecter avec Google » / Google OAuth)</strong>.
                </li>
              </ul>
              <p>
                L&apos;Utilisateur garantit l&apos;exactitude des informations transmises et est seul responsable de la confidentialité de ses identifiants. Toute action réalisée depuis un compte authentifié est réputée avoir été effectuée par le titulaire du compte.
              </p>
            </section>

            {/* Article 3 */}
            <section id="art3" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2.5 text-lg font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h2>Formules SaaS, Fonctionnalités et Tarification</h2>
              </div>
              <p>
                Toute nouvelle inscription bénéficie d&apos;une période d&apos;<strong>essai gratuit complet de 30 jours</strong> donnant accès à toutes les fonctionnalités actuelles. À l&apos;issue de cet essai, l&apos;Utilisateur choisit librement l&apos;une des trois (3) formules suivantes :
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
                <div className="p-4 rounded-xl bg-[#0B1A2F] border border-slate-800 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Plan Gratuit</span>
                  <p className="text-xl font-extrabold text-white">0 FCFA</p>
                  <p className="text-xs text-slate-400">
                    Suivi illimité des Entrées et Dépenses, historique et recherche. Les fonctionnalités avancées restent cadenassées.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0B1A2F] border border-sky-500/40 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Plan Particulier</span>
                  <p className="text-xl font-extrabold text-white">500 FCFA <span className="text-xs font-normal text-slate-400">/mois</span></p>
                  <p className="text-xs text-slate-400">
                    Ou 5 000 FCFA/an (2 mois offerts). Débloque 100 % des fonctionnalités actuelles : Enveloppes budgétaires, Épargne, Dettes &amp; Créances, Rapports PDF/CSV, Reçus et Conseiller IA.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0B1A2F] border border-emerald-500/40 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Plan Entreprise &amp; Pro</span>
                  <p className="text-xl font-extrabold text-white">{businessMonthly} FCFA <span className="text-xs font-normal text-slate-400">/mois</span></p>
                  <p className="text-xs text-slate-400">
                    Ou {businessYearly} FCFA/an (2 mois offerts). Inclut tout du plan Particulier + support prioritaire 7j/7 et accès anticipé aux futurs modules dédiés Entreprise.
                  </p>
                </div>
              </div>
            </section>

            {/* Article 4 */}
            <section id="art4" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2.5 text-lg font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <h2>Modalités de Paiement Sécurisé Moneriz</h2>
              </div>
              <p>
                Tous les paiements d&apos;abonnements sur MonBudget sont traités de façon ultra-sécurisée via la passerelle de paiement agréée <strong>Moneriz</strong> (https://api.moneriz.com).
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-300">
                <li>
                  <strong>Moyens acceptés :</strong> Mobile Money (T-Money, Moov Flooz, MTN Mobile Money, Orange Money, Wave) et Cartes Bancaires internationales (Visa, Mastercard).
                </li>
                <li>
                  <strong>Sécurité des données de paiement :</strong> MonBudget ne stocke, ne traite ni n&apos;a accès à aucun numéro de carte bancaire ni à aucun code PIN de Mobile Money. L&apos;ensemble de la transaction est chiffré de bout en bout par Moneriz.
                </li>
                <li>
                  <strong>Activation immédiate :</strong> L&apos;activation des fonctionnalités s&apos;effectue de manière instantanée et automatique dès la réception du webhook serveur sécurisé émis par Moneriz.
                </li>
              </ul>
            </section>

            {/* Article 5 */}
            <section id="art5" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2.5 text-lg font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  5
                </div>
                <h2>Sécurité et Confidentialité des Données</h2>
              </div>
              <p>
                La sécurité des données financières de nos utilisateurs est la priorité absolue de MonBudget. Chaque base de données est isolée par la technologie <strong>Row Level Security (RLS)</strong> sur PostgreSQL (hébergé par Supabase).
              </p>
              <p>
                Pour connaître en détail nos engagements de protection et vos droits concernant la collecte des informations, veuillez consulter notre{" "}
                <Link href="/privacy" className="text-emerald-400 underline hover:text-emerald-300 font-semibold">
                  Politique de Confidentialité
                </Link>
                .
              </p>
            </section>

            {/* Article 6 */}
            <section id="art6" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2.5 text-lg font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  6
                </div>
                <h2>Avertissement et Non-Responsabilité Financière</h2>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Avertissement important sur la nature du service</span>
                </div>
                <p>
                  MonBudget est un outil logiciel d&apos;organisation personnelle, de visualisation budgétaire et d&apos;aide à la décision. <strong>MonBudget n&apos;est pas une banque, ni une institution de microfinance, ni un intermédiaire agréé en opérations de banque.</strong>
                </p>
                <p>
                  Les analyses produites par l&apos;application ainsi que les conseils formulés par le Conseiller IA sont des suggestions purement indicatives basées sur les données saisies par l&apos;Utilisateur. Ils ne constituent en aucun cas des conseils en investissement financier, juridique ou fiscal certifié. L&apos;Utilisateur demeure l&apos;unique décisionnaire de ses engagements financiers.
                </p>
              </div>
            </section>

            {/* Article 7 */}
            <section id="art7" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2.5 text-lg font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  7
                </div>
                <h2>Propriété Intellectuelle</h2>
              </div>
              <p>
                L&apos;ensemble des éléments composant le service MonBudget (code source, interfaces graphiques, logo, base de données, textes et algorithmes) sont la propriété exclusive de l&apos;éditeur de MonBudget. Toute reproduction, copie ou décompilation sans autorisation préalable expresse est formellement interdite.
              </p>
            </section>

            {/* Article 8 */}
            <section id="art8" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-2.5 text-lg font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  8
                </div>
                <h2>Résiliation, Droit Applicable et Support</h2>
              </div>
              <p>
                L&apos;Utilisateur peut à tout moment décider de clôturer son compte et d&apos;arrêter son abonnement depuis la rubrique <strong>Paramètres</strong> de l&apos;application ou en sollicitant notre équipe d&apos;assistance.
              </p>
              <p>
                En cas de question ou de litige, nous privilégions toujours la résolution amiable. Vous pouvez joindre notre service support :
              </p>
              <div className="p-4 rounded-xl bg-[#0B1A2F] border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">Support Client MonBudget</p>
                  <p className="text-xs text-slate-400">Disponible 7j/7 par WhatsApp et par messagerie</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/support"
                    className="px-4 py-2 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-xs font-semibold transition-colors"
                  >
                    Centre de support
                  </Link>
                  <a
                    href="https://wa.me/22898376101"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    WhatsApp direct
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
