import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MonBudget — Prenez le contrôle de votre argent | Gestion de budget & finances",
  description:
    "Mon Budget vous aide à suivre vos revenus, maîtriser vos dépenses et mieux planifier votre avenir financier. Enveloppes budgétaires, épargne, gestion des dettes et conseiller IA.",
  keywords: [
    "gestion de budget",
    "gestion financière",
    "suivi des dépenses",
    "budget personnel",
    "budget familial",
    "épargne",
    "finances personnelles",
    "fintech",
    "FCFA",
  ],
  openGraph: {
    title: "MonBudget — Prenez le contrôle de votre argent",
    description:
      "Toutes vos finances, enfin organisées au même endroit. Suivez vos revenus, maîtrisez vos dépenses et construisez votre tranquillité financière.",
    type: "website",
    locale: "fr_FR",
    siteName: "MonBudget",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#071324] text-white selection:bg-sky-500 selection:text-slate-950">
      {children}
    </div>
  );
}

