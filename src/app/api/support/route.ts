import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, topic, message } = body;

    // 1. Validation des champs obligatoires
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Veuillez renseigner votre nom complet." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
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

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanTopic = (topic || "Demande d'assistance générale").trim();
    const cleanMessage = message.trim();

    // 2. Formatage de l'email pour l'équipe de support
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #0F172A; color: #F8FAFC; padding: 24px; border-radius: 12px; border: 1px solid #1E293B;">
        <h2 style="color: #38BDF8; margin-top: 0;">📩 Nouveau Ticket de Support — MonBudget</h2>
        
        <div style="background-color: #1E293B; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Expéditeur :</strong> ${cleanName}</p>
          <p style="margin: 4px 0;"><strong>Email :</strong> <a href="mailto:${cleanEmail}" style="color: #38BDF8;">${cleanEmail}</a></p>
          <p style="margin: 4px 0;"><strong>Sujet :</strong> ${cleanTopic}</p>
          <p style="margin: 4px 0;"><strong>Date :</strong> ${new Date().toLocaleString("fr-FR")}</p>
        </div>

        <h3 style="color: #CBD5E1; margin-bottom: 8px;">Message :</h3>
        <div style="background-color: #0B1120; padding: 16px; border-radius: 8px; border-left: 4px solid #38BDF8; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
${cleanMessage}
        </div>

        <p style="font-size: 12px; color: #64748B; margin-top: 24px; border-top: 1px solid #1E293B; padding-top: 12px;">
          Ce message a été envoyé depuis le formulaire officiel de la page Support MonBudget. Répondez directement à cet email pour contacter le membre.
        </p>
      </div>
    `;

    // 3. Envoi via notre infrastructure résiliente Resend
    const result = await sendEmail({
      to: "support@monbudget.app",
      replyTo: cleanEmail,
      subject: `[Support MonBudget] ${cleanTopic} — ${cleanName}`,
      html: emailHtml,
    });

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

