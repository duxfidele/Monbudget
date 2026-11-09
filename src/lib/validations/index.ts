import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(50),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const budgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  notes: z.string().optional(),
});

export const incomeSchema = z.object({
  label: z.string().min(1, "Le label est requis").max(100),
  amount: z.number().positive("Le montant doit être positif"),
  received_date: z.string().datetime().optional(),
});

export const allocationSchema = z.object({
  category_id: z.string().uuid(),
  allocated_amount: z.number().min(0, "Le montant alloué ne peut pas être négatif"),
  notes: z.string().optional(),
});

export const transactionSchema = z.object({
  category_id: z.string().uuid().optional(),
  amount: z.number().positive("Le montant doit être positif"),
  description: z.string().optional(),
  transaction_date: z.string().datetime(),
  type: z.enum(["expense", "income_adjustment"]).default("expense"),
});

export const savingsGoalSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
  target_amount: z.number().positive("Le montant cible doit être positif"),
  target_date: z.string().datetime().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const savingsContributionSchema = z.object({
  amount: z.number().positive("La contribution doit être positive"),
  contribution_date: z.string().datetime(),
  notes: z.string().optional(),
});

// --- Schémas API Serveur (Moneriz, Admin, Support & Anti-Spam) ---

export const checkoutRequestSchema = z
  .object({
    orderId: z.string().uuid("Identifiant de commande UUID invalide.").optional(),
    planId: z.enum(["personal", "business"]).optional(),
    billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
    integrationMode: z.enum(["iframe", "redirect"]).optional(),
    testUserId: z.string().min(1).max(120).optional(),
  })
  .refine((data) => Boolean(data.orderId || data.planId), {
    message: "Veuillez spécifier un planId valide ou un orderId existant.",
  });

export const checkoutStatusQuerySchema = z.object({
  orderId: z.string().uuid("Identifiant de commande UUID invalide.").optional(),
  paymentId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,128}$/, "Identifiant de paiement invalide.")
    .optional(),
  testUserId: z.string().min(1).max(120).optional(),
});

export const adminSetSubscriptionSchema = z.object({
  targetUserId: z.string().uuid("Identifiant utilisateur UUID invalide."),
  planId: z.enum(["free", "personal", "business"]),
  billingCycle: z.enum(["none", "monthly", "yearly"]).default("monthly"),
});

export const supportRequestSchema = z.object({
  name: z.string().trim().min(2, "Veuillez renseigner votre nom complet.").max(120),
  email: z.string().trim().email("Veuillez renseigner une adresse email valide.").max(254),
  topic: z.string().trim().max(160).optional(),
  message: z.string().trim().min(5, "Veuillez écrire un message d'au moins 5 caractères.").max(4000),
  honeypot: z.string().max(500).optional().nullable(),
  formLoadedAt: z.number().finite().optional().nullable(),
  formElapsedMs: z.number().finite().optional().nullable(),
  turnstileToken: z.string().max(2048).optional().nullable(),
});

export const authAntiSpamRequestSchema = z.object({
  action: z.enum(["register", "login", "forgot-password"]),
  email: z.string().trim().max(254).optional(),
  honeypot: z.string().max(500).optional().nullable(),
  formLoadedAt: z.number().finite().optional().nullable(),
  formElapsedMs: z.number().finite().optional().nullable(),
  turnstileToken: z.string().max(2048).optional().nullable(),
});
