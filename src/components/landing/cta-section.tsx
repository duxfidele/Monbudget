import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingCTASection() {
  return (
    <section className="py-20 md:py-28 bg-[#071324] text-white relative overflow-hidden">
      {/* Decorative radial lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-blue-600/20 via-sky-500/20 to-cyan-400/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="rounded-3xl p-8 sm:p-12 md:p-16 bg-gradient-to-b from-[#112646] to-[#0D1C34] border border-sky-500/30 shadow-2xl text-center space-y-8 relative overflow-hidden">
          {/* Subtle top light bar */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            Passez à l&apos;action
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-3xl mx-auto leading-tight">
            Votre argent mérite une{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-300">
              meilleure organisation.
            </span>
          </h2>

          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Commencez dès aujourd&apos;hui à mieux comprendre, organiser et maîtriser vos finances. Rejoignez ceux qui ont fait le choix de la sérénité.
          </p>

          <div className="pt-2">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-slate-950 font-extrabold px-10 py-7 text-lg rounded-2xl shadow-xl shadow-sky-500/30 hover:shadow-sky-500/40 transition-all group"
              >
                <span>Créer mon compte gratuitement</span>
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          {/* Trust points */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-4 text-xs sm:text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              30 jours complets offerts
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Sans carte bancaire
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              100 % confidentiel & sécurisé
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

