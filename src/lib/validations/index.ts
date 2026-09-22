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
