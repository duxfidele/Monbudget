import { test, expect } from "@playwright/test";
import {
  buildFullAccountExport,
  downloadJsonFile,
  FullAccountExport,
} from "../src/lib/utils/account-export";

test.describe("Full Account Export & Data Portability — SaaS Standards", () => {
  test("generates complete account export with accurate metadata and counts", () => {
    const mockCache = {
      currency: "FCFA",
      payDay: 28,
      alertThreshold: 80,
      fullName: "Frère Fidèle",
      months: {
        "2026-09": {
          baseSalary: 500000,
          income: 500000,
          categories: [
            { id: "cat-1", name: "Alimentation", amount: 150000, color: "bg-blue-500" },
          ],
          transactions: [
            {
              id: "tx-1",
              label: "Courses du marché",
              amount: 45000,
              category: "Alimentation",
              date: "2026-09-12",
              type: "expense" as const,
              receiptUrl: "https://monbudget.app/storage/receipts/recu_12.webp",
            },
            {
              id: "tx-2",
              label: "Vente freelance",
              amount: 80000,
              category: "Revenu",
              date: "2026-09-15",
              type: "income" as const,
            },
          ],
        },
      },
      savingsGoals: [
        {
          id: "goal-1",
          name: "Fonds d'Urgence",
          target: 1000000,
          current: 350000,
          color: "bg-emerald-600",
          status: "active" as const,
          contributions: [
            { id: "c-1", amount: 50000, date: "2026-09-28", notes: "Versement mensuel" },
          ],
        },
      ],
      debts: [
        {
          id: "debt-1",
          type: "payable" as const,
          personName: "M. Kossi",
          totalAmount: 150000,
          dueDate: "2026-11-30",
          payments: [
            { id: "p-1", amount: 50000, paymentDate: "2026-10-05" },
          ],
        },
      ],
    };

    const currentMonthData = {
      baseSalary: 600000,
      income: 600000,
      incomeEntries: [],
      categories: [
        { id: "cat-2", name: "Carburant", amount: 60000, color: "bg-amber-500" },
      ],
      transactions: [
        {
          id: "tx-3",
          label: "Plein d'essence",
          amount: 25000,
          category: "Carburant",
          date: "2026-10-02",
          type: "expense" as const,
        },
      ],
    };

    const exportData: FullAccountExport = buildFullAccountExport({
      userId: "usr_fidele_12345",
      userEmail: "fidele@monbudget.app",
      fullName: "Fidèle",
      currency: "FCFA",
      payDay: 28,
      alertThreshold: 80,
      cache: mockCache as any,
      currentMonthKey: "2026-10",
      currentMonthData,
    });

    // 1. Vérification des métadonnées
    expect(exportData.exportMetadata.app).toBe("MonBudget");
    expect(exportData.exportMetadata.version).toBe("2.0");
    expect(exportData.exportMetadata.userEmail).toBe("fidele@monbudget.app");
    expect(exportData.exportMetadata.userId).toBe("usr_fidele_12345");
    expect(exportData.exportMetadata.totalMonthsExported).toBe(2); // 2026-09 et 2026-10
    expect(exportData.exportMetadata.totalTransactionsExported).toBe(3); // 2 en sept + 1 en oct
    expect(exportData.exportMetadata.totalSavingsGoalsExported).toBe(1);
    expect(exportData.exportMetadata.totalDebtsExported).toBe(1);

    // 2. Vérification des profils
    expect(exportData.profile.currency).toBe("FCFA");
    expect(exportData.profile.payDay).toBe(28);
    expect(exportData.profile.alertThreshold).toBe(80);

    // 3. Vérification des mois et transactions
    expect(exportData.months["2026-09"]).toBeDefined();
    expect(exportData.months["2026-09"].transactions[0].receiptUrl).toBe(
      "https://monbudget.app/storage/receipts/recu_12.webp"
    );
    expect(exportData.months["2026-10"]).toBeDefined();
    expect(exportData.months["2026-10"].categories[0].name).toBe("Carburant");

    // 4. Vérification de la fidélité de sérialisation JSON
    const jsonString = JSON.stringify(exportData);
    const parsed = JSON.parse(jsonString);
    expect(parsed.exportMetadata.app).toBe("MonBudget");
    expect(parsed.months["2026-09"].transactions.length).toBe(2);
  });

  test("downloadJsonFile safely returns false in non-browser environment without crashing", () => {
    const result = downloadJsonFile({ test: true });
    expect(result).toBe(false);
  });
});

