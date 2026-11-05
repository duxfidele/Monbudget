import Link from "next/link";
import { ShieldCheck, Heart } from "lucide-react";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#050D19] border-t border-slate-800 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-sky-500 to-cyan-400 p-[1px] shadow-md shadow-blue-500/20">
                <div className="w-full h-full bg-[#0A192F] rounded-[11px] flex items-center justify-center">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 font-extrabold text-sm tracking-tight">
                    MB
                  </span>
                </div>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Mon<span className="text-sky-400">Budget</span>
              </span>
            </Link>

            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              Mon Budget est la plateforme SaaS de référence pour structurer, maîtriser et faire fructifier vos finances personnelles et familiales au quotidien.
            </p>

            <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Données chiffrées & isolées par Row Level Security (RLS)</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-white uppercase tracking-wider">
              Navigation
            </p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors">Accueil</a>
              </li>
              <li>
                <a href="#fonctionnalites" className="hover:text-white transition-colors">Fonctionnalités</a>
              </li>
              <li>
                <a href="#comment-ca-marche" className="hover:text-white transition-colors">Comment ça marche</a>
              </li>
              <li>
                <a href="#apercu" className="hover:text-white transition-colors">Aperçu interactif</a>
              </li>
              <li>
                <a href="#tarifs" className="hover:text-white transition-colors">Tarification</a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              </li>
              <li>
                <Link href="/support" className="text-sky-400 hover:text-white transition-colors font-medium">
                  Support & Contact (WhatsApp)
                </Link>
              </li>
            </ul>
          </div>

          {/* Features Column */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-white uppercase tracking-wider">
              Fonctionnalités
            </p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link href="/register" className="hover:text-white transition-colors">Suivi des revenus & dépenses</Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">Enveloppes budgétaires</Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">Objectifs d&apos;épargne</Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">Dettes & Créances</Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">Conseiller Financier IA</Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">Rapports & Exports</Link>
              </li>
            </ul>
          </div>

          {/* Legal & Auth */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-white uppercase tracking-wider">
              Espace & Légal
            </p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link href="/login" className="hover:text-white transition-colors">Se connecter</Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">Créer un compte</Link>
              </li>
              <li>
                <a href="#tarifs" className="hover:text-white transition-colors">Conditions d&apos;utilisation</a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">Politique de confidentialité</a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">Audit de sécurité SaaS</a>
              </li>
              <li>
                <Link href="/support" className="hover:text-white transition-colors">Centre d&apos;assistance</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {currentYear} MonBudget. Tous droits réservés.
          </p>
          <p className="flex items-center gap-1.5">
            <span>Conçu pour votre liberté financière</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </p>
        </div>
      </div>
    </footer>
  );
}

