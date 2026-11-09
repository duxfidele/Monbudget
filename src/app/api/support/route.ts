import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/service";
import {
  checkRateLimit,
  detectSpamContent,
  escapeHtml,
  getClientIp,
  isValidEmailFormat,
  sanitizeEmailHeader,
  validateHumanSubmission,
  verifyTurnstileToken,
} from "@/lib/server/anti-spam";

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(`support:${clientIp}`, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rate.allowed) {
      const waitMinutes = Math.max(1, Math.ceil(rate.retryAfterSeconds / 60));
      return NextResponse.json(
        {
          error: `Trop de messages envoyés depuis votre connexion. Veuillez patienter ${waitMinutes} minute${waitMinutes > 1 ? "s" : ""} ou utiliser WhatsApp.`,
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rate.retryAfterSeconds),
          },
        }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Requête invalide.", code: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    // 1. Protections anti-bot (Honeypot + temps de remplissage humain + Cloudflare Turnstile optionnel)
    const humanCheck = validateHumanSubmission({
      honeypot: body.honeypot,
      formLoadedAt: body.formLoadedAt,
      formElapsedMs: body.formElapsedMs,
      minElapsedMs: 1200,
      requireTiming: true,
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

    const { name, email, topic, message } = body;

    // 2. Validation stricte des champs obligatoires
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Veuillez renseigner votre nom complet." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !isValidEmailFormat(email)) {
      return NextResponse.json(
        { error: "Veuillez renseigner une adresse email valide." },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return NextResponse.json(
        { error: "Veuillez écrire un message d'au moins 5 caractères." },
        { status: 400 }
      );
    }

    const cleanName = name.trim().slice(0, 120);
    const cleanEmail = sanitizeEmailHeader(email);
    const cleanTopic = sanitizeEmailHeader(
      typeof topic === "string" && topic.trim() ? topic : "Demande d'assistance générale"
    ).slice(0, 160);
    const cleanMessage = message.trim();

    // 3. Filtrage heuristique du contenu spam (liens multiples, BBCode, scripts, répétitions)
    const spamCheck = detectSpamContent(`${cleanTopic}\n${cleanMessage}`);
    if (spamCheck.isSpam) {
      return NextResponse.json(
        {
          error: spamCheck.reason || "Message bloqué par notre filtre anti-spam.",
          code: "SPAM_CONTENT_DETECTED",
        },
        { status: 400 }
      );
    }

    // 4. Échappement HTML complet avant injection dans le template email (protection anti-XSS)
    const safeName = escapeHtml(cleanName);
    const safeEmail = escapeHtml(cleanEmail);
    const safeTopic = escapeHtml(cleanTopic);
    const safeMessage = escapeHtml(cleanMessage);

    // 5. Formatage de l'email pour l'équipe de support
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #0F172A; color: #F8FAFC; padding: 24px; border-radius: 12px; border: 1px solid #1E293B;">
        <h2 style="color: #38BDF8; margin-top: 0;">📩 Nouveau Ticket de Support — MonBudget</h2>
        
        <div style="background-color: #1E293B; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Expéditeur :</strong> ${safeName}</p>
          <p style="margin: 4px 0;"><strong>Email :</strong> <a href="mailto:${safeEmail}" style="color: #38BDF8;">${safeEmail}</a></p>
          <p style="margin: 4px 0;"><strong>Sujet :</strong> ${safeTopic}</p>
          <p style="margin: 4px 0;"><strong>Date :</strong> ${new Date().toLocaleString("fr-FR")}</p>
        </div>

        <h3 style="color: #CBD5E1; margin-bottom: 8px;">Message :</h3>
        <div style="background-color: #0B1120; padding: 16px; border-radius: 8px; border-left: 4px solid #38BDF8; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
${safeMessage}
        </div>

        <p style="font-size: 12px; color: #64748B; margin-top: 24px; border-top: 1px solid #1E293B; padding-top: 12px;">
          Ce message a été envoyé depuis le formulaire officiel de la page Support MonBudget. Répondez directement à cet email pour contacter le membre.
        </p>
      </div>
    `;

    // 6. Envoi via notre infrastructure résiliente Resend
    const result = await sendEmail({
      to: "support@monbudget.app",
      replyTo: cleanEmail,
      subject: sanitizeEmailHeader(`[Support MonBudget] ${cleanTopic} — ${cleanName}`),
      html: emailHtml,
    });

    if (!result.success && !result.mocked) {
      return NextResponse.json(
        {
          error:
            "Impossible de transmettre votre demande pour le moment. Veuillez utiliser WhatsApp.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Votre message a été transmis avec succès. Notre équipe vous répondra très rapidement.",
      mocked: result.mocked || false,
    });
  } catch (error: any) {
    console.error("Erreur transmission ticket support :", error);
    return NextResponse.json(
      { error: "Impossible de transmettre votre demande pour le moment. Veuillez utiliser WhatsApp." },
      { status: 500 }
    );
  }
}

