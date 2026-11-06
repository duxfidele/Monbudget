/**
 * Utilitaires de sécurité et d'autorisation pour l'Espace Administrateur de MonBudget
 * Architecture SaaS Sécurisée
 */

export const DEFAULT_ADMIN_EMAILS = [
  "degladux@gmail.com",
  "fideleatchade@gmail.com",
];

/**
 * Récupère la liste complète des emails autorisés en tant qu'administrateurs
 */
export function getAdminEmails(): string[] {
  const envEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const combined = [...DEFAULT_ADMIN_EMAILS.map((e) => e.trim().toLowerCase()), ...envEmails];
  return Array.from(new Set(combined));
}

/**
 * Vérifie si une adresse email possède les privilèges Administrateur
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;

  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const adminList = getAdminEmails();
  return adminList.includes(normalized);
}

/**
 * Lance une exception d'accès refusé si l'utilisateur n'est pas administrateur
 */
export function assertAdmin(email: string | null | undefined): void {
  if (!isAdmin(email)) {
    throw new Error("Accès refusé. Privilèges administrateur requis.");
  }
}

/**
 * Vérifie l'accès administrateur et renvoie le statut HTTP approprié (200, 401, 403)
 */
export function verifyAdminAccess(email: string | null | undefined): {
  authorized: boolean;
  status: number;
  error?: string;
} {
  if (!email) {
    return {
      authorized: false,
      status: 401,
      error: "Non authentifié. Veuillez vous connecter.",
    };
  }

  if (!isAdmin(email)) {
    return {
      authorized: false,
      status: 403,
      error: "Accès refusé. Privilèges administrateur requis.",
    };
  }

  return { authorized: true, status: 200 };
}
