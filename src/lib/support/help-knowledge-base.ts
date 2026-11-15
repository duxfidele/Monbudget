/**
 * Base de connaissances locale de MonBudget
 * 100% locale, 0 API externe, 0 coût, fonctionne même hors-ligne.
 */

export interface KnowledgeArticle {
  id: string;
  category: "budget" | "subscriptions" | "debts" | "savings" | "investments" | "offline_security" | "support";
  categoryLabel: string;
  title: string;
  keywords: string[];
  summary: string;
  content: string;
  action?: {
    label: string;
    href: string;
  };
}

export interface HelpCategory {
  id: KnowledgeArticle["category"];
  label: string;
  icon: string;
  description: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "budget",
    label: "Budget & Enveloppes",
    icon: "Wallet",
    description: "Budget Base Zéro, enveloppes africaines, revenus multi-sources.",
  },
  {
    id: "subscriptions",
    label: "Abonnements & Paiements",
    icon: "CreditCard",
    description: "Mobile Money (T-Money, Moov, Wave, Orange, MTN), 30 jours gratuits, formules.",
  },
  {
    id: "debts",
    label: "Dettes & Créances",
    icon: "HandCoins",
    description: "Suivi des dettes à payer, des créances à récupérer, synchronisation budget.",
  },
  {
    id: "savings",
    label: "Épargne & Objectifs",
    icon: "PiggyBank",
    description: "Création d'objectifs, versements, déduction automatique du solde.",
  },
  {
    id: "investments",
    label: "Investissements",
    icon: "Briefcase",
    description: "Capital investi, rendements encaissés, ROI et portefeuille.",
  },
  {
    id: "offline_security",
    label: "Hors-ligne & Sécurité",
    icon: "ShieldCheck",
    description: "PWA sur smartphone, fonctionnement sans internet, confidentialité.",
  },
  {
    id: "support",
    label: "Assistance Humaine",
    icon: "MessageCircle",
    description: "Contacter l'équipe MonBudget directement par WhatsApp ou email.",
  },
];

export const KNOWLEDGE_BASE: KnowledgeArticle[] = [
  // ==========================================
  // THÈME 1 : BUDGET & ENVELOPPES
  // ==========================================
  {
    id: "budget-base-zero",
    category: "budget",
    categoryLabel: "Budget & Enveloppes",
    title: "Qu'est-ce que le Budget Base Zéro (BBZ) ?",
    keywords: [
      "budget base zero",
      "bbz",
      "principe",
      "definition",
      "comment ca marche",
      "methode",
      "philosophie",
      "marge libre",
      "solde restant",
    ],
    summary: "Chaque franc de vos revenus doit avoir une mission précise avant le début du mois.",
    content: `Le **Budget Base Zéro (BBZ)** est une méthode de gestion financière éprouvée :
• **Principe clé** : Vos Revenus − Toutes vos Allocations (Dépenses + Épargne + Dettes) = **0 FCFA libre**.
• Cela ne veut pas dire que votre compte bancaire est à zéro ! Cela signifie que **chaque franc est affecté consciemment** (soit à une dépense, soit à votre épargne, soit à vos investissements).
• Si votre marge libre est supérieure à 0, attribuez ce reste à une enveloppe ou à votre épargne pour optimiser votre trésorerie.`,
    action: {
      label: "Aller sur mon Budget",
      href: "/budget",
    },
  },
  {
    id: "budget-creation",
    category: "budget",
    categoryLabel: "Budget & Enveloppes",
    title: "Comment créer ou ajuster mon budget mensuel ?",
    keywords: [
      "creer budget",
      "ajuster budget",
      "faire budget",
      "nouveau mois",
      "ajouter enveloppe",
      "salaire",
      "revenu principal",
      "enregistrer budget",
    ],
    summary: "Saisissez vos revenus, ajustez vos plafonds par catégorie puis cliquez sur Enregistrer.",
    content: `Pour configurer votre budget :
1. Rendez-vous sur la page **Budget**.
2. **Revenu principal** : Saisissez votre salaire ou revenu total déclaré pour le mois actif.
3. **Multi-sources** : Cliquez sur « + Ajouter une source » si vous avez un commerce, loyer, ou activité secondaire.
4. **Enveloppes** : Cliquez sur le montant d'une catégorie pour modifier son plafond alloué, ou utilisez le bouton éclair ⚡ pour des ajouts rapides (+5k, +10k, +50k, + Reste).
5. **Enregistrement** : Cliquez sur le grand bouton vert **« Enregistrer le budget »** juste après vos enveloppes pour valider !`,
    action: {
      label: "Ouvrir la page Budget",
      href: "/budget",
    },
  },
  {
    id: "budget-duplication",
    category: "budget",
    categoryLabel: "Budget & Enveloppes",
    title: "Comment dupliquer le budget du mois précédent ?",
    keywords: [
      "dupliquer",
      "copier",
      "mois precedent",
      "gagner du temps",
      "reconduire",
      "reprendre",
    ],
    summary: "Un clic pour copier automatiquement le salaire et les enveloppes du mois passé.",
    content: `En début de chaque nouveau mois :
1. Allez sur la page **Budget**.
2. En haut de page, cliquez sur le bouton **« Dupliquer le mois précédent »** (icône de copie).
3. MonBudget recopie instantanément vos sources de revenus et vos enveloppes habituelles avec leurs plafonds.
4. Il ne vous reste plus qu'à ajuster les montants spécifiques si nécessaire et à enregistrer.`,
    action: {
      label: "Dupliquer mon budget",
      href: "/budget",
    },
  },
  {
    id: "budget-categories-africaines",
    category: "budget",
    categoryLabel: "Budget & Enveloppes",
    title: "Quelles sont les 11 catégories africaines prédéfinies ?",
    keywords: [
      "11 categories",
      "categories africaines",
      "realite africaine",
      "alimentation",
      "tontine",
      "loyer",
      "scolarite",
      "solidarite",
      "dimes",
    ],
    summary: "Des catégories adaptées au quotidien africain : Famille, Dîmes, Tontines, Santé...",
    content: `MonBudget intègre nativement 11 catégories pensées pour nos réalités quotidiennes :
1. **Alimentation & Marché**
2. **Loyer & Logement**
3. **Transport & Carburant**
4. **Santé & Soins**
5. **Scolarité & Études**
6. **Électricité & Eau (Cash Power, TdE, CIE...)**
7. **Communication & Internet (Forfaits data, crédit d'appel)**
8. **Famille & Solidarité (Soutien aux parents, cérémonies)**
9. **Dîmes & Offrandes (Engagements spirituels)**
10. **Loisirs & Sorties**
11. **Autres dépenses imprévues**

Vous pouvez aussi créer vos propres catégories personnalisées avec le bouton « + Ajouter une nouvelle enveloppe ».`,
    action: {
      label: "Voir mes enveloppes",
      href: "/budget",
    },
  },
  {
    id: "budget-solde-rouge",
    category: "budget",
    categoryLabel: "Budget & Enveloppes",
    title: "Pourquoi mon solde ou une enveloppe est en rouge ?",
    keywords: [
      "solde rouge",
      "negatif",
      "depassement",
      "alerte",
      "enveloppe rouge",
      "trop depense",
      "deficit",
    ],
    summary: "Une couleur rouge indique un dépassement de budget ou un solde en caisse négatif.",
    content: `Deux cas possibles :
• **Une enveloppe est en rouge** : Vos dépenses réelles saisies dans cette catégorie dépassent le montant alloué au départ. La jauge passe en rouge et affiche le montant exact du dépassement.
• **Le solde réel restant est en rouge** : La somme de vos dépenses réelles et de votre épargne dépasse le total de vos revenus encaissés.
👉 **Conseil d'action** : Réduisez d'autres enveloppes non prioritaires ou ajoutez une entrée d'argent dans la section Transactions pour rééquilibrer votre mois.`,
    action: {
      label: "Vérifier mes transactions",
      href: "/transactions",
    },
  },

  // ==========================================
  // THÈME 2 : ABONNEMENTS & PAIEMENTS
  // ==========================================
  {
    id: "sub-plans",
    category: "subscriptions",
    categoryLabel: "Abonnements & Paiements",
    title: "Quelles sont les formules d'abonnement et leurs tarifs ?",
    keywords: [
      "prix",
      "tarifs",
      "formules",
      "combien ca coute",
      "plans",
      "particulier",
      "personnel",
      "entreprise",
      "famille",
      "gratuit",
      "500 fcfa",
    ],
    summary: "Gratuit à 0 F, Personnel à 500 F/mois, ou Professionnel.",
    content: `MonBudget propose 3 formules claires et abordables :
1. **Plan Gratuit (0 FCFA)** : Suivi illimité de vos entrées et dépenses d'argent, recherche et historique.
2. **Plan Particulier (500 FCFA / mois ou 5 000 FCFA / an)** : Débloque 100 % des fonctionnalités avancées :
   • Enveloppes budgétaires illimitées
   • Suivi complet Dettes & Créances
   • Objectifs d'Épargne & Investissements
   • Pilotage journalier conseillé
   • Reçus et exports PDF / Excel
3. **Plan Entreprise & Famille (1 500 FCFA / mois)** : Toutes les fonctionnalités + support prioritaire 7j/7 et accès anticipé.`,
    action: {
      label: "Voir les formules",
      href: "/settings?tab=subscription",
    },
  },
  {
    id: "sub-trial",
    category: "subscriptions",
    categoryLabel: "Abonnements & Paiements",
    title: "Comment fonctionne l'essai gratuit de 30 jours ?",
    keywords: [
      "essai gratuit",
      "30 jours",
      "sans carte",
      "deblocage",
      "fin d'essai",
      "gratuitement",
    ],
    summary: "30 jours offerts avec 100% des fonctions sans carte bancaire requise.",
    content: `Dès la création de votre compte :
• Vous profitez immédiatement de **30 jours complets offerts** avec toutes les fonctionnalités débloquées.
• Aucune carte bancaire ni numéro Mobile Money n'est requis à l'inscription.
• À la fin des 30 jours, vous pouvez choisir de continuer avec le plan Particulier à 500 F/mois ou de basculer sur le plan Gratuit sans aucune perte de vos données historiques.`,
    action: {
      label: "État de mon abonnement",
      href: "/settings?tab=subscription",
    },
  },
  {
    id: "sub-payment-methods",
    category: "subscriptions",
    categoryLabel: "Abonnements & Paiements",
    title: "Comment payer par Mobile Money (T-Money, Moov, Wave, MTN, Orange) ?",
    keywords: [
      "payer",
      "mobile money",
      "fedapay",
      "t-money",
      "tmoney",
      "moov money",
      "flooz",
      "wave",
      "mtn",
      "orange money",
      "carte bancaire",
      "visa",
      "paiement",
    ],
    summary: "Paiement 100% sécurisé via FedaPay avec votre compte Mobile Money habituel.",
    content: `Le règlement de votre abonnement est ultra simple et instantané :
1. Allez dans **Paramètres** > onglet **Abonnement**.
2. Choisissez votre formule (ex: Particulier à 500 F/mois).
3. Cliquez sur **« S'abonner »** : la passerelle certifiée **FedaPay** s'ouvre.
4. Sélectionnez votre opérateur :
   • **Togo** : T-Money, Moov Money (Flooz)
   • **Bénin, Côte d'Ivoire, Sénégal** : MTN MoMo, Moov, Wave, Orange Money
   • **International** : Carte Visa / Mastercard
5. Validez le code sur votre téléphone. Votre compte est activé instantanément !`,
    action: {
      label: "Gérer mon abonnement",
      href: "/settings?tab=subscription",
    },
  },

  // ==========================================
  // THÈME 3 : DETTES & CRÉANCES
  // ==========================================
  {
    id: "debts-how-it-works",
    category: "debts",
    categoryLabel: "Dettes & Créances",
    title: "Comment gérer mes dettes et les créances qu'on me doit ?",
    keywords: [
      "dettes",
      "creances",
      "argent prete",
      "emprunt",
      "rembourser",
      "recouvrer",
      "qui me doit",
      "qui je dois",
    ],
    summary: "Suivez clairement vos remboursements à effectuer et les sommes que des proches vous doivent.",
    content: `Le module **Dettes & Créances** vous évite d'oublier de l'argent :
• **Dettes (Ce que vous devez)** : Enregistrez le créancier, le montant, la date d'échéance. Chaque remboursement partiel ou total met à jour le montant restant à devoir.
• **Créances (Ce qu'on vous doit)** : Enregistrez la personne à qui vous avez prêté de l'argent. Lorsque la personne vous rembourse, vous pouvez l'enregistrer comme entrée de revenu.
• **Liaison automatique avec le Budget** : Vos remboursements de dettes du mois créent automatiquement une enveloppe dédiée « Remboursement de dette » dans votre budget mensuel.`,
    action: {
      label: "Accéder à Dettes & Créances",
      href: "/debts",
    },
  },

  // ==========================================
  // THÈME 4 : ÉPARGNE & OBJECTIFS
  // ==========================================
  {
    id: "savings-goals",
    category: "savings",
    categoryLabel: "Épargne & Objectifs",
    title: "Comment créer et suivre un objectif d'épargne ?",
    keywords: [
      "epargne",
      "objectifs",
      "tontine",
      "economiser",
      "projet",
      "fonds d'urgence",
      "versement",
      "cagnotte",
    ],
    summary: "Fixez une cible (ex: Fonds d'urgence, Moto, Voyage) et suivez votre progression.",
    content: `Pour bâtir une épargne solide :
1. Rendez-vous sur la page **Épargne**.
2. Cliquez sur **« Nouvel objectif »** (ex: *Fonds de secours 300 000 F*, *Permis de conduire*, *Achat terrain*).
3. Définissez le montant cible et la date visée.
4. À chaque fois que vous mettez de l'argent de côté, cliquez sur **« Faire un versement »**.
5. **Synchronisation automatique** : L'épargne versée durant le mois est automatiquement comptabilisée dans votre budget mensuel et déduite de votre solde disponible pour éviter de la dépenser par accident !`,
    action: {
      label: "Voir mes objectifs d'épargne",
      href: "/savings",
    },
  },

  // ==========================================
  // THÈME 5 : INVESTISSEMENTS
  // ==========================================
  {
    id: "investments-tracking",
    category: "investments",
    categoryLabel: "Investissements",
    title: "Comment suivre mes investissements et leur rentabilité (ROI) ?",
    keywords: [
      "investissements",
      "placement",
      "rendement",
      "roi",
      "dividendes",
      "actions",
      "brvm",
      "commerce",
      "betail",
      "immobilier",
    ],
    summary: "Suivez votre capital investi et mesurez vos gains réels encaissés.",
    content: `Le module **Investissements** vous permet de piloter votre patrimoine :
• **Actifs enregistrés** : Immobilier locatif, agriculture, commerce, élevage, actions BRVM, crypto, etc.
• **Opérations de capital** : Ajoutez des injections de capital (sorties de trésorerie).
• **Rendements perçus** : Enregistrez les dividendes, loyers perçus ou bénéfices. Ils s'ajoutent automatiquement comme revenus dans vos flux du mois.
• **Calcul du ROI** : MonBudget calcule en temps réel votre taux de rentabilité global.`,
    action: {
      label: "Consulter mes investissements",
      href: "/investments",
    },
  },

  // ==========================================
  // THÈME 6 : HORS-LIGNE & SÉCURITÉ
  // ==========================================
  {
    id: "offline-pwa",
    category: "offline_security",
    categoryLabel: "Hors-ligne & Sécurité",
    title: "L'application fonctionne-t-elle sans connexion Internet ?",
    keywords: [
      "hors ligne",
      "offline",
      "sans internet",
      "connexion",
      "synchronisation",
      "pwa",
      "installer",
      "telephone",
      "smartphone",
    ],
    summary: "Oui ! MonBudget est une PWA Offline-First qui fonctionne même sans réseau.",
    content: `MonBudget est conçu selon l'architecture **Offline-First** :
• **Fonctionnement hors-ligne** : Vous pouvez ouvrir l'application, enregistrer des transactions, consulter votre budget et voir vos dettes même au village ou dans une zone sans réseau.
• **Synchronisation automatique** : Dès que vous retrouvez une connexion Internet, vos données locales sont synchronisées en tâche de fond avec votre base de données sécurisée.
• **Installation sur smartphone** : 
  • Sur Chrome / Android : Cliquez sur les 3 points > « Installer l'application » ou « Ajouter à l'écran d'accueil ».
  • Sur Safari / iPhone : Cliquez sur le bouton Partager > « Sur l'écran d'accueil ».`,
    action: {
      label: "Paramètres de l'application",
      href: "/settings",
    },
  },
  {
    id: "security-data-privacy",
    category: "offline_security",
    categoryLabel: "Hors-ligne & Sécurité",
    title: "Mes données financières sont-elles sécurisées et confidentielles ?",
    keywords: [
      "securite",
      "confidentialite",
      "mes donnees",
      "piratage",
      "rgpd",
      "rls",
      "supabase",
      "chiffrement",
      "prive",
    ],
    summary: "Chiffrement HTTPS strict, RLS 100% étanche par utilisateur, aucune revente de données.",
    content: `La protection de votre patrimoine informationnel est totale :
• **Row Level Security (RLS)** : Chaque table en base de données dispose d'une politique de sécurité stricte. Vous êtes le seul être humain capable de lire ou modifier vos chiffres.
• **Chiffrement de bout en bout** : Toutes les connexions sont chiffrées en HTTPS avec en-têtes HSTS stricts.
• **Zéro revente de données** : MonBudget ne vend ni ne partage aucune information à des tiers ou des annonceurs. Votre vie financière reste strictement privée.`,
    action: {
      label: "Consulter la politique de sécurité",
      href: "/settings",
    },
  },

  // ==========================================
  // THÈME 7 : ASSISTANCE & CONTACT
  // ==========================================
  {
    id: "support-contact",
    category: "support",
    categoryLabel: "Assistance Humaine",
    title: "Comment contacter directement l'équipe de MonBudget ?",
    keywords: [
      "contact",
      "support",
      "aide",
      "whatsapp",
      "telephone",
      "email",
      "probleme",
      "reclamation",
      "parler a un humain",
      "service client",
    ],
    summary: "Notre équipe est joignable directement par WhatsApp au +228 98 37 61 01.",
    content: `Si votre question nécessite une aide humaine :
• **WhatsApp direct** : **+228 98 37 61 01** (réponse rapide 7j/7).
• **Email** : support@monbudget.africa
• **Page d'aide dédiée** : Vous pouvez également envoyer un message depuis le formulaire de contact officiel de l'application.`,
    action: {
      label: "Ouvrir la page Support",
      href: "/support",
    },
  },
];

/**
 * Fonction de nettoyage et normalisation textuelle
 * - Minuscules
 * - Suppression des accents (é -> e, à -> a, etc.)
 * - Suppression de la ponctuation
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stop-words français à ignorer lors du calcul de pertinence
 */
const STOP_WORDS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "d", "a", "au", "aux",
  "et", "ou", "mais", "donc", "car", "ni", "or",
  "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre", "leur",
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "est", "sont", "ete", "etre", "avoir", "ai", "as", "a", "avons", "avez", "ont",
  "qui", "que", "quoi", "dont", "ou", "comment", "pourquoi", "quand", "quel", "quelle", "quels", "quelles",
  "pour", "dans", "par", "sur", "avec", "sans", "sous", "vers", "chez",
  "faire", "peux", "peut", "faire", "veut", "veux"
]);

export interface SearchMatch {
  article: KnowledgeArticle;
  score: number;
}

/**
 * Algorithme de recherche sémantique locale par mots-clés et intentions
 * Retourne les articles les plus pertinents classés par score
 */
export function searchKnowledgeBase(rawQuery: string): SearchMatch[] {
  const cleanQuery = normalizeText(rawQuery);
  if (!cleanQuery) return [];

  // Mots clés de la recherche utilisateur sans stop words
  const queryTokens = cleanQuery
    .split(" ")
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));

  if (queryTokens.length === 0) {
    // Si l'utilisateur n'a tapé que des mots courts, on utilise quand même la requête brute
    const fallbackTokens = cleanQuery.split(" ").filter((w) => w.length > 0);
    queryTokens.push(...fallbackTokens);
  }

  const results: SearchMatch[] = [];

  for (const article of KNOWLEDGE_BASE) {
    let score = 0;
    const normTitle = normalizeText(article.title);
    const normSummary = normalizeText(article.summary);
    const normContent = normalizeText(article.content);
    const normKeywords = article.keywords.map((k) => normalizeText(k));

    // 1. Correspondance exacte sur une phrase entière (ex: "budget base zero")
    if (cleanQuery.length > 3) {
      if (normTitle.includes(cleanQuery)) score += 50;
      if (normKeywords.some((k) => k.includes(cleanQuery) || cleanQuery.includes(k))) score += 40;
      if (normSummary.includes(cleanQuery)) score += 20;
    }

    // 2. Correspondance par token
    for (const token of queryTokens) {
      // Dans les mots-clés déclarés (très haute valeur)
      for (const kw of normKeywords) {
        if (kw === token) {
          score += 25;
        } else if (kw.includes(token)) {
          score += 15;
        }
      }

      // Dans le titre
      if (normTitle.includes(token)) {
        score += 20;
      }

      // Dans la catégorie
      if (article.category.includes(token)) {
        score += 12;
      }

      // Dans le résumé
      if (normSummary.includes(token)) {
        score += 8;
      }

      // Dans le contenu
      if (normContent.includes(token)) {
        score += 4;
      }
    }

    if (score > 10) {
      results.push({ article, score });
    }
  }

  // Tri décroissant par score
  return results.sort((a, b) => b.score - a.score);
}

