import { test, expect } from '@playwright/test';
import { 
  getDailyBudget, 
  getTotalExpenses, 
  getRemainingToLive, 
  getCategoryProgress, 
  formatMoney,
  isIncomeTransaction,
  isExpenseTransaction,
  getTotalAdditionalIncome,
  formatThousands,
  parseThousands
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
});
