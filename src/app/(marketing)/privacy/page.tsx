import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import {
  ShieldCheck,
  Lock,
  Database,
  EyeOff,
  UserCheck,
  Trash2,
  FileCheck2,
  ArrowLeft,
  Mail,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Politique de Confidentialité — MonBudget | monbudgetpro.com",
  description:
    "Politique de confidentialité et protection des données personnelles de MonBudget (monbudgetpro.com). Conformité Google API Services User Data Policy, RGPD et sécurité Supabase.",
};

export default function PrivacyPage() {
  const lastUpdated = "8 novembre 2026";

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

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5" />
              Protection des Données & Vie Privée
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Politique de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
                Confidentialité
              </span>
            </h1>

            <p className="text-slate-400 text-sm sm:text-base">
              Dernière mise à jour : <strong className="text-slate-200">{lastUpdated}</strong> • S&apos;applique à la plateforme SaaS{" "}
              <strong className="text-sky-400">MonBudget</strong> (
              <a href="https://monbudgetpro.com" className="underline hover:text-white">
                monbudgetpro.com
              </a>
              ).
            </p>
          </div>

          {/* Encadré d'engagement solennel */}
          <div className="mb-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#0A261D] via-[#071D22] to-[#071324] border border-emerald-500/30 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              Notre engagement de confidentialité fondamentale
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Vos finances vous appartiennent. Nous ne vendons jamais vos données.
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Chez MonBudget, la confidentialité de vos informations financières et personnelles n&apos;est pas une option : c&apos;est le fondement même de notre service. Nous ne monétisons aucune donnée auprès de régies publicitaires, de courtiers en données ou de tiers.
            </p>
          </div>

          {/* Sommaire Rapide */}
          <div className="mb-12 p-6 rounded-2xl bg-[#0D1D33] border border-slate-800 text-sm">
            <p className="font-semibold text-white mb-3 text-xs uppercase tracking-wider text-slate-400">
              Table des matières
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <a href="#section-collecte" className="hover:text-emerald-400 transition-colors">1. Données que nous collectons</a>
              <a href="#section-google" className="hover:text-emerald-400 transition-colors">2. Données reçues des API Google (OAuth)</a>
              <a href="#section-usage" className="hover:text-emerald-400 transition-colors">3. Comment nous utilisons vos données</a>
              <a href="#section-securite" className="hover:text-emerald-400 transition-colors">4. Sécurité & Chiffrement Supabase</a>
              <a href="#section-paiement" className="hover:text-emerald-400 transition-colors">5. Sécurité des Paiements Moneriz</a>
              <a href="#section-droits" className="hover:text-emerald-400 transition-colors">6. Vos droits & Suppression de compte</a>
              <a href="#section-conservation" className="hover:text-emerald-400 transition-colors">7. Conservation & Cookies</a>
              <a href="#section-contact" className="hover:text-emerald-400 transition-colors">8. Contact du Délégué à la Protection (DPO)</a>
            </div>
          </div>

          {/* Corps de la Politique */}
          <div className="space-y-12 text-slate-300 leading-relaxed text-sm sm:text-base">
            {/* Section 1 */}
            <section id="section-collecte" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h2>Les données que nous collectons</h2>
              </div>
              <p>
                Dans le cadre de l&apos;utilisation de MonBudget, nous collectons uniquement les informations strictement nécessaires au bon fonctionnement de vos outils de gestion financière :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-300">
                <li>
                  <strong>Informations d&apos;identification :</strong> Votre nom complet, adresse e-mail, photo de profil et langue/devise de préférence (par défaut FCFA).
                </li>
                <li>
                  <strong>Données financières déclaratives :</strong> Les montants de vos revenus, vos dépenses, les catégories associées, vos plafonds budgétaires, vos cagnottes d&apos;épargne ainsi que le registre de vos dettes et créances que vous saisissez librement.
                </li>
                <li>
                  <strong>Données techniques de session :</strong> Adresse IP, type d&apos;appareil, navigateur et horodatage de connexion pour la prévention des fraudes et la sécurisation des sessions.
                </li>
              </ul>
            </section>

            {/* Section 2 — SPÉCIFIQUE GOOGLE OAUTH & LIMITED USE POLICY */}
            <section id="section-google" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h2>Utilisation des données reçues des API Google (Google OAuth)</h2>
              </div>
              <div className="p-5 sm:p-6 rounded-2xl bg-[#091D2F] border border-sky-500/30 space-y-3">
                <p className="font-semibold text-white">
                  Conformité stricte avec la politique de Google :
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  L&apos;utilisation et le transfert par MonBudget à toute autre application des informations reçues des API Google respecteront scrupuleusement la{" "}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 underline font-medium hover:text-sky-300"
                  >
                    Politique relative aux données utilisateur des services d&apos;API Google (Google API Services User Data Policy)
                  </a>
                  , y compris les exigences d&apos;utilisation limitée (<em>Limited Use requirements</em>).
                </p>
                <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm text-slate-300">
                  <li>
                    <strong>Finalité exclusive d&apos;authentification :</strong> Lorsque vous choisissez « Se connecter avec Google », nous demandons uniquement l&apos;accès à votre profil de base (nom, adresse email et photo de profil publique) afin de créer ou synchroniser votre compte de manière instantanée et sécurisée.
                  </li>
                  <li>
                    <strong>Aucune lecture de données privées Google :</strong> MonBudget ne demande aucun accès à vos emails Gmail, vos documents Google Drive, vos photos ou vos contacts.
                  </li>
                  <li>
                    <strong>Non-utilisation pour l&apos;entraînement de modèles d&apos;IA générique :</strong> Les données utilisateur issues de Google ne sont jamais utilisées pour entraîner, réentraîner ou améliorer des modèles d&apos;intelligence artificielle tiers ou généralistes.
                  </li>
                  <li>
                    <strong>Aucune cession commerciale :</strong> Nous ne vendons, ne louons et ne transférons aucune information obtenue via Google OAuth à des courtiers en données ou des plateformes publicitaires.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 3 */}
            <section id="section-usage" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h2>Comment nous utilisons vos données</h2>
              </div>
              <p>Vos informations sont traitées aux seules fins suivantes :</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3.5 rounded-xl bg-[#0B1A2F] border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Calculer vos totaux de dépenses, budgets restants et projections d&apos;épargne.</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B1A2F] border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Alimenter votre Conseiller IA en contexte financier pour vous délivrer des conseils d&apos;épargne sur-mesure.</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B1A2F] border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Gérer vos abonnements et confirmer vos paiements via la passerelle Moneriz.</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B1A2F] border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Vous envoyer les alertes de dépassement budgétaire et le récapitulatif mensuel si activé.</span>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section id="section-securite" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <h2>Sécurité & Chiffrement de l&apos;Infrastructure Supabase</h2>
              </div>
              <p>
                Nous appliquons les standards de cybersécurité les plus stricts du secteur SaaS :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-300">
                <li>
                  <strong>Chiffrement de bout en bout :</strong> Tous les échanges entre votre appareil et nos serveurs sont protégés par le protocole HTTPS/TLS avec chiffrement 256 bits.
                </li>
                <li>
                  <strong>Cloisonnement par Row Level Security (RLS) :</strong> Dans notre base de données PostgreSQL gérée par Supabase, chaque ligne de données est verrouillée par une règle RLS hermétique : seul l&apos;utilisateur détenteur du compte authentifié peut lire ou écrire ses propres données financières.
                </li>
                <li>
                  <strong>Sauvegardes chiffrées automatiques :</strong> Des sauvegardes régulières sont effectuées pour garantir l&apos;intégrité et la disponibilité de vos enregistrements.
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="section-paiement" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  5
                </div>
                <h2>Sécurité des Paiements via Moneriz</h2>
              </div>
              <p>
                Pour les souscriptions aux plans Particulier et Entreprise, les transactions sont déléguées à la passerelle certifiée <strong>Moneriz</strong> (https://api.moneriz.com).
              </p>
              <p>
                MonBudget n&apos;a à aucun moment accès à votre code PIN Mobile Money, ni au numéro complet ou cryptogramme (CVC) de votre carte bancaire. Ces informations sont directement traitées selon les normes de sécurité PCI-DSS les plus rigoureuses.
              </p>
            </section>

            {/* Section 6 */}
            <section id="section-droits" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  6
                </div>
                <h2>Vos droits : Accès, Export et Suppression Définitive</h2>
              </div>
              <p>
                Conformément aux réglementations sur la protection de la vie privée (RGPD et lois nationales de protection des données personnelles) :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
                <div className="p-4 rounded-xl bg-[#0B1A2F] border border-slate-800 space-y-1.5">
                  <UserCheck className="w-5 h-5 text-sky-400" />
                  <p className="font-semibold text-white text-sm">Droit d&apos;accès & de rectification</p>
                  <p className="text-xs text-slate-400">Consultez et modifiez toutes vos informations directement depuis vos écrans de paramètres.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0B1A2F] border border-slate-800 space-y-1.5">
                  <FileCheck2 className="w-5 h-5 text-emerald-400" />
                  <p className="font-semibold text-white text-sm">Droit à la portabilité</p>
                  <p className="text-xs text-slate-400">Exportez l&apos;intégralité de vos opérations comptables au format CSV ou PDF en 1 clic.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0B1A2F] border border-rose-500/40 space-y-1.5">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                  <p className="font-semibold text-white text-sm">Droit à l&apos;effacement (Droit à l&apos;oubli)</p>
                  <p className="text-xs text-slate-400">Supprimez définitivement votre compte et toutes vos données associées à tout moment.</p>
                </div>
              </div>
            </section>

            {/* Section 7 */}
            <section id="section-conservation" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  7
                </div>
                <h2>Conservation des Données & Gestion des Cookies</h2>
              </div>
              <p>
                Vos données sont conservées aussi longtemps que votre compte reste actif. En cas d&apos;inactivité prolongée de plus de vingt-quatre (24) mois sans connexion, nous pouvons procéder à l&apos;archivage sécurisé ou à la suppression de votre compte après notification préalable.
              </p>
              <p>
                MonBudget n&apos;utilise <strong>aucun cookie publicitaire tiers ou traceur intrusif</strong>. Les seuls cookies et mécanismes de stockage local (LocalStorage / Cache PWA) utilisés sont strictement techniques et indispensables pour maintenir votre session de connexion active et permettre le fonctionnement hors-ligne de l&apos;application.
              </p>
            </section>

            {/* Section 8 */}
            <section id="section-contact" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  8
                </div>
                <h2>Contact du Délégué à la Protection des Données (DPO)</h2>
              </div>
              <p>
                Pour exercer vos droits ou poser toute question relative au traitement de vos données personnelles sur <strong>monbudgetpro.com</strong>, vous pouvez contacter directement notre équipe :
              </p>
              <div className="p-5 rounded-2xl bg-[#0B1A2F] border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    support@monbudgetpro.com
                  </p>
                  <p className="text-xs text-slate-400">
                    Réponse sous 24 à 48 heures ouvrées • Assistance WhatsApp disponible au +228 98 37 61 01
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/support"
                    className="px-4 py-2 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-xs font-semibold transition-colors"
                  >
                    Formulaire de support
                  </Link>
                  <a
                    href="https://wa.me/22898376101"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    Contacter sur WhatsApp
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

