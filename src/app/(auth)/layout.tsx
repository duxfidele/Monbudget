import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative bg-slate-50 dark:bg-[#071324] flex flex-col items-center justify-center p-3 sm:p-4 py-16 transition-colors">
      {/* Bouton Retour vers la Landing Page en haut à gauche */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <Link
          href="/"
          aria-label="Retour à l'accueil"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Retour à l&apos;accueil</span>
        </Link>
      </div>

      {children}
    </div>
  );
}
