import Link from "next/link";
import Image from "next/image";
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
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shrink-0">
                <Image
                  src="/logo.png"
                  alt="MonBudget Logo"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-white leading-none">
                  Mon<span className="text-emerald-400">Budget</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-tight mt-1">
                  Gérez mieux votre argent
                </span>
              </div>
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
                <Link href="/terms" className="hover:text-white transition-colors">Conditions d&apos;utilisation (CGU)</Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">Politique de confidentialité</Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-white transition-colors">Centre d&apos;assistance & Contact</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {currentYear} MonBudget (monbudgetpro.com). Tous droits réservés.
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

