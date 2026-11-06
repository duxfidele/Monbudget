import { test, expect } from "@playwright/test";

// Helpers pour tester la logique de validation et génération de lien Support
function validateSupportTicket(data: { name?: any; email?: any; message?: any }) {
  const { name, email, message } = data;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return { valid: false, error: "Veuillez renseigner votre nom complet." };
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return { valid: false, error: "Veuillez renseigner une adresse email valide." };
  }

  if (!message || typeof message !== "string" || message.trim().length < 5) {
    return { valid: false, error: "Veuillez écrire un message d'au moins 5 caractères." };
  }

  return { valid: true, error: null };
}

function generateWhatsAppSupportUrl(phoneNumber: string, params: { name: string; topic: string; message: string }) {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
  const text = `Bonjour l'équipe MonBudget,\n\nJe suis ${params.name.trim()}.\nSujet : ${params.topic.trim()}\n\nMessage : ${params.message.trim()}`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

test.describe("Support & Customer Assistance — Validation & WhatsApp Link", () => {
  test("rejects invalid or too short user names", () => {
    expect(validateSupportTicket({ name: "", email: "user@monbudget.app", message: "Bonjour" }).valid).toBe(false);
    expect(validateSupportTicket({ name: "A", email: "user@monbudget.app", message: "Bonjour" }).valid).toBe(false);
    expect(validateSupportTicket({ name: "   ", email: "user@monbudget.app", message: "Bonjour" }).valid).toBe(false);
    expect(validateSupportTicket({ name: "Fidèle", email: "user@monbudget.app", message: "Bonjour" }).valid).toBe(true);
  });

  test("rejects invalid email formats", () => {
    expect(validateSupportTicket({ name: "Fidèle", email: "invalid-email", message: "Bonjour" }).valid).toBe(false);
    expect(validateSupportTicket({ name: "Fidèle", email: "", message: "Bonjour" }).valid).toBe(false);
    expect(validateSupportTicket({ name: "Fidèle", email: "fidele@monbudget.app", message: "Bonjour" }).valid).toBe(true);
  });

  test("rejects message with less than 5 characters", () => {
    expect(validateSupportTicket({ name: "Fidèle", email: "fidele@monbudget.app", message: "Hi" }).valid).toBe(false);
    expect(validateSupportTicket({ name: "Fidèle", email: "fidele@monbudget.app", message: "    " }).valid).toBe(false);
    expect(validateSupportTicket({ name: "Fidèle", email: "fidele@monbudget.app", message: "Besoin d'aide avec mes plafonds" }).valid).toBe(true);
  });

  test("generates properly formatted and encoded WhatsApp support URL", () => {
    const url = generateWhatsAppSupportUrl("22898376101", {
      name: "Frère Fidèle",
      topic: "Question sur le budget",
      message: "Comment réajuster mes enveloppes de dépenses ?",
    });

    expect(url).toContain("https://wa.me/22898376101?text=");
    expect(url).toContain(encodeURIComponent("Frère Fidèle"));
    expect(url).toContain(encodeURIComponent("Question sur le budget"));
    expect(url).toContain(encodeURIComponent("Comment réajuster mes enveloppes de dépenses ?"));
  });

  test("strips non-digits from WhatsApp phone number", () => {
    const url = generateWhatsAppSupportUrl("+228 98 37 61 01", {
      name: "Jean",
      topic: "Bug",
      message: "Problème d'affichage",
    });

    expect(url.startsWith("https://wa.me/22898376101?text=")).toBe(true);
  });
});
