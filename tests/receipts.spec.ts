import { test, expect } from "@playwright/test";
import {
  validateReceiptFile,
  validateReceiptBuffer,
  detectMagicBytesMimeType,
  sanitizeFilename,
  generateReceiptStoragePath,
  formatFileSize,
  MAX_RECEIPT_SIZE_BYTES,
} from "../src/lib/utils/receipt-storage";
import { Transaction } from "../src/lib/store/ui-store";

test.describe("Receipt Storage & Justificatifs — SaaS Production Standards", () => {
  test("validates authorized receipt file formats (JPEG, PNG, WebP, PDF)", () => {
    // Cas A : Formats valides
    const jpegRes = validateReceiptFile({
      name: "ticket_caisse.jpeg",
      size: 500 * 1024,
      type: "image/jpeg",
    });
    expect(jpegRes.valid).toBe(true);
    expect(jpegRes.sanitizedName).toBe("ticket_caisse.jpeg");

    const pngRes = validateReceiptFile({
      name: "facture_cie.png",
      size: 1.2 * 1024 * 1024,
      type: "image/png",
    });
    expect(pngRes.valid).toBe(true);

    const webpRes = validateReceiptFile({
      name: "recu_carburant.webp",
      size: 200 * 1024,
      type: "image/webp",
    });
    expect(webpRes.valid).toBe(true);

    const pdfRes = validateReceiptFile({
      name: "quittance_loyer.pdf",
      size: 2.5 * 1024 * 1024,
      type: "application/pdf",
    });
    expect(pdfRes.valid).toBe(true);
  });

  test("rejects unauthorized file types and dangerous extensions", () => {
    // Cas A : Exécutable dangereux
    const exeRes = validateReceiptFile({
      name: "virus.exe",
      size: 100 * 1024,
      type: "application/x-msdownload",
    });
    expect(exeRes.valid).toBe(false);
    expect(exeRes.error).toContain("Format de fichier non autorisé");

    // Cas B : Script HTML / JS injecté
    const htmlRes = validateReceiptFile({
      name: "evil.html",
      size: 50 * 1024,
      type: "text/html",
    });
    expect(htmlRes.valid).toBe(false);

    // Cas C : Fichier vide (taille 0)
    const emptyRes = validateReceiptFile({
      name: "vide.jpg",
      size: 0,
      type: "image/jpeg",
    });
    expect(emptyRes.valid).toBe(false);
    expect(emptyRes.error).toContain("Le fichier sélectionné est vide");
  });

  test("strictly enforces 5 Mo maximum file size limit", () => {
    // Cas A : Fichier sous la limite (4.9 Mo)
    const okRes = validateReceiptFile({
      name: "gros_recu.jpg",
      size: 4.9 * 1024 * 1024,
      type: "image/jpeg",
    });
    expect(okRes.valid).toBe(true);

    // Cas B : Fichier dépassant la limite (5.1 Mo)
    const tooLargeRes = validateReceiptFile({
      name: "recu_trop_lourd.jpg",
      size: 5.1 * 1024 * 1024,
      type: "image/jpeg",
    });
    expect(tooLargeRes.valid).toBe(false);
    expect(tooLargeRes.error).toContain("dépasse le maximum autorisé de 5 Mo");
  });

  test("sanitizes filenames and blocks path traversal attempts", () => {
    // Cas A : Path traversal relatif
    const traversal = sanitizeFilename("../../etc/passwd");
    expect(traversal).toBe("passwd");
    expect(traversal).not.toContain("..");
    expect(traversal).not.toContain("/");

    // Cas B : Traversal Windows
    const winTraversal = sanitizeFilename("..\\..\\Windows\\System32\\cmd.exe");
    expect(winTraversal).toBe("cmd.exe");

    // Cas C : Caractères spéciaux et accents
    const specialChars = sanitizeFilename("Reçu & Facture #1 (Supermarché)!.jpg");
    expect(specialChars).toBe("Recu_Facture_1_Supermarche_.jpg");
  });

  test("generates partitioned and user-isolated storage paths", () => {
    const userId = "usr_fidele_890123";
    const txId = "tx_octobre_456";
    const filename = "ticket_restaurant.jpg";

    const path = generateReceiptStoragePath(userId, txId, filename, 2026, 11);

    expect(path).toContain("usr_fidele_890123/2026-11/");
    expect(path).toContain("tx_octobre_456_");
    expect(path).toContain("ticket_restaurant.jpg");
    // Ne contient aucun double slash
    expect(path).not.toContain("//");
  });

  test("formats file sizes cleanly for users", () => {
    expect(formatFileSize(500)).toBe("500 o");
    expect(formatFileSize(2048)).toBe("2 Ko");
    expect(formatFileSize(512 * 1024)).toBe("512 Ko");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 Mo");
  });

  test("transaction type correctly persists receipt metadata", () => {
    const transaction: Transaction = {
      id: "tx-test-receipt-1",
      label: "Courses Supermarché Champion",
      amount: 45000,
      category: "Alimentation",
      date: "2026-11-06",
      type: "expense",
      receiptUrl: "https://monbudget.app/storage/receipts/user123/ticket_45000.webp",
      receiptName: "ticket_supermarche.webp",
    };

    expect(transaction.receiptUrl).toBeDefined();
    expect(transaction.receiptUrl).toContain("ticket_45000.webp");
    expect(transaction.receiptName).toBe("ticket_supermarche.webp");
  });

  test("verifies magic bytes signatures and rejects spoofed or mismatched files", () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const fakeHtmlBytes = new TextEncoder().encode("<script>alert('xss')</script>");

    expect(detectMagicBytesMimeType(jpegBytes)).toBe("image/jpeg");
    expect(detectMagicBytesMimeType(pngBytes)).toBe("image/png");
    expect(detectMagicBytesMimeType(webpBytes)).toBe("image/webp");
    expect(detectMagicBytesMimeType(pdfBytes)).toBe("application/pdf");
    expect(detectMagicBytesMimeType(fakeHtmlBytes)).toBeNull();

    // Fichier réel valide -> accepté
    expect(validateReceiptBuffer(jpegBytes, "image/jpeg", "recu.jpg").valid).toBe(true);
    expect(validateReceiptBuffer(pdfBytes, "application/pdf", "facture.pdf").valid).toBe(true);

    // Faux JPEG contenant du JS -> rejeté
    const spoofedRes = validateReceiptBuffer(fakeHtmlBytes, "image/jpeg", "fake.jpg");
    expect(spoofedRes.valid).toBe(false);

    // Incohérence MIME déclaré vs octets réels -> rejeté
    const mimeMismatchRes = validateReceiptBuffer(pngBytes, "image/jpeg", "image.png");
    expect(mimeMismatchRes.valid).toBe(false);

    // Incohérence extension vs octets réels -> rejeté
    const extMismatchRes = validateReceiptBuffer(pngBytes, "image/png", "malware.pdf");
    expect(extMismatchRes.valid).toBe(false);

    // Extension dangereuse même avec MIME image/jpeg déclaré -> rejeté
    expect(
      validateReceiptFile({ name: "evil.html", size: 1024, type: "image/jpeg" }).valid
    ).toBe(false);
  });
});

