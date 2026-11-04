/**
 * Utilitaires de sécurité pour MonBudget
 */

/**
 * Valide et assainit une URL de redirection pour empêcher les attaques Open Redirect (CWE-601).
 * Rejette toute URL externe, protocole http/https/javascript, double slashes (//) et backslashes (\).
 */
export function getSafeRedirectUrl(nextParam: string | null, baseUrl: string): URL {
  if (
    nextParam &&
    nextParam.startsWith('/') &&
    !nextParam.startsWith('//') &&
    !nextParam.includes('\\') &&
    !nextParam.includes('://')
  ) {
    return new URL(nextParam, baseUrl);
  }
  return new URL('/', baseUrl);
}

/**
 * Génère une clé de stockage LocalStorage partitionnée par utilisateur
 * pour éviter les fuites de données inter-comptes sur les postes partagés (CWE-200 / CWE-639).
 */
export function getUserStorageKey(userId?: string | null): string {
  return userId ? `monbudget_cache_${userId}` : "monbudget_local_cache_anon";
}

