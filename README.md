<div align="center">
  <img src="./public/logo.png" alt="Logo MonBudget" width="180" />
  <h1>MonBudget — Gérez mieux votre argent</h1>
  <p><strong>Application SaaS & PWA Mobile-First de gestion budgétaire personnelle et familiale.</strong></p>
  <p>Conçue pour s'adapter aux réalités financières africaines (FCFA, date de paie configurable, tontines, solidarité familiale) et internationales (€, $).</p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Supabase-Auth_%26_PostgreSQL-emerald?style=flat-square&logo=supabase" alt="Supabase" />
    <img src="https://img.shields.io/badge/Tests-Playwright_E2E_%26_Calculs-brightgreen?style=flat-square" alt="Tests Playwright" />
    <img src="https://img.shields.io/badge/PWA-Installable_%26_Offline-purple?style=flat-square" alt="PWA" />
  </p>
</div>

---

## 🌟 Points Forts & Fonctionnalités Majeures

- 📱 **Expérience Mobile-First & Navigation au Pouce** :
  - **En-tête Mobile à Deux Rangées** : Actions espacées sur la ligne supérieure (statut réseau, installation PWA, notifications, thème, profil) et barre de mois centrée en dessous pour éviter tout chevauchement dès `360px`.
  - **Bouton Central `+` Surélevé** : Enregistrement d'une dépense ou rentrée d'argent en 2 secondes depuis n'importe quelle vue de l'application.
  - **Modales en Feuilles Basses (*Bottom Sheets*)** : Avec poignée tactile de glissement pour un usage fluide à une main sur smartphone.
  - **Tableau de Bord Condensé 2x2** : Visualisation instantanée des indicateurs financiers fondamentaux sans défilement vertical interminable.
  - **Compatibilité Matérielle** : Respect des encoches et barres de geste (*Safe Area Insets*) et suppression des zooms forcés sur iOS Safari.

- 💰 **Règle Fondamentale de l'Épargne Réalisée** :
  - Contrairement aux applications classiques qui créent une illusion de richesse, MonBudget **déduit immédiatement toute somme mise de côté du reste à vivre réel**. L'argent épargné est considéré comme protégé et sorti de caisse.

- 🗓 **Cycle Financier Indexé sur la Vraie Date de Paie** :
  - Les salaires tombant souvent vers le 25 ou 28 du mois, le calcul du budget journalier (« Combien puis-je dépenser aujourd'hui sans être à découvert ? ») est précisément calculé jusqu'à la prochaine date de paie effective.

- 🌍 **Gestion Native du FCFA & Multi-Devises** :
  - Affichage optimisé sans décimales superflues pour le **FCFA** (UEMOA / CEMAC), et prise en charge de l'Euro (€) et du Dollar ($).

- 📲 **PWA Autonome & Mode Hors-Ligne Durci (IndexedDB)** :
  - Détection automatique de votre appareil (Ordinateur, Android, iPhone/iPad) avec procédure pas-à-pas et bouton d'installation en 1 clic.
  - Persistance locale **IndexedDB** avec file d'attente de synchronisation, marqueurs de suppression (*tombstones*), BackgroundSync, résolution manuelle des conflits et pastille d'état réseau en temps réel.

- 💳 **Abonnements Transparents, Essai 30 Jours & Paiement Moneriz** :
  - **30 jours d'essai complet** offerts dès l'inscription avec décompte visible et alertes J-3 / J0.
  - Formule **Gratuit** (0 FCFA : Page Budget/Revenus + Entrées & Dépenses), **Particulier** (**500 FCFA/mois** ou **5 000 FCFA/an**) et **Entreprise & Pro** (**1 500 FCFA/mois** ou **15 000 FCFA/an**, 2 mois offerts en annuel).
  - Paiement sécurisé par Mobile Money et carte bancaire via **Moneriz Liveframe** intégré.

- 🧾 **Justificatifs de Dépenses & Scan de Reçus** :
  - Prise de photo ou téléversement de reçus (JPEG, PNG, WebP, PDF jusqu'à 5 Mo) avec stockage sécurisé et partitionné par utilisateur.

- 🤝 **Dettes & Créances** :
  - Suivi des sommes prêtées (à récupérer) et des sommes empruntées (à solder) avec alertes d'échéance.

- 🛡 **Sécurité SaaS Renforcée & Espace Admin (`/admin`)** :
  - Row Level Security (RLS) PostgreSQL sur toutes les tables, protection Open Redirect, en-têtes de sécurité HTTP stricts et gouvernance administrateur dédiée.

- 💬 **Support Client & WhatsApp Intégré** :
  - Bouton d'assistance WhatsApp direct (`+228 98 37 61 01`) et formulaire de contact direct avec secours par email via Resend.

---

## 🛠 Stack Technique

- **Framework** : [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19)
- **Langage** : TypeScript (mode strict, 0 erreur)
- **Design & Interface** : Tailwind CSS, Base UI Dialog / Radix Primitives, Lucide Icons, Sonner Toasts
- **État, Hors-Ligne & Données** : Zustand couplé à IndexedDB (file de synchro, tombstones, conflits) et synchronisation Supabase
- **Authentification & Base de Données** : Supabase (PostgreSQL 15+, Row Level Security)
- **Paiements & Abonnements** : Moneriz Liveframe Checkout & Webhooks HMAC (`/api/checkout`, `/api/webhooks/moneriz`)
- **Emails Transactionnels** : Resend avec fallback de simulation résilient
- **Tests & Assurance Qualité** : Playwright Test (calculs financiers, sécurité, offline-first, paiements Moneriz, emails, reçus, exports et support)

---

## 🚀 Démarrage Rapide

### 1. Cloner le Dépôt

```bash
git clone https://github.com/duxfidele/Monbudget.git
cd MonBudget
```

### 2. Installer les Dépendances

```bash
npm install
```

### 3. Variables d'Environnement

Créez un fichier `.env.local` à la racine :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon

# Service d'emails (Optionnel - simulation console en dev si non renseigné)
RESEND_API_KEY=re_votre_cle_resend
EMAIL_FROM=MonBudget <notifications@monbudget.app>

# Administrateurs autorisés
ADMIN_EMAILS=fidele@monbudget.app,admin@monbudget.app

# Sécurité Cron Jobs
CRON_SECRET=votre-secret-cron-robuste
```

### 4. Lancer en Mode Développement

```bash
npm run dev
```

L'application est accessible à l'adresse [http://localhost:3000](http://localhost:3000).

---

## 🧪 Tests & Qualité de Code

```bash
# Vérification des types TypeScript
npx tsc --noEmit

# Exécution des tests Playwright principaux (calculs, sécurité, hors-ligne, Moneriz, emails, reçus, admin, export, support, légal)
npx playwright test tests/budget-calc.spec.ts tests/security.spec.ts tests/offline-first.spec.ts tests/moneriz.spec.ts tests/email.spec.ts tests/receipts.spec.ts tests/admin.spec.ts tests/export.spec.ts tests/support.spec.ts tests/legal.spec.ts

# Compiler pour la production
npm run build
```

---

## 📚 Documentation Détaillée

Pour consulter l'intégralité des spécifications techniques, des formules mathématiques comptables, de l'architecture des tables Supabase et des guides utilisateurs, veuillez vous référer au fichier maître :

👉 **[MONBUDGET.md](./MONBUDGET.md)**

---

## 📄 Licence

Ce projet est la propriété de MonBudget. Tous droits réservés.
