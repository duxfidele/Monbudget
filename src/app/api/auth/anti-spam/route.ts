import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  isDisposableEmail,
  isValidEmailFormat,
  validateHumanSubmission,
  verifyTurnstileToken,
} from "@/lib/server/anti-spam";
import { authAntiSpamRequestSchema } from "@/lib/validations";

type AuthAntiSpamAction = "register" | "login" | "forgot-password";

const RATE_LIMIT_CONFIG: Record<
  AuthAntiSpamAction,
  { maxRequests: number; windowMs: number }
> = {
  register: { maxRequests: 8, windowMs: 10 * 60 * 1000 },
  login: { maxRequests: 15, windowMs: 10 * 60 * 1000 },
  "forgot-password": { maxRequests: 5, windowMs: 15 * 60 * 1000 },
};

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        { error: "Requête invalide.", code: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const rawAction = (rawBody as Record<string, unknown>).action;
    if (rawAction !== "register" && rawAction !== "login" && rawAction !== "forgot-password") {
      return NextResponse.json(
        { error: "Action d'authentification non reconnue.", code: "INVALID_ACTION" },
        { status: 400 }
      );
    }

    const action: AuthAntiSpamAction = rawAction;

    const clientIp = getClientIp(req);
    const limitRule = RATE_LIMIT_CONFIG[action];
    const rate = checkRateLimit(`auth:${action}:${clientIp}`, limitRule);

    if (!rate.allowed) {
      const waitMinutes = Math.max(1, Math.ceil(rate.retryAfterSeconds / 60));
      return NextResponse.json(
        {
          error: `Trop de tentatives détectées. Par sécurité, veuillez patienter ${waitMinutes} minute${waitMinutes > 1 ? "s" : ""} avant de réessayer.`,
          code: "RATE_LIMITED",
          retryAfterSeconds: rate.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rate.retryAfterSeconds),
          },
        }
      );
    }

    const parsedBody = authAntiSpamRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: parsedBody.error.issues[0]?.message || "Requête invalide.",
          code: "INVALID_PAYLOAD",
        },
        { status: 400 }
      );
    }

    const body = parsedBody.data;

    const humanCheck = validateHumanSubmission({
      honeypot: body.honeypot,
      formLoadedAt: body.formLoadedAt,
      formElapsedMs: body.formElapsedMs,
      minElapsedMs: action === "register" ? 1200 : action === "forgot-password" ? 800 : 0,
      requireTiming: action !== "login",
    });

    if (!humanCheck.ok) {
      return NextResponse.json(
        {
          error: humanCheck.message || "Soumission bloquée par la protection anti-spam.",
          code: humanCheck.code || "SPAM_BLOCKED",
        },
        { status: 400 }
      );
    }

    const email = (body.email || "").trim();
    if (!isValidEmailFormat(email)) {
      return NextResponse.json(
        {
          error: "Veuillez saisir une adresse email valide.",
          code: "INVALID_EMAIL",
        },
        { status: 400 }
      );
    }

    if (action === "register" && isDisposableEmail(email)) {
      return NextResponse.json(
        {
          error:
            "Les adresses email jetables ou temporaires ne sont pas acceptées. Utilisez votre adresse Gmail, Outlook, Yahoo ou professionnelle.",
          code: "DISPOSABLE_EMAIL",
        },
        { status: 400 }
      );
    }

    const turnstile = await verifyTurnstileToken(body.turnstileToken, clientIp);
    if (!turnstile.ok) {
      return NextResponse.json(
        {
          error: turnstile.message || "La vérification anti-robot a échoué.",
          code: "TURNSTILE_FAILED",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      turnstileSkipped: Boolean(turnstile.skipped),
    });
  } catch (err) {
    console.error("Erreur vérification anti-spam auth :", err);
    return NextResponse.json(
      { error: "Erreur de vérification de sécurité.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

