import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { LandingProblemSection } from "@/components/landing/problem-section";
import { LandingFeaturesSection } from "@/components/landing/features-section";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingPreviewSection } from "@/components/landing/preview-section";
import { LandingBenefitsSection } from "@/components/landing/benefits-section";
import { LandingPricingSection } from "@/components/landing/pricing-section";
import { LandingFAQSection } from "@/components/landing/faq-section";
import { LandingCTASection } from "@/components/landing/cta-section";
import { LandingFooter } from "@/components/landing/footer";

export default function MarketingHomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MonBudget",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, iOS, Android",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "XOF",
    },
    description:
      "Application de gestion de budget, finances personnelles et familiales. Suivi des dépenses, enveloppes budgétaires, objectifs d'épargne et conseiller financier IA.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex flex-col min-h-screen">
        <LandingNavbar />
        <main className="flex-1">
          <LandingHero />
          <LandingProblemSection />
          <LandingFeaturesSection />
          <LandingHowItWorks />
          <LandingPreviewSection />
          <LandingBenefitsSection />
          <LandingPricingSection />
          <LandingFAQSection />
          <LandingCTASection />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}

