/**
 * Utilitaire d'export intégral des données du compte utilisateur
 * MonBudget — Architecture SaaS & Portabilité des Données (RGPD)
 */

import { LocalCache, MonthData, SavingsGoal, NotificationSettings } from "@/lib/store/ui-store";
import { DebtItem } from "@/lib/utils/budget-calc";

export interface AccountExportMetadata {
  app: "MonBudget";
  version: "2.0";
  exportedAt: string;
  userId?: string;
  userEmail?: string;
  totalMonthsExported: number;
  totalTransactionsExported: number;
  totalSavingsGoalsExported: number;
  totalDebtsExported: number;
}

export interface FullAccountExport {
  exportMetadata: AccountExportMetadata;
  profile: {
    fullName?: string;
    email?: string;
    currency: string;
    payDay: number;
    alertThreshold: number;
    notifications?: NotificationSettings;
  };
  months: Record<string, MonthData>;
  savingsGoals: SavingsGoal[];
  debts: DebtItem[];
}

export interface BuildExportParams {
  userId?: string;
  userEmail?: string;
  currency?: string;
  payDay?: number;
  alertThreshold?: number;
  fullName?: string;
  notifications?: NotificationSettings;
  cache?: LocalCache | null;
  currentMonthKey?: string;
  currentMonthData?: MonthData;
  savingsGoals?: SavingsGoal[];
  debts?: DebtItem[];
}

/**
 * Construit un objet consolidé contenant 100% des données du compte
 */
export function buildFullAccountExport(params: BuildExportParams): FullAccountExport {
  const now = new Date().toISOString();

  // 1. Récupération et fusion de tous les mois budgétisés
  const consolidatedMonths: Record<string, MonthData> = {};

  if (params.cache?.months) {
    Object.assign(consolidatedMonths, params.cache.months);
  }

  // Si le mois actif actuel contient des données non encore écrites en cache
  if (params.currentMonthKey && params.currentMonthData) {
    consolidatedMonths[params.currentMonthKey] = {
      baseSalary: params.currentMonthData.baseSalary || 0,
      income: params.currentMonthData.income || 0,
      incomeEntries: params.currentMonthData.incomeEntries || [],
      categories: params.currentMonthData.categories || [],
      transactions: params.currentMonthData.transactions || [],
    };
  }

  // 2. Récupération des objectifs d'épargne et dettes
  const savingsGoals = params.savingsGoals || params.cache?.savingsGoals || [];
  const debts = params.debts || params.cache?.debts || [];

  // 3. Calcul des totaux d'enregistrements exportés
  let totalTransactions = 0;
  for (const monthKey of Object.keys(consolidatedMonths)) {
    const month = consolidatedMonths[monthKey];
    if (month.transactions) {
      totalTransactions += month.transactions.length;
    }
  }

  const exportMetadata: AccountExportMetadata = {
    app: "MonBudget",
    version: "2.0",
    exportedAt: now,
    userId: params.userId,
    userEmail: params.userEmail,
    totalMonthsExported: Object.keys(consolidatedMonths).length,
    totalTransactionsExported: totalTransactions,
    totalSavingsGoalsExported: savingsGoals.length,
    totalDebtsExported: debts.length,
  };

  return {
    exportMetadata,
    profile: {
      fullName: params.fullName || params.cache?.fullName || "Membre MonBudget",
      email: params.userEmail,
      currency: params.currency || params.cache?.currency || "FCFA",
      payDay: params.payDay ?? params.cache?.payDay ?? 28,
      alertThreshold: params.alertThreshold ?? params.cache?.alertThreshold ?? 80,
      notifications: params.notifications || params.cache?.notifications,
    },
    months: consolidatedMonths,
    savingsGoals,
    debts,
  };
}

/**
 * Déclenche le téléchargement du fichier JSON dans le navigateur
 */
export function downloadJsonFile(data: unknown, filename?: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  try {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const actualFilename =
      filename || `MonBudget_Export_Complet_${new Date().toISOString().split("T")[0]}.json`;

    const link = document.createElement("a");
    link.href = url;
    link.download = actualFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Nettoyage de l'URL objet après un court délai
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error("Erreur lors de la génération du téléchargement JSON :", err);
    return false;
  }
}
