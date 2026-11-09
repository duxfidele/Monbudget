/**
 * Utilitaires de sécurité pour MonBudget
 */

const TRUSTED_PUBLIC_HOSTS = new Set([
  "monbudgetpro.com",
  "www.monbudgetpro.com",
  "monbudget.app",
  "www.monbudget.app",
]);

function extractHostname(hostOrUrl: string | undefined | null): string | null {
  if (!hostOrUrl) return null;
  const trimmed = hostOrUrl.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const parsed = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

/**
 * Résout de manière sûre l'origine publique d'une requête (domaine personnalisé vs Vercel vs localhost)
 * en tenant compte de X-Forwarded-Host tout en bloquant l'usurpation d'en-tête (CWE-644 / Open Redirect).
 */
export function getSafeRequestOrigin(request: {
  url: string;
  headers: { get(name: string): string | null };
}): string {
  const parsedRequestUrl = new URL(request.url);
  const requestHostLower = parsedRequestUrl.hostname.toLowerCase();

  const allowedHosts = new Set<string>([
    requestHostLower,
    ...TRUSTED_PUBLIC_HOSTS,
  ]);

  for (const candidate of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.MONERIZ_EMBED_ORIGIN,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ]) {
    const host = extractHostname(candidate);
    if (host) allowedHosts.add(host);
  }

  if (process.env.NODE_ENV !== "production") {
    allowedHosts.add("localhost");
    allowedHosts.add("127.0.0.1");
  }

  const forwardedHostRaw = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeaderRaw = request.headers.get("host")?.split(",")[0]?.trim();
  const forwardedProtoRaw = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  for (const rawHost of [forwardedHostRaw, hostHeaderRaw]) {
    if (!rawHost) continue;
    if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(rawHost)) continue;

    const candidateHostname = rawHost.split(":")[0].toLowerCase();
    if (!allowedHosts.has(candidateHostname)) continue;

    const isLocalHost =
      candidateHostname === "localhost" || candidateHostname === "127.0.0.1";
    const proto = isLocalHost
      ? parsedRequestUrl.protocol === "https:"
        ? "https"
        : "http"
      : forwardedProtoRaw === "http" || forwardedProtoRaw === "https"
      ? forwardedProtoRaw
      : "https";

    return `${proto}://${rawHost.toLowerCase()}`;
  }

  return parsedRequestUrl.origin;
}

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

/**
 * Valide l'authentification d'une tâche automatisée Cron (Vercel Cron)
 * Vérifie en temps constant que l'en-tête Authorization correspond au format Bearer <CRON_SECRET>.
 */
export function verifyCronSecret(authHeader: string | null, expectedSecret: string | undefined): boolean {
  if (!authHeader || !expectedSecret) {
    return false;
  }
  const expectedHeader = `Bearer ${expectedSecret}`;
  if (authHeader.length !== expectedHeader.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < authHeader.length; i++) {
    mismatch |= authHeader.charCodeAt(i) ^ expectedHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Échappe les caractères spéciaux HTML (&, <, >, ", ') pour prévenir les failles XSS.
 */
export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Échappe une cellule CSV et neutralise les formules Excel/Sheets (CSV Formula Injection CWE-1236).
 * Les nombres purs (y compris négatifs comme "-15000") sont préservés comme valeurs numériques sûres.
 */
export function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const raw = String(val);
  const isPlainNumber = typeof val === "number" || /^-?\d+(?:[.,]\d+)?$/.test(raw.trim());
  const neutralized =
    !isPlainNumber && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

/**
 * N'autorise que les URLs HTTP/HTTPS sûres dans les attributs href des emails/rapports.
 */
export function sanitizeHttpUrl(url: string | undefined | null, fallback = "https://monbudget.app"): string {
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {}
  return fallback;
}

