/**
 * Protection anti-spam multi-couches côté serveur pour MonBudget SaaS :
 * 1. Rate limiting en mémoire (fenêtre glissante) avec purge automatique
 * 2. Détection d'emails jetables / temporaires
 * 3. Vérification piège Honeypot + temps minimal humain (anti-bot sans friction)
 * 4. Détection heuristique de contenu spam (liens excessifs, BBCode, scripts, répétitions)
 * 5. Échappement HTML & nettoyage d'en-têtes email (anti-XSS & anti-CRLF injection)
 * 6. Vérification optionnelle Cloudflare Turnstile (active dès que TURNSTILE_SECRET_KEY est défini)
 */

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

interface RateLimitBucket {
  timestamps: number[];
  windowMs: number;
}

declare global {
  var __monbudgetRateLimitStore: Map<string, RateLimitBucket> | undefined;
}

function getRateLimitStore(): Map<string, RateLimitBucket> {
  if (!globalThis.__monbudgetRateLimitStore) {
    globalThis.__monbudgetRateLimitStore = new Map<string, RateLimitBucket>();
  }
  return globalThis.__monbudgetRateLimitStore;
}

export function resetRateLimitStore(): void {
  getRateLimitStore().clear();
}

function pruneExpiredBuckets(store: Map<string, RateLimitBucket>, now: number): void {
  if (store.size < 250) return;
  for (const [key, bucket] of store.entries()) {
    const cutoff = now - bucket.windowMs;
    const active = bucket.timestamps.filter((ts) => ts > cutoff);
    if (active.length === 0) {
      store.delete(key);
    } else {
      bucket.timestamps = active;
    }
  }
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now()
): RateLimitResult {
  const store = getRateLimitStore();
  pruneExpiredBuckets(store, now);

  const cutoff = now - options.windowMs;
  const existing = store.get(key);
  const recentTimestamps = existing
    ? existing.timestamps.filter((ts) => ts > cutoff)
    : [];

  if (recentTimestamps.length >= options.maxRequests) {
    const oldest = recentTimestamps[0] ?? now;
    const resetAt = oldest + options.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
    store.set(key, { timestamps: recentTimestamps, windowMs: options.windowMs });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      resetAt,
    };
  }

  recentTimestamps.push(now);
  store.set(key, { timestamps: recentTimestamps, windowMs: options.windowMs });

  const oldestAfterPush = recentTimestamps[0] ?? now;
  return {
    allowed: true,
    remaining: Math.max(0, options.maxRequests - recentTimestamps.length),
    retryAfterSeconds: 0,
    resetAt: oldestAfterPush + options.windowMs,
  };
}

export function getClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "cool.fr.nf",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "jetable.org",
  "jetable.com",
  "jetable.net",
  "mailinator.com",
  "mailinator.net",
  "mailinator2.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "pokemail.net",
  "spam4.me",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "10minemail.com",
  "tempmail.com",
  "tempmail.net",
  "tempmailo.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempail.com",
  "tmpmail.org",
  "tmpmail.net",
  "trashmail.com",
  "trashmail.net",
  "trashmail.me",
  "trashmail.de",
  "dispostable.com",
  "getnada.com",
  "nada.email",
  "maildrop.cc",
  "fakeinbox.com",
  "throwawaymail.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "burnermail.io",
  "mailnesia.com",
  "mytemp.email",
  "anonymbox.com",
  "spambox.us",
  "spamgourmet.com",
  "getairmail.com",
  "harakirimail.com",
  "inboxbear.com",
  "crazymailing.com",
  "discard.email",
  "dropmail.me",
  "filzmail.com",
  "incognitomail.org",
  "mailcatch.com",
  "mailsac.com",
  "moakt.com",
  "nowmymail.com",
  "wegwerfmail.de",
  "zippymail.info",
  "mailnull.com",
  "e4ward.com",
  "spamex.com",
  "mailexpire.com",
  "tempinbox.com",
]);

export function isValidEmailFormat(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function isDisposableEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) return false;
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return false;

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  for (const disposable of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${disposable}`)) {
      return true;
    }
  }

  return false;
}

export interface HumanCheckParams {
  honeypot?: unknown;
  formLoadedAt?: unknown;
  formElapsedMs?: unknown;
  minElapsedMs?: number;
  requireTiming?: boolean;
  now?: number;
}

export interface HumanCheckResult {
  ok: boolean;
  code?: "HONEYPOT_TRIGGERED" | "MISSING_FORM_TIMING" | "TOO_FAST_SUBMISSION";
  message?: string;
}

export function validateHumanSubmission({
  honeypot,
  formLoadedAt,
  formElapsedMs,
  minElapsedMs = 1200,
  requireTiming = false,
  now = Date.now(),
}: HumanCheckParams): HumanCheckResult {
  // 1. Piège Honeypot : un champ caché laissé vide par les humains, rempli par les robots
  if (typeof honeypot === "string" && honeypot.trim().length > 0) {
    return {
      ok: false,
      code: "HONEYPOT_TRIGGERED",
      message: "Soumission bloquée par la protection anti-spam.",
    };
  }

  if (minElapsedMs <= 0 && !requireTiming) {
    return { ok: true };
  }

  // 2. Calcul du temps écoulé : privilégie formElapsedMs (immunisé contre le décalage d'horloge PC)
  let elapsed: number | null = null;
  if (typeof formElapsedMs === "number" && Number.isFinite(formElapsedMs)) {
    elapsed = formElapsedMs;
  } else if (typeof formLoadedAt === "number" && Number.isFinite(formLoadedAt)) {
    elapsed = now - formLoadedAt;
  }

  if (elapsed === null) {
    if (requireTiming) {
      return {
        ok: false,
        code: "MISSING_FORM_TIMING",
        message: "Requête invalide : veuillez passer par le formulaire officiel de MonBudget.",
      };
    }
    return { ok: true };
  }

  if (elapsed < 0 || elapsed < minElapsedMs) {
    return {
      ok: false,
      code: "TOO_FAST_SUBMISSION",
      message: "Soumission trop rapide détectée. Veuillez patienter un instant et réessayer.",
    };
  }

  return { ok: true };
}

export interface SpamContentResult {
  isSpam: boolean;
  reason?: string;
}

export function detectSpamContent(text: string): SpamContentResult {
  const normalized = text.trim();
  if (!normalized) return { isSpam: false };

  if (normalized.length > 4000) {
    return {
      isSpam: true,
      reason: "Le message dépasse la taille maximale autorisée (4 000 caractères).",
    };
  }

  // BBCode / Balises HTML actives typiques du spam automatisé
  if (/\[(url|link)\s*=|<script\b|javascript:|onerror\s*=|onload\s*=/i.test(normalized)) {
    return {
      isSpam: true,
      reason: "Votre message contient du code ou des balises non autorisées.",
    };
  }

  // Plus de 2 liens URL dans un ticket support = spam publicitaire quasi certain
  const urlMatches = normalized.match(/(?:https?:\/\/|www\.)[^\s<>"']+/gi) || [];
  if (urlMatches.length > 2) {
    return {
      isSpam: true,
      reason: "Trop de liens externes détectés dans votre message (maximum 2 autorisés).",
    };
  }

  // Répétition mécanique d'un même caractère (ex: aaaaaaaaaaaaaaaa)
  if (/(.)\1{14,}/.test(normalized)) {
    return {
      isSpam: true,
      reason: "Votre message contient une séquence répétitive invalide.",
    };
  }

  // Sollicitations automatisées manifestes (SEO/casino/pharma)
  if (
    /\b(buy\s+backlinks|seo\s+agency|guest\s+post\s+service|casino\s+online|viagra|cialis)\b/i.test(
      normalized
    )
  ) {
    return {
      isSpam: true,
      reason: "Message bloqué par le filtre anti-spam automatique.",
    };
  }

  return { isSpam: false };
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeEmailHeader(input: string): string {
  return input.replace(/[\r\n]+/g, " ").trim();
}

export interface TurnstileVerificationResult {
  ok: boolean;
  skipped?: boolean;
  errorCodes?: string[];
  message?: string;
}

export async function verifyTurnstileToken(
  token: unknown,
  remoteIp?: string
): Promise<TurnstileVerificationResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();

  // Ne bloque jamais tant que Turnstile n'est pas encore activé dans l'environnement
  if (!secretKey) {
    return { ok: true, skipped: true };
  }

  if (typeof token !== "string" || token.trim().length < 10) {
    return {
      ok: false,
      message: "Vérification anti-robot requise. Veuillez patienter ou recharger la page.",
    };
  }

  try {
    const formData = new URLSearchParams({
      secret: secretKey,
      response: token.trim(),
    });
    if (remoteIp && remoteIp !== "unknown") {
      formData.set("remoteip", remoteIp);
    }

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        ok: false,
        message: "Service de vérification anti-robot temporairement indisponible. Réessayez.",
      };
    }

    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (!data.success) {
      return {
        ok: false,
        errorCodes: data["error-codes"],
        message: "La vérification anti-robot a expiré ou échoué. Veuillez réessayer.",
      };
    }

    return { ok: true, skipped: false };
  } catch (err) {
    console.warn("Erreur vérification Cloudflare Turnstile :", err);
    return {
      ok: false,
      message: "Impossible de valider la vérification anti-robot. Veuillez réessayer.",
    };
  }
}

