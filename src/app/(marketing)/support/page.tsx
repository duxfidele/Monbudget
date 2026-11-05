import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Smartphone,
  ExternalLink,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Support & Assistance — MonBudget | Contact WhatsApp +228 98 37 61 01",
  description:
    "Contactez le support MonBudget via WhatsApp direct au +228 98 37 61 01. Assistance 7j/7, FAQ et accompagnement personnalisé pour la gestion de vos finances.",
};

export default function SupportPage() {
  const whatsappNumber = "+228 98 37 61 01";
  const whatsappUrl =
    "https://wa.me/22898376101?text=Bonjour%20l%27%C3%A9quipe%20MonBudget%2C%20j%27ai%20besoin%20d%27assistance%20sur%20l%27application.";

  const supportFaqs = [
    {
      q: "Comment contacter directement l'équipe sur WhatsApp ?",
      a: "Vous pouvez cliquer sur le bouton vert WhatsApp ci-dessous ou enregistrer le numéro +228 98 37 61 01 dans votre carnet d'adresses. Notre équipe vous répond généralement en moins de 15 minutes.",
    },
    {
      q: "Comment installer MonBudget sur mon smartphone (Android ou iPhone) ?",
      a: "MonBudget est une Progressive Web App (PWA). Sur Chrome/Android, cliquez sur 'Installer' dans la barre de menu. Sur iPhone/Safari, appuyez sur le bouton de partage puis choisissez 'Sur l'écran d'accueil'. L'application fonctionne ensuite comme une application native sans passer par l'App Store.",
    },
    {
      q: "Mes données financières sont-elles en sécurité ?",
      a: "Absolument. Vos données sont hébergées sur une infrastructure PostgreSQL sécurisée par Supabase avec Row Level Security (RLS). Seul votre compte utilisateur authentifié a la clé pour lire et modifier vos finances. Aucun tiers n'a accès à vos chiffres.",
    },
    {
      q: "Puis-je utiliser MonBudget sans connexion internet ?",
      a: "Oui ! Grâce à notre Service Worker intégré, MonBudget se charge et reste consultable même lorsque vous n'avez pas de connexion réseau. Vos dernières données sont stockées en local sur votre appareil.",
    },
    {
      q: "Comment configurer mon jour de paie réel (ex: le 28 du mois) ?",
      a: "Rendez-vous dans la section Paramètres de votre tableau de bord. Vous pouvez définir le jour exact où votre salaire est viré. Le Conseiller IA et le budget journalier adapteront automatiquement leurs calculs jusqu'à votre prochaine paie.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#071324] text-white selection:bg-sky-500 selection:text-slate-950">
      <LandingNavbar />

      <main className="flex-1 pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Support Client & Assistance Dédiée
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Comment pouvons-nous vous{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
                aider aujourd&apos;hui ?
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Une question technique, un blocage, ou besoin d&apos;un conseil pour configurer vos enveloppes budgétaires ? Notre équipe est joignable directement par WhatsApp et par messagerie.
            </p>
          </div>

          {/* WhatsApp Primary Highlight Card */}
          <div className="mt-12 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F2D25] via-[#0A1F1C] to-[#071324] border border-emerald-500/30 p-6 sm:p-10 shadow-2xl shadow-emerald-950/40">
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-800/60">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  Canal d&apos;Assistance Recommandé
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  Échangez en direct sur WhatsApp avec notre équipe
                </h2>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  Obtenez une réponse instantanée, partagez vos captures d&apos;écran ou posez vos questions d&apos;utilisation en toute simplicité directement depuis votre téléphone ou votre ordinateur.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Disponible 7j/7</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>Réponse sous 15 min</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Support officiel certifié</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col items-center sm:items-end justify-center gap-3">
                <div className="text-center sm:text-right">
                  <span className="text-xs text-slate-400 block">Numéro officiel WhatsApp</span>
                  <span className="text-2xl font-extrabold text-white tracking-wide block font-mono">
                    {whatsappNumber}
                  </span>
                </div>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-6 px-8 rounded-2xl shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-base">
                    <MessageCircle className="w-5 h-5 fill-white" />
                    <span>Ouvrir WhatsApp</span>
                    <ExternalLink className="w-4 h-4 opacity-80" />
                  </Button>
                </a>
              </div>
            </div>
          </div>

          {/* 3 Secondary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {/* Téléphone / Appel */}
            <div className="bg-[#0A192F]/80 border border-slate-800 rounded-2xl p-6 space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Phone className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Appel Direct</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Vous préférez un échange vocal rapide ? Vous pouvez joindre notre ligne d&apos;assistance téléphonique.
              </p>
              <div className="pt-2">
                <a
                  href="tel:+22898376101"
                  className="text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors font-mono"
                >
                  +228 98 37 61 01
                </a>
              </div>
            </div>

            {/* Email de Support */}
            <div className="bg-[#0A192F]/80 border border-slate-800 rounded-2xl p-6 space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Support par Email</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pour toute demande commerciale, partenariat ou signalement approfondi avec pièces jointes.
              </p>
              <div className="pt-2">
                <a
                  href="mailto:contact@monbudget.app"
                  className="text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                >
                  contact@monbudget.app
                </a>
              </div>
            </div>

            {/* PWA & Installation Mobile */}
            <div className="bg-[#0A192F]/80 border border-slate-800 rounded-2xl p-6 space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Installation Mobile</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Besoin d&apos;aide pour ajouter l&apos;icône sur votre écran d&apos;accueil ? Suivez notre guide en un clic.
              </p>
              <div className="pt-2">
                <Link
                  href="/#comment-ca-marche"
                  className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Voir le tutoriel</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Section FAQ & Questions Fréquentes */}
          <div className="mt-16 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Questions Fréquentes d&apos;Assistance</h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Trouvez des réponses immédiates aux questions les plus courantes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {supportFaqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-[#0A192F]/70 border border-slate-800/80 rounded-2xl p-5 space-y-2 hover:border-slate-700 transition-colors"
                >
                  <h4 className="text-sm font-semibold text-white flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{faq.q}</span>
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed pl-6">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action */}
          <div className="mt-16 p-8 rounded-3xl bg-gradient-to-r from-blue-900/30 via-slate-900/40 to-sky-900/20 border border-slate-800 text-center space-y-4">
            <h3 className="text-xl font-bold text-white">Vous avez déjà un compte MonBudget ?</h3>
            <p className="text-sm text-slate-300 max-w-xl mx-auto">
              Accédez directement à vos enveloppes, vos transactions et au conseiller financier IA depuis votre espace sécurisé.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <Link href="/login">
                <Button className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-sky-500/20">
                  Accéder à mon espace
                </Button>
              </Link>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 px-6 py-2.5 rounded-xl">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Poser une question sur WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
