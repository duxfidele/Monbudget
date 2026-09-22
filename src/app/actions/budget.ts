"use server";

import { revalidatePath } from "next/cache";
import { budgetSchema, incomeSchema, allocationSchema } from "@/lib/validations";

export async function createBudget(data: unknown) {
  const parsed = budgetSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Données invalides", details: parsed.error.format() };
  }
  
  // TODO: Insert into Supabase
  // const supabase = createServerActionClient();
  // const { data, error } = await supabase.from("monthly_budgets").insert(parsed.data);

  revalidatePath("/budget");
  return { success: true };
}

export async function addIncome(budgetId: string, data: unknown) {
  const parsed = incomeSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Données invalides", details: parsed.error.format() };
  }

  // TODO: Insert into Supabase
  
  revalidatePath("/budget");
  return { success: true };
}

export async function updateAllocation(budgetId: string, data: unknown) {
  const parsed = allocationSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Données invalides", details: parsed.error.format() };
  }

  // TODO: Upsert into Supabase
  
  revalidatePath("/budget");
  return { success: true };
}
