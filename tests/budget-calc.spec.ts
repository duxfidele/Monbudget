import { test, expect } from '@playwright/test';
import { 
  getDailyBudget, 
  getTotalExpenses, 
  getRemainingToLive, 
  getCategoryProgress, 
  formatMoney 
} from '../src/lib/utils/budget-calc';

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
});
