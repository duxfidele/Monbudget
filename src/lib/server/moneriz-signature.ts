import crypto from "node:crypto";

const TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Vérifie la signature cryptographique HMAC-SHA256 d'un webhook Moneriz.
 * Format attendu de l'en-tête X-Moneriz-Signature : t=<unix_ms>,v1=<hex>
 * La chaîne signée est `${t}.${rawBody}` sur le corps brut non modifié.
 */
export function verifyMonerizSignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!header || !secret) return false;

  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    })
  );

  const timestamp = Number(parts.t);
  const signature = parts.v1;

  if (!Number.isFinite(timestamp) || !/^[0-9a-f]{64}$/i.test(signature ?? "")) {
    return false;
  }

  if (Math.abs(nowMs - timestamp) > TOLERANCE_MS) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

/**
 * Génère un en-tête X-Moneriz-Signature valide (utile pour les tests d'intégration).
 */
export function buildMonerizSignatureHeader(
  rawBody: string,
  secret: string,
  timestampMs: number = Date.now()
): string {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestampMs}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestampMs},v1=${signature}`;
}

