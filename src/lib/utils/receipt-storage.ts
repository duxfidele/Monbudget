/**
 * Utilitaires pour la gestion, la validation et la compression des reçus et justificatifs
 * MonBudget — Architecture SaaS Sécurisée & Résiliente
 */

export const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

export const ALLOWED_RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type AllowedReceiptMimeType = typeof ALLOWED_RECEIPT_MIME_TYPES[number];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedName?: string;
}

export interface BufferValidationResult extends FileValidationResult {
  detectedMime?: AllowedReceiptMimeType;
}

const EXTENSION_BY_MIME: Record<AllowedReceiptMimeType, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

function normalizeDeclaredMime(mime: string | undefined | null): string {
  const lower = (mime || "").trim().toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  return lower;
}

function getLowerExtension(filename: string): string | null {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === filename.length - 1) return null;
  return filename.slice(dotIdx).toLowerCase();
}

/**
 * Inspecte les octets magiques (magic bytes) d'un buffer pour identifier le format réel,
 * indépendamment de l'extension ou de l'en-tête Content-Type déclaré par le client.
 */
export function detectMagicBytesMimeType(bytes: Uint8Array): AllowedReceiptMimeType | null {
  if (!bytes || bytes.length < 4) return null;

  // JPEG : FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP : RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  // PDF : %PDF-
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }

  return null;
}

/**
 * Valide le contenu binaire réel d'un justificatif côté serveur (magic bytes + taille + extension).
 */
export function validateReceiptBuffer(
  bytes: Uint8Array,
  declaredMime: string,
  filename: string
): BufferValidationResult {
  if (!bytes || bytes.length <= 0) {
    return { valid: false, error: "Le fichier reçu est vide." };
  }

  if (bytes.length > MAX_RECEIPT_SIZE_BYTES) {
    return {
      valid: false,
      error: `La taille du fichier (${formatFileSize(bytes.length)}) dépasse le maximum autorisé de 5 Mo.`,
    };
  }

  const detectedMime = detectMagicBytesMimeType(bytes);
  if (!detectedMime) {
    return {
      valid: false,
      error: "Signature de fichier invalide ou dangereuse. Formats réels acceptés : JPEG, PNG, WebP, PDF.",
    };
  }

  const normalizedDeclared = normalizeDeclaredMime(declaredMime);
  if (normalizedDeclared && normalizedDeclared !== detectedMime) {
    return {
      valid: false,
      error: "Incohérence détectée entre le type déclaré et le contenu réel du fichier.",
    };
  }

  const cleanName = sanitizeFilename(filename);
  const ext = getLowerExtension(cleanName);
  if (ext && !EXTENSION_BY_MIME[detectedMime].includes(ext)) {
    return {
      valid: false,
      error: "L'extension du fichier ne correspond pas au contenu réel du justificatif.",
    };
  }

  return {
    valid: true,
    detectedMime,
    sanitizedName: cleanName,
  };
}

/**
 * Valide le type MIME, la taille et le nom d'un justificatif
 */
export function validateReceiptFile(file: {
  size: number;
  type: string;
  name: string;
}): FileValidationResult {
  if (!file) {
    return { valid: false, error: "Aucun fichier fourni." };
  }

  // 1. Vérification de la taille
  if (file.size <= 0) {
    return { valid: false, error: "Le fichier sélectionné est vide." };
  }

  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    return {
      valid: false,
      error: `La taille du fichier (${formatFileSize(file.size)}) dépasse le maximum autorisé de 5 Mo.`,
    };
  }

  // 2. Vérification du type MIME
  const normalizedMime = normalizeDeclaredMime(file.type);
  const isAllowedMime = (ALLOWED_RECEIPT_MIME_TYPES as readonly string[]).includes(
    normalizedMime
  );
  if (!isAllowedMime) {
    return {
      valid: false,
      error: "Format de fichier non autorisé. Formats acceptés : JPEG, PNG, WebP, PDF.",
    };
  }

  // 3. Assainissement du nom de fichier (protection contre les injections et path traversal)
  const cleanName = sanitizeFilename(file.name);
  if (!cleanName) {
    return { valid: false, error: "Nom de fichier invalide." };
  }

  const ext = getLowerExtension(cleanName);
  const typedMime = normalizedMime as AllowedReceiptMimeType;
  if (ext && !EXTENSION_BY_MIME[typedMime].includes(ext)) {
    return {
      valid: false,
      error: "Format de fichier non autorisé : l'extension ne correspond pas au type MIME déclaré.",
    };
  }

  return { valid: true, sanitizedName: cleanName };
}

/**
 * Assainit un nom de fichier pour éviter toute tentative de path traversal ou caractères dangereux
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return "recu";

  // Retirer les composants de chemin relatifs (.. ou / ou \)
  const baseName = filename.replace(/^.*[\\/]/, "");

  // Remplacer les caractères non autorisés par des tirets
  const cleaned = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");

  return cleaned.substring(0, 100);
}

/**
 * Génère un chemin de stockage partitionné par utilisateur pour isoler les justificatifs
 * Structure : {userId}/{year}-{month}/{transactionId}_{timestamp}_{filename}
 */
export function generateReceiptStoragePath(
  userId: string,
  transactionId: string,
  filename: string,
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1
): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeTxId = transactionId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeFilename = sanitizeFilename(filename);
  const formattedMonth = String(month).padStart(2, "0");
  const timestamp = Date.now();

  return `${safeUserId}/${year}-${formattedMonth}/${safeTxId}_${timestamp}_${safeFilename}`;
}

/**
 * Formate un nombre d'octets en unité lisible (Ko, Mo)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Compresse une image de reçu côté client avant envoi
 * Réduit les photos de smartphone (~5 Mo) à ~150-300 Ko pour préserver la data mobile en Afrique
 */
export async function compressReceiptImage(
  file: File,
  maxWidth = 1400,
  maxHeight = 1400,
  quality = 0.75
): Promise<{
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  blob?: Blob;
}> {
  const originalSize = file.size;

  // Si c'est un PDF, pas de compression canvas
  if (file.type === "application/pdf") {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      dataUrl,
      originalSize,
      compressedSize: originalSize,
      savingsPercent: 0,
    };
  }

  // Vérifier si nous sommes dans un environnement navigateur avec Canvas disponible
  if (typeof window === "undefined" || typeof document === "undefined") {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      dataUrl,
      originalSize,
      compressedSize: originalSize,
      savingsPercent: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcul des nouvelles dimensions avec conservation du ratio
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve({
            dataUrl: e.target?.result as string,
            originalSize,
            compressedSize: originalSize,
            savingsPercent: 0,
          });
        }

        // Dessiner l'image redimensionnée
        ctx.drawImage(img, 0, 0, width, height);

        // Export en format WebP (ou JPEG si non supporté)
        const outputMime = "image/webp";
        const dataUrl = canvas.toDataURL(outputMime, quality);

        canvas.toBlob(
          (blob) => {
            const compressedSize = blob ? blob.size : Math.round(dataUrl.length * 0.75);
            const savingsPercent = Math.max(
              0,
              Math.round(((originalSize - compressedSize) / originalSize) * 100)
            );

            resolve({
              dataUrl,
              originalSize,
              compressedSize,
              savingsPercent,
              blob: blob || undefined,
            });
          },
          outputMime,
          quality
        );
      };

      img.onerror = () => reject(new Error("Impossible de décoder l'image."));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
