import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  validateReceiptFile,
  generateReceiptStoragePath,
  formatFileSize,
} from "@/lib/utils/receipt-storage";

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const transactionId = (formData.get("transactionId") as string) || `tx_${Date.now()}`;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier reçu dans la requête." },
        { status: 400 }
      );
    }

    // Validation du fichier
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

    const storagePath = generateReceiptStoragePath(
      user.id,
      transactionId,
      validation.sanitizedName || file.name
    );

    const buffer = Buffer.from(await file.arrayBuffer());

    // Tentative d'upload vers Supabase Storage dans le bucket "receipts"
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from("receipts")
          .getPublicUrl(storagePath);

        return NextResponse.json({
          success: true,
          url: publicUrlData.publicUrl,
          path: storagePath,
          fileName: validation.sanitizedName || file.name,
          sizeFormatted: formatFileSize(file.size),
        });
      }
    } catch (storageErr) {
      console.warn("Supabase Storage bucket 'receipts' non accessible, fallback data-url activé.", storageErr);
    }

    // Mode Fallback Gracieux : Si le bucket Supabase n'est pas encore créé,
    // on renvoie un data URL pour que l'utilisateur puisse immédiatement visualiser son reçu sans bloquer l'application
    const base64Data = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64Data}`;

    return NextResponse.json({
      success: true,
      url: dataUrl,
      path: storagePath,
      fileName: validation.sanitizedName || file.name,
      sizeFormatted: formatFileSize(file.size),
      fallback: true,
    });
  } catch (error: any) {
    console.error("Erreur upload reçu :", error);
    return NextResponse.json(
      { error: error.message || "Erreur interne lors du traitement du justificatif." },
      { status: 500 }
    );
  }
}
