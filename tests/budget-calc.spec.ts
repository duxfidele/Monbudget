import { test, expect } from '@playwright/test';
import { 
  getDailyBudget, 
  getTotalExpenses, 
  getRemainingToLive, 
  getCategoryProgress, 
  getEffectiveTotalAllocated,
  formatMoney,
  isIncomeTransaction,
  isExpenseTransaction,
  getTotalAdditionalIncome,
  formatThousands,
  parseThousands,
  getMonthlySavingsContributions,
  getTodayExpenses,
  getTotalPayableDebts,
  getTotalReceivableDebts,
  getDebtAlerts,
  generateFinancialAIAnalysis,
  INCOME_SOURCES,
  AFRICAN_EXPENSE_CATEGORIES,
  SAVINGS_GOAL_TEMPLATES,
} from '../src/lib/utils/budget-calc';
import { deduplicateCategories } from '../src/lib/utils/budget-calc';

test.describe('Budget Calculation Engine (budget-calc)', () => {
  test('calculates daily budget correctly before payday', () => {
    // Current date: 15 Oct 2026, payday: 28 Oct (13 days remaining)
    const result = getDailyBudget({
      remainingAmount: 65000,
      totalIncome: 300000,
      targetPayDay: 28,
      currentDate: new Date('2026-10-15T12:00:00Z'),
    });

    expect(result.daysRemaining).toBe(13);
    expect(result.dailyBudget).toBe(5000);
    expect(result.status).toBe('healthy');
    expect(result.isPayDayToday).toBe(false);
  });

  test('handles payday today', () => {
    const result = getDailyBudget({
      remainingAmount: 10000,
      totalIncome: 300000,
      targetPayDay: 28,
      currentDate: new Date('2026-10-28T12:00:00Z'),
    });

    expect(result.isPayDayToday).toBe(true);
    expect(result.daysRemaining).toBe(1);
    expect(result.dailyBudget).toBe(10000);
  });

  test('detects critical status when overspent', () => {
    const result = getDailyBudget({
      remainingAmount: -5000,
      totalIncome: 300000,
      targetPayDay: 28,
      currentDate: new Date('2026-10-20T12:00:00Z'),
    });

    expect(result.status).toBe('critical');
    expect(result.dailyBudget).toBe(0);
    expect(result.advice).toContain('Attention');
  });

  test('calculates category progress and detects overbudget', () => {
    const normal = getCategoryProgress(40000, 50000);
    expect(normal.percent).toBe(80);
    expect(normal.isOverBudget).toBe(false);
    expect(normal.remaining).toBe(10000);

    const over = getCategoryProgress(55000, 50000);
    expect(over.percent).toBe(110);
    expect(over.isOverBudget).toBe(true);
    expect(over.remaining).toBe(-5000);
  });

  test('formats currencies properly', () => {
    expect(formatMoney(50000, 'FCFA')).toContain('FCFA');
    expect(formatMoney(200, 'EUR')).toContain('€');
    expect(formatMoney(150, 'USD')).toContain('$');
  });
  test("formats thousands and parses numeric values correctly", () => {
    expect(formatThousands(50000)).toBe("50 000");
    expect(formatThousands(1500000)).toBe("1 500 000");
    expect(formatThousands("")).toBe("");
    expect(parseThousands("50 000")).toBe(50000);
    expect(parseThousands("1 500 000")).toBe(1500000);
    expect(parseThousands("")).toBe(0);
  });
  test("strictly separates income transactions from expense transactions", () => {
    const txs = [
      { amount: 50000, type: "income" as const, category: "Prime" },
      { amount: 25000, type: "income_adjustment" as const, category: "Vente" },
      { amount: 15000, type: "expense" as const, category: "Alimentation" },
      { amount: 10000, category: "Transport" }, // untyped -> default expense
    ];

    expect(isIncomeTransaction(txs[0])).toBe(true);
    expect(isIncomeTransaction(txs[1])).toBe(true);
    expect(isIncomeTransaction(txs[2])).toBe(false);

    expect(isExpenseTransaction(txs[2])).toBe(true);
    expect(isExpenseTransaction(txs[3])).toBe(true);
    expect(isExpenseTransaction(txs[0])).toBe(false);

    expect(getTotalAdditionalIncome(txs)).toBe(75000);
    expect(getTotalExpenses(txs)).toBe(25000); // 15000 + 10000, NOT counting the 75000 income!
  });

  test("deduplicates categories and merges duplicates like Déplacement", () => {
    const raw = [
      { id: "1", name: "Déplacement", amount: 0, color: "bg-blue-500" },
      { id: "2", name: "Alimentation", amount: 50000, color: "bg-emerald-500" },
      { id: "3", name: "déplacement", amount: 20000, color: "bg-blue-500" },
      { id: "4", name: " Déplacement ", amount: 0, color: "bg-blue-500" },
    ];

    const result = deduplicateCategories(raw);
    expect(result.length).toBe(2);
    const deplacement = result.find((c) => c.name.toLowerCase() === "déplacement");
    expect(deplacement).toBeDefined();
    expect(deplacement?.amount).toBe(20000);
  });

  test("automatically deducts today expenses from daily budget", () => {
    // Before today: 100 000 FCFA remaining, 10 days remaining -> 10 000 FCFA/day
    // Today spent: 3 000 FCFA
    // Current remaining: 97 000 FCFA
    const result = getDailyBudget({
      remainingAmount: 97000,
      totalIncome: 300000,
      targetPayDay: 28,
      currentDate: new Date("2026-10-18T12:00:00Z"),
      todayExpenses: 3000,
    });

    expect(result.dailyBudget).toBe(10000);
    expect(result.todaySpent).toBe(3000);
    expect(result.todayRemaining).toBe(7000);
    expect(result.isOverDailyBudget).toBe(false);
    expect(result.dailyProgressPercent).toBe(30);
  });

  test("handles overspending on daily budget", () => {
    // Daily target 10 000, today spent 14 000
    const result = getDailyBudget({
      remainingAmount: 86000,
      totalIncome: 300000,
      targetPayDay: 28,
      currentDate: new Date("2026-10-18T12:00:00Z"),
      todayExpenses: 14000,
    });

    expect(result.dailyBudget).toBe(10000);
    expect(result.todaySpent).toBe(14000);
    expect(result.todayRemaining).toBe(-4000);
    expect(result.isOverDailyBudget).toBe(true);
    expect(result.advice).toContain("dépassé");
  });

  test("calculates monthly savings contributions only for active month", () => {
    const goals = [
      {
        contributions: [
          { amount: 50000, date: "2026-10-05" },
          { amount: 30000, date: "2026-10-12" },
          { amount: 20000, date: "2026-09-20" }, // Different month!
        ],
      },
    ];

    expect(getMonthlySavingsContributions(goals, 2026, 10)).toBe(80000);
    expect(getMonthlySavingsContributions(goals, 2026, 9)).toBe(20000);
    expect(getMonthlySavingsContributions(goals, 2026, 11)).toBe(0);
  });

  test("calculates payable and receivable debts and alerts accurately", () => {
    const debts = [
      {
        id: "d1",
        personName: "Oncle Koffi",
        type: "payable" as const,
        totalAmount: 100000,
        remainingAmount: 40000,
        dueDate: "2026-10-10",
        status: "partial" as const,
        payments: [],
      },
      {
        id: "d2",
        personName: "Client Yao",
        type: "receivable" as const,
        totalAmount: 50000,
        remainingAmount: 50000,
        dueDate: "2026-10-17",
        status: "pending" as const,
        payments: [],
      },
      {
        id: "d3",
        personName: "Soldé",
        type: "payable" as const,
        totalAmount: 25000,
        remainingAmount: 0,
        dueDate: "2026-10-01",
        status: "paid" as const,
        payments: [],
      },
    ];

    expect(getTotalPayableDebts(debts)).toBe(40000);
    expect(getTotalReceivableDebts(debts)).toBe(50000);

    const alerts = getDebtAlerts(debts, new Date("2026-10-15T12:00:00Z"));
    expect(alerts.length).toBe(2);
    expect(alerts[0].urgency).toBe("overdue");
    expect(alerts[0].debt.personName).toBe("Oncle Koffi");
    expect(alerts[1].urgency).toBe("soon");
    expect(alerts[1].debt.personName).toBe("Client Yao");
  });

  test("generates Financial AI analysis and recommendations for African context", () => {
    expect(INCOME_SOURCES.length).toBe(6);
    expect(AFRICAN_EXPENSE_CATEGORIES.length).toBe(11);
    expect(SAVINGS_GOAL_TEMPLATES.length).toBe(5);

    const analysis = generateFinancialAIAnalysis({
      income: 300000,
      incomeSourcesCount: 1,
      transactions: [
        { amount: 90000, category: "Loyer", type: "expense" },
        { amount: 60000, category: "Alimentation", type: "expense" },
        { amount: 45000, category: "Famille et solidarité", type: "expense" },
        { amount: 30000, category: "Dîmes et offrandes", type: "expense" },
      ],
      categories: [
        { name: "Loyer", amount: 90000 },
        { name: "Alimentation", amount: 60000 },
        { name: "Famille et solidarité", amount: 30000 },
        { name: "Dîmes et offrandes", amount: 30000 },
      ],
      savingsGoals: [
        {
          name: "Acheter une moto",
          target: 600000,
          current: 50000,
        },
      ],
      debts: [],
      monthlySavings: 35000,
      currency: "FCFA",
    });

    expect(analysis.healthScore).toBeGreaterThan(0);
    expect(analysis.breakdown.solidarityAndTithePercent).toBe(25); // (45k+30k)/300k = 25%
    expect(analysis.recommendations.length).toBeGreaterThan(0);
  });

  test("accounts for unbudgeted savings and expenses so Reste à allouer matches Solde restant", () => {
    const income = 300000;
    // User did NOT budget Épargne (0 FCFA) and budgeted 100 000 FCFA for Alimentation
    const categories = [
      { name: "Alimentation", amount: 0 },
    ];
    const transactions = [
      { amount: 40000, category: "Alimentation", type: "expense" as const },
      { amount: 50000, category: "Épargne", type: "expense" as const },
    ];
    const monthlySavings = 50000;

    const depenses = getTotalExpenses(transactions, monthlySavings); // 90 000 (40 000 regular + 50 000 savings)
    const soldeRestant = getRemainingToLive(income, depenses); // 300 000 - 90 000 = 210 000
    const effectiveAllocated = getEffectiveTotalAllocated(categories, transactions, monthlySavings); // 40 000 + 50 000 = 90 000
    const resteAAllouer = income - effectiveAllocated; // 300 000 - 90 000 = 210 000

    expect(depenses).toBe(90000);
    expect(soldeRestant).toBe(210000);
    expect(resteAAllouer).toBe(soldeRestant);
  });

  test("considers savings as expenses and deducts it directly from available balance without double counting", () => {
    const income = 500000;
    const transactions = [
      { amount: 120000, category: "Loyer", type: "expense" as const },
      { amount: 80000, category: "Alimentation", type: "expense" as const },
      { amount: 50000, category: "Épargne", type: "expense" as const },
    ];
    const monthlySavingsFromGoals = 50000; // linked to goal

    const totalExpenses = getTotalExpenses(transactions, monthlySavingsFromGoals);
    // 120 000 + 80 000 + max(50 000, 50 000) = 250 000
    expect(totalExpenses).toBe(250000);

    const availableBalance = getRemainingToLive(income, totalExpenses);
    // 500 000 - 250 000 = 250 000
    expect(availableBalance).toBe(250000);

    // If no savings transaction in array yet, but monthlySavings = 75 000
    const txWithoutSavings = [
      { amount: 120000, category: "Loyer", type: "expense" as const },
      { amount: 80000, category: "Alimentation", type: "expense" as const },
    ];
    const totalWithOnlyGoalSavings = getTotalExpenses(txWithoutSavings, 75000);
    expect(totalWithOnlyGoalSavings).toBe(275000);
    expect(getRemainingToLive(income, totalWithOnlyGoalSavings)).toBe(225000);
  });

  test("AI advisor detects early-month cash burn, unplanned expenses and heavy savings", () => {
    const analysis = generateFinancialAIAnalysis({
      income: 553000,
      incomeSourcesCount: 2,
      categories: [
        { name: "Loisirs", amount: 45000 },
        { name: "Santé", amount: 25000 },
        { name: "Besoin enfants", amount: 15000 },
        { name: "Remboursement de dette", amount: 25000 },
      ],
      transactions: [
        { amount: 55000, category: "Loisirs", type: "expense" },
        { amount: 45000, category: "Remboursement de dette", type: "expense" },
        { amount: 135000, category: "Alimentation", type: "expense" },
        { amount: 225000, category: "Épargne", type: "expense" },
      ],
      savingsGoals: [{ name: "Constituer un fonds d'urgence", target: 1000000, current: 225000 }],
      debts: [],
      monthlySavings: 225000,
      currency: "FCFA",
      currentDate: new Date("2026-11-04T12:00:00Z"),
      payDay: 28,
    });

    expect(analysis.temporal.dayOfMonth).toBe(4);
    expect(analysis.temporal.burnRateStatus).toBe("critical");
    expect(analysis.findings.some((f) => f.id === "finding-burn-rate")).toBe(true);
    expect(analysis.findings.some((f) => f.id === "finding-unplanned-expenses")).toBe(true);
    expect(analysis.findings.some((f) => f.id === "finding-heavy-early-savings")).toBe(true);
    expect(analysis.recommendations.some((r) => r.correctiveActionType === "align_overbudget")).toBe(true);
    expect(analysis.temporal.dailySurvivalQuota).toBeGreaterThan(0);
  });
});
