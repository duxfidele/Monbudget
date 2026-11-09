import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessFeature, getSubscriptionCountdownInfo } from "@/lib/moneriz-plans";
import { getOrderAndSubscriptionStatus } from "@/lib/server/moneriz-app";
import {
  validateReceiptFile,
  validateReceiptBuffer,
  generateReceiptStoragePath,
  formatFileSize,
} from "@/lib/utils/receipt-storage";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 jours

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non autorisé. Veuillez vous connecter." },
        { status: 401 }
      );
    }

    // Vérification stricte de l'abonnement actif (Essai 30j, Particulier 1 000 FCFA+ ou Super-Admin requis)
    const { subscription, isAdmin: isSuperAdmin } =
      await getOrderAndSubscriptionStatus({
        userId: user.id,
        userEmail: user.email,
      });

    const countdown = getSubscriptionCountdownInfo({
      planId: subscription.planId,
      status: subscription.status,
      expiresAt: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      trialChoiceMadeAt: subscription.trialChoiceMadeAt,
      isAdmin: isSuperAdmin,
    });

    if (!isSuperAdmin && !canAccessFeature(countdown.effectivePlanId, "receipts")) {
      return NextResponse.json(
        {
          error:
            "Le stockage de reçus et justificatifs nécessite un abonnement Particulier (1 000 FCFA / mois).",
          code: "PLAN_REQUIRED",
          requiredPlan: "personal",
        },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawTransactionId = formData.get("transactionId");
    const transactionId =
      typeof rawTransactionId === "string" && rawTransactionId.trim()
        ? rawTransactionId.trim().slice(0, 64)
        : `tx_${Date.now()}`;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier reçu dans la requête." },
        { status: 400 }
      );
    }

    // 1. Validation des métadonnées (taille, MIME déclaré, extension, nom)
    const validation = validateReceiptFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 2. Lecture binaire et validation stricte par magic bytes (empêche faux JPEG/PDF contenant HTML/JS)
    const buffer = Buffer.from(await file.arrayBuffer());
    const bufferValidation = validateReceiptBuffer(
      buffer,
      file.type,
      validation.sanitizedName || file.name
    );

    if (!bufferValidation.valid || !bufferValidation.detectedMime) {
      return NextResponse.json(
        { error: bufferValidation.error || "Contenu du fichier invalide." },
        { status: 400 }
      );
    }

    const safeFileName = bufferValidation.sanitizedName || validation.sanitizedName || file.name;
    const uniqueTxToken = `${transactionId}_${crypto.randomUUID().slice(0, 8)}`;
    const storagePath = generateReceiptStoragePath(
      user.id,
      uniqueTxToken,
      safeFileName
    );

    // 3. Upload privé vers Supabase Storage (upsert: false pour éviter tout écrasement)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, buffer, {
        contentType: bufferValidation.detectedMime,
        upsert: false,
      });

    if (!uploadError && uploadData) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("receipts")
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        return NextResponse.json(
          { error: "Justificatif enregistré mais impossible de générer son lien privé." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        url: signedUrlData.signedUrl,
        path: storagePath,
        mimeType: bufferValidation.detectedMime,
        fileName: safeFileName,
        sizeFormatted: formatFileSize(buffer.length),
      });
    }

    // En production, ne jamais masquer une erreur Storage par un fallback base64
    if (process.env.NODE_ENV === "production") {
      console.error("Erreur upload Supabase Storage 'receipts' :", uploadError?.message);
      return NextResponse.json(
        { error: "Impossible d'enregistrer le justificatif sur le stockage sécurisé." },
        { status: 503 }
      );
    }

    // Hors production (dév local si le bucket 'receipts' n'est pas encore provisionné) : data URL avec MIME réel vérifié
    console.warn("Bucket 'receipts' non accessible en dév, fallback data-url vérifié activé.", uploadError?.message);
    const base64Data = buffer.toString("base64");
    const dataUrl = `data:${bufferValidation.detectedMime};base64,${base64Data}`;

    return NextResponse.json({
      success: true,
      url: dataUrl,
      path: storagePath,
      mimeType: bufferValidation.detectedMime,
      fileName: safeFileName,
      sizeFormatted: formatFileSize(buffer.length),
      fallback: true,
    });
  } catch (error) {
    console.error("Erreur upload reçu :", error);
    return NextResponse.json(
      { error: "Erreur interne lors du traitement du justificatif." },
      { status: 500 }
    );
  }
}

