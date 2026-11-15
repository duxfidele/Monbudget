export interface AppFeatureRelease {
  version: string;
  releaseDate: string;
  title: string;
  badge?: string;
  highlights: {
    title: string;
    description: string;
    category?: "nouveau" | "amelioration" | "correctif";
  }[];
}

export const CURRENT_APP_VERSION = "4.2.0";

export const APP_CHANGELOG: AppFeatureRelease[] = [
  {
    version: "4.2.0",
    releaseDate: "15 Novembre 2026",
    title: "Portefeuille d'Investissements & Plan Gratuit 100% Débloqué",
    badge: "Majeure",
    highlights: [
      {
        title: "Nouveau Module Investissements & Rendements (ROI)",
        description:
          "Pilotez vos investissements (Immobilier, Commerce, Tontine, Crypto, Élevage, Bourse, Projets). Enregistrez les sorties de capital et rentrées de gains avec calcul automatique du ROI en temps réel.",
        category: "nouveau",
      },
      {
        title: "Concordance Totale avec Mon Budget & Tableau de bord",
        description:
          "Toute opération d'investissement ou de rendement ajuste automatiquement vos enveloppes et votre solde en caisse pour une comptabilité sans faille.",
        category: "nouveau",
      },
      {
        title: "Plan Gratuit 100% Fonctionnel & Sans Faux Cadenas",
        description:
          "Les enveloppes budgétaires, l'ajout illimité de transactions et la consultation du solde disponible sont désormais totalement fluides et débloqués pour tous les utilisateurs.",
        category: "amelioration",
      },
      {
        title: "Notifications & Mises à Jour PWA Intelligentes",
        description:
          "Soyez alerté dès qu'une nouvelle mise à jour ou fonctionnalité est déployée, avec installation en 1 clic sur votre écran d'accueil ou votre ordinateur.",
        category: "amelioration",
      },
    ],
  },
  {
    version: "4.1.0",
    releaseDate: "14 Novembre 2026",
    title: "Rapports Financiers & Exports Professionnels",
    highlights: [
      {
        title: "Générateur Officiel de Rapports PDF & CSV",
        description:
          "Téléchargez votre bilan mensuel complet au format PDF officiel avec mise en page A4 élégante et synthèse financière.",
        category: "nouveau",
      },
      {
        title: "Conseiller Financier IA Africain",
        description:
          "Diagnostic personnalisé avec Score de Santé Financière sur 100 et recommandations adaptées aux réalités économiques locales.",
        category: "nouveau",
      },
    ],
  },
  {
    version: "4.0.0",
    releaseDate: "10 Novembre 2026",
    title: "Moteur Offline-First & Gestionnaire de Dettes",
    highlights: [
      {
        title: "Mode Hors-ligne Instantané",
        description:
          "Continuez à saisir vos dépenses et gérer votre budget même sans connexion internet grâce au moteur IndexedDB + Service Worker.",
        category: "nouveau",
      },
      {
        title: "Gestionnaire Complet Dettes & Créances",
        description:
          "Suivez qui vous devez et qui vous doit, avec relances WhatsApp personnalisées en un clic.",
        category: "nouveau",
      },
    ],
  },
];

