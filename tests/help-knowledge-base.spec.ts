import { test, expect } from '@playwright/test';
import { 
  searchKnowledgeBase, 
  normalizeText, 
  KNOWLEDGE_BASE, 
  HELP_CATEGORIES 
} from '../src/lib/support/help-knowledge-base';

test.describe('Knowledge Base & Local NLP Search Engine', () => {
  test('has rich categories and complete knowledge base articles', () => {
    expect(HELP_CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(KNOWLEDGE_BASE.length).toBeGreaterThanOrEqual(8);
  });

  test('normalizes text removing accents and special characters', () => {
    expect(normalizeText("Épargne & Crédit")).toBe("epargne credit");
    expect(normalizeText("Dépenses / Catégories !?")).toBe("depenses categories");
    expect(normalizeText("Budget Base Zéro")).toBe("budget base zero");
  });

  test('finds budget base zero answers accurately', () => {
    const results = searchKnowledgeBase("budget base zero");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].article.id).toBe("budget-base-zero");
  });

  test('finds mobile money and payment subscription answers', () => {
    const results = searchKnowledgeBase("comment payer par tmoney ou moov ?");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].article.category).toBe("subscriptions");
    expect(results[0].article.content).toContain("FedaPay");
  });

  test('finds offline and PWA answers without accents', () => {
    const results = searchKnowledgeBase("est ce que ca marche hors ligne sans internet");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].article.id).toBe("offline-pwa");
  });

  test('finds debts and receivables questions', () => {
    const results = searchKnowledgeBase("qui me doit de l argent dettes creances");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].article.category).toBe("debts");
  });

  test('returns empty array when query is empty or nonsense', () => {
    const emptyResults = searchKnowledgeBase("");
    expect(emptyResults).toEqual([]);
    const nonsenseResults = searchKnowledgeBase("xyz999000zz");
    expect(nonsenseResults).toEqual([]);
  });
});

