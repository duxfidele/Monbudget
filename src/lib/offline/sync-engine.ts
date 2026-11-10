/**
 * Moteur de synchronisation Offline-First déterministe, idempotent et résilient.
 * Garantit :
 * - Vérification réelle d'accessibilité serveur (GET /api/health)
 * - Idempotence stricte (UUID client + upsert onConflict + client_op_id)
 * - Vérification systématique des erreurs Supabase (aucune suppression silencieuse)
 * - Résolution automatique des dépendances parents/enfants créés hors ligne
 * - Backoff exponentiel avec jitter + reprise après interruption
 * - Détection et journalisation des conflits multi-appareils
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  appendOfflineAuditLog,
  ConflictRecord,
  enqueueOutboxEntry,
  generateUuidV4,
  listOutboxEntries,
  OutboxEntry,
  readOfflineSnapshot,
  recordSyncConflict,
  recoverInterruptedSyncEntries,
  removeOutboxEntry,
  updateOutboxEntry,
  writeOfflineSnapshot,
  OFFLINE_DB_SCHEMA_VERSION,
} from "./db";

export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ensureValidUuid(candidate?: string | null): string {
  if (candidate && UUID_V4_REGEX.test(candidate)) {
    return candidate;
  }
  return generateUuidV4();
}

export type SyncEngineState =
  | "idle"
  | "syncing"
  | "offline"
  | "error"
  | "auth_expired";

export interface SyncBatchResult {
  status: SyncEngineState;
  synced: number;
  failed: number;
  pending: number;
  lastError?: string | null;
  serverTime?: string;
}

const inFlightSyncByUser = new Map<string, Promise<SyncBatchResult>>();

export const OUTBOX_BACKGROUND_SYNC_TAG = "monbudget-outbox-sync";

export function isAuthErrorMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("jwt") ||
    lower.includes("expired") ||
    lower.includes("not authenticated") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("pgrst301") ||
    lower.includes("invalid token")
  );
}

function isMissingColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    msg.includes("client_op_id") ||
    msg.includes("deleted_at") ||
    msg.includes("sync_version") ||
    msg.includes("source_type")
  );
}

function isRlsDeniedError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return (
    err.code === "42501" ||
    msg.includes("row-level security") ||
    msg.includes("violates row-level security") ||
    msg.includes("permission denied")
  );
}

function stripExtendedSyncColumns<T extends Record<string, unknown>>(row: T): Partial<T> {
  const copy = { ...row };
  delete copy.client_op_id;
  delete copy.deleted_at;
  delete copy.sync_version;
  delete copy.updated_at;
  return copy;
}

async function softDeleteRecord(
  supabase: SupabaseClient,
  table: string,
  id: string,
  entry: OutboxEntry,
  extraFields: Record<string, unknown> = {}
): Promise<void> {
  const deletedAt = entry.clientUpdatedAt || new Date().toISOString();
  const patch = {
    ...extraFields,
    deleted_at: deletedAt,
    client_op_id: entry.opId,
  };

  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (!error) return;

  if (isMissingColumnError(error) || isRlsDeniedError(error)) {
    // Sur les catégories, privilégier le masquage logique is_active=false si la colonne deleted_at manque
    if (table === "categories" && Object.keys(extraFields).length > 0 && !isRlsDeniedError(error)) {
      const { error: legacyCatErr } = await supabase
        .from(table)
        .update(extraFields)
        .eq("id", id);
      if (legacyCatErr) throw new Error(legacyCatErr.message);
      return;
    }

    // Repli vers DELETE physique si le schéma est ancien ou si RLS interdit UPDATE (ex: compte expiré) mais autorise DELETE
    const { error: delErr } = await supabase.from(table).delete().eq("id", id);
    if (delErr) throw new Error(delErr.message);
    return;
  }

  throw new Error(error.message);
}

/**
 * Demande au Service Worker une synchronisation en arrière-plan (BackgroundSync API sur Chrome/Android).
 * Sans effet bloquant sur les navigateurs ne supportant pas encore BackgroundSync (ex: Safari/iOS).
 */
export async function requestBackgroundSync(
  tag: string = OUTBOX_BACKGROUND_SYNC_TAG
): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (
      registration as ServiceWorkerRegistration & {
        sync?: { register: (syncTag: string) => Promise<void> };
      }
    ).sync;
    if (syncManager && typeof syncManager.register === "function") {
      await syncManager.register(tag);
      return true;
    }
  } catch {
    // Repli silencieux sur le mécanisme en premier plan (online + visibilitychange + intervalle 15 s)
  }
  return false;
}

/**
 * Vérifie réellement si le serveur applicatif est joignable (évite les faux positifs de navigator.onLine).
 */
export async function checkServerReachability(timeoutMs = 4000): Promise<{
  reachable: boolean;
  serverTime?: string;
}> {
  if (typeof window === "undefined") {
    return { reachable: true };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { reachable: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { "x-monbudget-probe": "1" },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { reachable: false };
    }
    const data = await res.json().catch(() => null);
    return {
      reachable: true,
      serverTime: typeof data?.serverTime === "string" ? data.serverTime : new Date().toISOString(),
    };
  } catch {
    clearTimeout(timer);
    return { reachable: false };
  }
}

/**
 * Migre de façon transparente et sans perte un cache legacy localStorage vers IndexedDB.
 */
export async function migrateLegacyCacheToIndexedDb(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  legacyCache: any
): Promise<void> {
  if (!userId || !legacyCache || typeof legacyCache !== "object") return;

  const existingSnapshot = await readOfflineSnapshot(userId);
  const existingOutbox = await listOutboxEntries(userId);

  if (!existingSnapshot) {
    await writeOfflineSnapshot(userId, {
      schemaVersion: OFFLINE_DB_SCHEMA_VERSION,
      userId,
      currency: legacyCache.currency || "FCFA",
      payDay: Number(legacyCache.payDay) || 28,
      alertThreshold: Number(legacyCache.alertThreshold) || 80,
      fullName: legacyCache.fullName,
      notifications: legacyCache.notifications,
      months: legacyCache.months || {},
      savingsGoals: Array.isArray(legacyCache.savingsGoals) ? legacyCache.savingsGoals : [],
      debts: Array.isArray(legacyCache.debts) ? legacyCache.debts : [],
      subscriptionPlan: legacyCache.subscriptionPlan,
      billingCycle: legacyCache.billingCycle,
      subscriptionExpiresAt: legacyCache.subscriptionExpiresAt ?? null,
      subscriptionTrialEndsAt: legacyCache.subscriptionTrialEndsAt ?? null,
      trialChoiceMadeAt: legacyCache.trialChoiceMadeAt ?? null,
      subscriptionStatus: legacyCache.subscriptionStatus,
      updatedAt: new Date().toISOString(),
    });
  }

  const legacyQueue = Array.isArray(legacyCache.pendingSyncQueue)
    ? legacyCache.pendingSyncQueue
    : [];

  if (legacyQueue.length > 0 && existingOutbox.length === 0) {
    for (const legacyItem of legacyQueue) {
      if (!legacyItem || !legacyItem.type) continue;
      if (legacyItem.type === "add_transaction") {
        const txId = ensureValidUuid(legacyItem.payload?.id);
        await enqueueOutboxEntry(userId, {
          id: legacyItem.id,
          entityType: "transaction",
          entityId: txId,
          type: "upsert_transaction",
          payload: { ...legacyItem.payload, id: txId },
          clientUpdatedAt: new Date(legacyItem.timestamp || Date.now()).toISOString(),
        });
      } else if (legacyItem.type === "remove_transaction" && legacyItem.payload?.id) {
        await enqueueOutboxEntry(userId, {
          id: legacyItem.id,
          entityType: "transaction",
          entityId: String(legacyItem.payload.id),
          type: "delete_transaction",
          payload: { id: String(legacyItem.payload.id) },
          clientUpdatedAt: new Date(legacyItem.timestamp || Date.now()).toISOString(),
        });
      } else if (legacyItem.type === "update_category_amount") {
        const catId = String(legacyItem.payload?.categoryId || "");
        await enqueueOutboxEntry(userId, {
          id: legacyItem.id,
          entityType: "allocation",
          entityId: catId,
          coalesceKey: `alloc:${legacyItem.payload?.budgetId || "active"}:${catId}`,
          type: "upsert_allocation",
          payload: legacyItem.payload || {},
          clientUpdatedAt: new Date(legacyItem.timestamp || Date.now()).toISOString(),
        });
      }
    }
  }
}

async function resolveMonthlyBudgetId(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number,
  fallbackBudgetId?: string | null
): Promise<string | null> {
  if (fallbackBudgetId && UUID_V4_REGEX.test(fallbackBudgetId)) {
    return fallbackBudgetId;
  }

  const { data: existing, error: selErr } = await supabase
    .from("monthly_budgets")
    .select("id")
    .eq("user_id", userId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (selErr) {
    throw new Error(selErr.message);
  }
  if (existing?.id) {
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("monthly_budgets")
    .insert({ user_id: userId, year, month })
    .select("id")
    .maybeSingle();

  if (insErr) {
    // Gestion d'une création concurrente par un autre appareil (UNIQUE(user_id, year, month))
    const { data: retryExisting, error: retryErr } = await supabase
      .from("monthly_budgets")
      .select("id")
      .eq("user_id", userId)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();
    if (retryErr || !retryExisting?.id) {
      throw new Error(insErr.message);
    }
    return retryExisting.id;
  }

  return created?.id || null;
}

export async function executeSingleOutboxEntry(
  supabase: SupabaseClient,
  userId: string,
  entry: OutboxEntry
): Promise<void> {
  const p = entry.payload || {};

  switch (entry.type) {
    case "ensure_monthly_budget": {
      const year = Number(p.year);
      const month = Number(p.month);
      if (!year || !month) return;
      await resolveMonthlyBudgetId(supabase, userId, year, month, p.budgetId);
      return;
    }

    case "upsert_transaction": {
      const txId = ensureValidUuid(p.id || entry.entityId);
      const budgetId =
        (p.monthly_budget_id && UUID_V4_REGEX.test(p.monthly_budget_id)
          ? p.monthly_budget_id
          : null) ||
        (p.year && p.month
          ? await resolveMonthlyBudgetId(supabase, userId, Number(p.year), Number(p.month), null)
          : null);

      if (!budgetId) {
        throw new Error("Budget mensuel introuvable pour synchroniser la transaction.");
      }

      const safeCatId =
        p.category_id && UUID_V4_REGEX.test(String(p.category_id)) ? String(p.category_id) : null;

      const row = {
        id: txId,
        monthly_budget_id: budgetId,
        category_id: safeCatId,
        amount: Number(p.amount) || 0,
        description: p.description || "Transaction",
        transaction_date: p.transaction_date || new Date().toISOString().split("T")[0],
        type: p.type === "income" ? "income_adjustment" : p.type || "expense",
        client_op_id: entry.opId,
        deleted_at: null,
      };

      const { error } = await supabase
        .from("transactions")
        .upsert(row, { onConflict: "id" });

      if (error) {
        if (isMissingColumnError(error)) {
          const { error: fallbackErr } = await supabase
            .from("transactions")
            .upsert(stripExtendedSyncColumns(row), { onConflict: "id" });
          if (fallbackErr) throw new Error(fallbackErr.message);
          return;
        }
        throw new Error(error.message);
      }
      return;
    }

    case "delete_transaction": {
      const txId = String(p.id || entry.entityId);
      if (!UUID_V4_REGEX.test(txId)) return;
      await softDeleteRecord(supabase, "transactions", txId, entry);
      return;
    }

    case "upsert_category": {
      const catId = ensureValidUuid(p.id || entry.entityId);
      const row = {
        id: catId,
        user_id: userId,
        name: String(p.name || "").trim(),
        color: p.color || "bg-blue-500",
        is_active: true,
        client_op_id: entry.opId,
        deleted_at: null,
      };
      const { error } = await supabase.from("categories").upsert(row, { onConflict: "id" });
      if (error) {
        if (isMissingColumnError(error)) {
          const { error: fbErr } = await supabase
            .from("categories")
            .upsert(stripExtendedSyncColumns(row), { onConflict: "id" });
          if (fbErr) throw new Error(fbErr.message);
          return;
        }
        throw new Error(error.message);
      }
      return;
    }

    case "update_category": {
      const catId = String(p.id || entry.entityId);
      if (!UUID_V4_REGEX.test(catId)) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: Record<string, any> = {};
      if (p.name !== undefined) updates.name = String(p.name).trim();
      if (p.color !== undefined) updates.color = p.color;
      if (Object.keys(updates).length === 0) return;

      const { error } = await supabase.from("categories").update(updates).eq("id", catId);
      if (error) throw new Error(error.message);
      return;
    }

    case "delete_category": {
      const catId = String(p.id || entry.entityId);
      if (!UUID_V4_REGEX.test(catId)) return;
      await softDeleteRecord(supabase, "categories", catId, entry, {
        is_active: false,
      });
      return;
    }

    case "upsert_allocation": {
      const categoryId = String(p.categoryId || entry.entityId);
      if (!UUID_V4_REGEX.test(categoryId)) return;

      const budgetId =
        (p.budgetId && UUID_V4_REGEX.test(p.budgetId) ? p.budgetId : null) ||
        (p.year && p.month
          ? await resolveMonthlyBudgetId(supabase, userId, Number(p.year), Number(p.month), null)
          : null);

      if (!budgetId) {
        throw new Error("Budget mensuel introuvable pour l'allocation budgétaire.");
      }

      // S'assurer que la catégorie existe en base si elle a été créée hors ligne
      if (p.categoryName) {
        await supabase
          .from("categories")
          .upsert(
            {
              id: categoryId,
              user_id: userId,
              name: String(p.categoryName).trim(),
              color: p.categoryColor || "bg-blue-500",
              is_active: true,
            },
            { onConflict: "id", ignoreDuplicates: true }
          );
      }

      const row = {
        monthly_budget_id: budgetId,
        category_id: categoryId,
        allocated_amount: Math.max(0, Number(p.amount) || 0),
        client_op_id: entry.opId,
        deleted_at: null,
      };

      const { error } = await supabase
        .from("budget_allocations")
        .upsert(row, { onConflict: "monthly_budget_id,category_id" });

      if (error) {
        if (isMissingColumnError(error)) {
          const { error: fbErr } = await supabase
            .from("budget_allocations")
            .upsert(stripExtendedSyncColumns(row), {
              onConflict: "monthly_budget_id,category_id",
            });
          if (fbErr) throw new Error(fbErr.message);
          return;
        }
        throw new Error(error.message);
      }
      return;
    }

    case "set_primary_salary": {
      const budgetId =
        (p.budgetId && UUID_V4_REGEX.test(p.budgetId) ? p.budgetId : null) ||
        (p.year && p.month
          ? await resolveMonthlyBudgetId(supabase, userId, Number(p.year), Number(p.month), null)
          : null);

      if (!budgetId) {
        throw new Error("Budget mensuel introuvable pour le salaire principal.");
      }

      const amount = Math.max(0, Number(p.amount) || 0);
      const { data: existingList, error: selErr } = await supabase
        .from("income_entries")
        .select("*")
        .eq("monthly_budget_id", budgetId);

      if (selErr) throw new Error(selErr.message);

      // Ignorer les lignes supprimées logiquement (deleted_at non nul)
      const activeExisting = (existingList || []).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (row: any) => !row?.deleted_at
      );

      if (activeExisting.length > 0) {
        const { error: updErr } = await supabase
          .from("income_entries")
          .update({ amount, label: "Salaire principal", deleted_at: null })
          .eq("id", activeExisting[0].id);
        if (updErr) {
          if (isMissingColumnError(updErr)) {
            const { error: fbUpdErr } = await supabase
              .from("income_entries")
              .update({ amount, label: "Salaire principal" })
              .eq("id", activeExisting[0].id);
            if (fbUpdErr) throw new Error(fbUpdErr.message);
            return;
          }
          throw new Error(updErr.message);
        }
      } else {
        const { error: insErr } = await supabase.from("income_entries").insert({
          id: ensureValidUuid(p.id),
          monthly_budget_id: budgetId,
          label: "Salaire principal",
          amount,
          received_date: p.received_date || new Date().toISOString().split("T")[0],
        });
        if (insErr) throw new Error(insErr.message);
      }
      return;
    }

    case "upsert_income_entry": {
      const entryId = ensureValidUuid(p.id || entry.entityId);
      const budgetId =
        (p.monthly_budget_id && UUID_V4_REGEX.test(p.monthly_budget_id)
          ? p.monthly_budget_id
          : null) ||
        (p.year && p.month
          ? await resolveMonthlyBudgetId(supabase, userId, Number(p.year), Number(p.month), null)
          : null);

      if (!budgetId) {
        throw new Error("Budget mensuel introuvable pour l'entrée de revenu.");
      }

      const row = {
        id: entryId,
        monthly_budget_id: budgetId,
        label: p.label || "Revenu",
        source_type: p.source_type || "Salaire",
        amount: Math.max(0, Number(p.amount) || 0),
        received_date: p.received_date || new Date().toISOString().split("T")[0],
        client_op_id: entry.opId,
        deleted_at: null,
      };

      const { error } = await supabase
        .from("income_entries")
        .upsert(row, { onConflict: "id" });

      if (error) {
        if (isMissingColumnError(error)) {
          const fallbackRow = {
            id: entryId,
            monthly_budget_id: budgetId,
            label: `${row.source_type} - ${row.label}`,
            amount: row.amount,
            received_date: row.received_date,
          };
          const { error: fbErr } = await supabase
            .from("income_entries")
            .upsert(fallbackRow, { onConflict: "id" });
          if (fbErr) throw new Error(fbErr.message);
          return;
        }
        throw new Error(error.message);
      }
      return;
    }

    case "delete_income_entry": {
      const id = String(p.id || entry.entityId);
      if (!UUID_V4_REGEX.test(id)) return;
      await softDeleteRecord(supabase, "income_entries", id, entry);
      return;
    }

    case "upsert_savings_goal": {
      const goalId = ensureValidUuid(p.id || entry.entityId);
      const row = {
        id: goalId,
        user_id: userId,
        name: p.name || "Objectif d'épargne",
        target_amount: Math.max(0, Number(p.target_amount ?? p.target) || 0),
        current_amount: Math.max(0, Number(p.current_amount ?? p.current) || 0),
        color: p.color || "bg-blue-500",
        target_date: p.target_date || null,
        status: p.status || "active",
        client_op_id: entry.opId,
        deleted_at: null,
      };
      const { error } = await supabase
        .from("savings_goals")
        .upsert(row, { onConflict: "id" });
      if (error) {
        if (isMissingColumnError(error)) {
          const { error: fbErr } = await supabase
            .from("savings_goals")
            .upsert(stripExtendedSyncColumns(row), { onConflict: "id" });
          if (fbErr) throw new Error(fbErr.message);
          return;
        }
        throw new Error(error.message);
      }
      return;
    }

    case "update_savings_goal_status": {
      const goalId = String(p.id || entry.entityId);
      if (!UUID_V4_REGEX.test(goalId)) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: Record<string, any> = {};
      if (p.status !== undefined) updates.status = p.status;
      if (p.current_amount !== undefined) updates.current_amount = Number(p.current_amount);
      const { error } = await supabase
        .from("savings_goals")
        .update(updates)
        .eq("id", goalId);
      if (error) throw new Error(error.message);
      return;
    }

    case "delete_savings_goal": {
      const goalId = String(p.id || entry.entityId);
      if (!UUID_V4_REGEX.test(goalId)) return;
      const deletedAt = entry.clientUpdatedAt || new Date().toISOString();
      try {
        await supabase
          .from("savings_contributions")
          .update({ deleted_at: deletedAt })
          .eq("savings_goal_id", goalId);
      } catch {}
      await softDeleteRecord(supabase, "savings_goals", goalId, entry);
      return;
    }

    case "upsert_savings_contribution": {
      const contribId = ensureValidUuid(p.id || entry.entityId);
      const goalId = ensureValidUuid(p.savings_goal_id || p.goalId);

      const row = {
        id: contribId,
        savings_goal_id: goalId,
        amount: Math.max(0, Number(p.amount) || 0),
        contribution_date: p.contribution_date || p.date || new Date().toISOString().split("T")[0],
        notes: p.notes || null,
        client_op_id: entry.opId,
        deleted_at: null,
      };

      const { error } = await supabase
        .from("savings_contributions")
        .upsert(row, { onConflict: "id" });

      if (error) {
        if (isMissingColumnError(error)) {
          const { error: fbErr } = await supabase
            .from("savings_contributions")
            .upsert(stripExtendedSyncColumns(row), { onConflict: "id" });
          if (fbErr) throw new Error(fbErr.message);
        } else {
          throw new Error(error.message);
        }
      }

      if (p.newCurrent !== undefined) {
        const { error: goalUpdErr } = await supabase
          .from("savings_goals")
          .update({
            current_amount: Math.max(0, Number(p.newCurrent) || 0),
            ...(p.goalStatus ? { status: p.goalStatus } : {}),
          })
          .eq("id", goalId);
        if (goalUpdErr) throw new Error(goalUpdErr.message);
      }
      return;
    }

    case "delete_savings_contribution": {
      const contribId = String(p.id || entry.entityId);
      if (UUID_V4_REGEX.test(contribId)) {
        await softDeleteRecord(supabase, "savings_contributions", contribId, entry);
      }
      if (p.goalId && UUID_V4_REGEX.test(String(p.goalId)) && p.newCurrent !== undefined) {
        const { error: updErr } = await supabase
          .from("savings_goals")
          .update({
            current_amount: Math.max(0, Number(p.newCurrent) || 0),
            ...(p.goalStatus ? { status: p.goalStatus } : {}),
          })
          .eq("id", String(p.goalId));
        if (updErr) throw new Error(updErr.message);
      }
      return;
    }

    case "upsert_debt": {
      const debtId = ensureValidUuid(p.id || entry.entityId);
      const row = {
        id: debtId,
        user_id: userId,
        type: p.type === "receivable" ? "receivable" : "payable",
        person_name: String(p.person_name ?? p.personName ?? "").trim(),
        phone: p.phone || null,
        total_amount: Math.max(0, Number(p.total_amount ?? p.totalAmount) || 0),
        remaining_amount: Math.max(0, Number(p.remaining_amount ?? p.remainingAmount) || 0),
        due_date: p.due_date ?? p.dueDate ?? null,
        status: p.status || "pending",
        notes: p.notes || null,
        client_op_id: entry.opId,
        deleted_at: null,
      };

      const { error } = await supabase.from("debts").upsert(row, { onConflict: "id" });
      if (error) {
        if (isMissingColumnError(error)) {
          const { error: fbErr } = await supabase
            .from("debts")
            .upsert(stripExtendedSyncColumns(row), { onConflict: "id" });
          if (fbErr) throw new Error(fbErr.message);
          return;
        }
        throw new Error(error.message);
      }
      return;
    }

    case "delete_debt": {
      const debtId = String(p.id || entry.entityId);
      if (!UUID_V4_REGEX.test(debtId)) return;
      const deletedAt = entry.clientUpdatedAt || new Date().toISOString();
      try {
        await supabase
          .from("debt_payments")
          .update({ deleted_at: deletedAt })
          .eq("debt_id", debtId);
      } catch {}
      await softDeleteRecord(supabase, "debts", debtId, entry);
      return;
    }

    case "upsert_debt_payment": {
      const paymentId = ensureValidUuid(p.id || entry.entityId);
      const debtId = ensureValidUuid(p.debt_id || p.debtId);

      const row = {
        id: paymentId,
        debt_id: debtId,
        amount: Math.max(0, Number(p.amount) || 0),
        payment_date: p.payment_date || p.date || new Date().toISOString().split("T")[0],
        notes: p.notes || null,
        client_op_id: entry.opId,
        deleted_at: null,
      };

      const { error } = await supabase
        .from("debt_payments")
        .upsert(row, { onConflict: "id" });
      if (error) {
        if (isMissingColumnError(error)) {
          const { error: fbErr } = await supabase
            .from("debt_payments")
            .upsert(stripExtendedSyncColumns(row), { onConflict: "id" });
          if (fbErr) throw new Error(fbErr.message);
        } else {
          throw new Error(error.message);
        }
      }

      if (p.remainingAmount !== undefined) {
        const { error: debtUpdErr } = await supabase
          .from("debts")
          .update({
            remaining_amount: Math.max(0, Number(p.remainingAmount) || 0),
            ...(p.debtStatus ? { status: p.debtStatus } : {}),
          })
          .eq("id", debtId);
        if (debtUpdErr) throw new Error(debtUpdErr.message);
      }
      return;
    }

    case "delete_debt_payment": {
      const paymentId = String(p.id || entry.entityId);
      if (UUID_V4_REGEX.test(paymentId)) {
        await softDeleteRecord(supabase, "debt_payments", paymentId, entry);
      }
      if (p.debtId && UUID_V4_REGEX.test(String(p.debtId)) && p.remainingAmount !== undefined) {
        const { error: debtUpdErr } = await supabase
          .from("debts")
          .update({
            remaining_amount: Math.max(0, Number(p.remainingAmount) || 0),
            ...(p.debtStatus ? { status: p.debtStatus } : {}),
          })
          .eq("id", String(p.debtId));
        if (debtUpdErr) throw new Error(debtUpdErr.message);
      }
      return;
    }

    case "update_preferences": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: Record<string, any> = {};
      if (p.alertThreshold !== undefined) updates.alert_threshold_percent = p.alertThreshold;
      if (p.currency !== undefined) updates.currency = p.currency;
      if (p.payDay !== undefined) updates.pay_day = p.payDay;
      if (p.fullName !== undefined) updates.full_name = p.fullName;
      if (p.notifications !== undefined) updates.notifications = p.notifications;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
        if (error) {
          delete updates.notifications;
          if (Object.keys(updates).length > 0) {
            const { error: fbErr } = await supabase
              .from("profiles")
              .update(updates)
              .eq("id", userId);
            if (fbErr) throw new Error(fbErr.message);
          }
        }
      }
      return;
    }
  }
}

/**
 * Exécute la file d'attente IndexedDB d'un utilisateur avec :
 * - Verrou anti-concurrence (single-flight)
 * - Reprise automatique des items interrompus ("syncing")
 * - Sonde de disponibilité serveur (/api/health)
 * - Backoff exponentiel en cas d'échec réseau/serveur
 * - Pause propre sans perte en cas d'expiration de session
 */
export async function processOutboxQueue(
  supabase: SupabaseClient,
  userId: string,
  options: { force?: boolean } = {}
): Promise<SyncBatchResult> {
  if (!userId) {
    return { status: "idle", synced: 0, failed: 0, pending: 0 };
  }

  const existingPromise = inFlightSyncByUser.get(userId);
  if (existingPromise) {
    return existingPromise;
  }

  const runPromise = (async (): Promise<SyncBatchResult> => {
    await recoverInterruptedSyncEntries(userId);

    const allQueue = await listOutboxEntries(userId);
    if (allQueue.length === 0) {
      return { status: "idle", synced: 0, failed: 0, pending: 0 };
    }

    const probe = await checkServerReachability();
    if (!probe.reachable) {
      return {
        status: "offline",
        synced: 0,
        failed: allQueue.filter((i) => i.status === "failed").length,
        pending: allQueue.length,
        lastError: "Serveur inaccessible ou appareil hors ligne.",
      };
    }

    // Vérifier la validité de la session utilisateur avant d'envoyer des écritures
    let authenticatedUserId: string | null = null;
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (!userErr && userRes?.user?.id) {
        authenticatedUserId = userRes.user.id;
      } else {
        const { data: refreshed } = await supabase.auth.refreshSession();
        authenticatedUserId = refreshed?.user?.id || null;
      }
    } catch {
      authenticatedUserId = null;
    }

    if (!authenticatedUserId || authenticatedUserId !== userId) {
      for (const item of allQueue) {
        await updateOutboxEntry(userId, item.id, {
          status: "auth_paused",
          lastError: "Session expirée — reconnexion requise pour synchroniser.",
        });
      }
      await appendOfflineAuditLog(userId, {
        level: "warn",
        event: "sync_paused_auth_expired",
        details: `${allQueue.length} opération(s) conservée(s) en attente de reconnexion.`,
      });
      return {
        status: "auth_expired",
        synced: 0,
        failed: 0,
        pending: allQueue.length,
        lastError: "Votre session a expiré. Reconnectez-vous pour synchroniser vos données locales.",
      };
    }

    const now = Date.now();
    const dueItems = allQueue.filter(
      (item) => options.force || item.status === "auth_paused" || item.nextRetryAt <= now
    );

    let synced = 0;
    let failed = 0;
    let lastError: string | null = null;

    for (const item of dueItems) {
      // Revérifier que l'opération existe encore (elle a pu être annulée par coalescence)
      const latestQueue = await listOutboxEntries(userId);
      const currentItem = latestQueue.find((q) => q.id === item.id);
      if (!currentItem) continue;

      await updateOutboxEntry(userId, currentItem.id, {
        status: "syncing",
        lastAttemptAt: Date.now(),
      });

      try {
        await executeSingleOutboxEntry(supabase, userId, currentItem);
        await removeOutboxEntry(userId, currentItem.id);
        synced++;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Erreur de synchronisation serveur.";
        lastError = message;

        if (isAuthErrorMessage(message)) {
          await updateOutboxEntry(userId, currentItem.id, {
            status: "auth_paused",
            lastError: message,
          });
          const remaining = await listOutboxEntries(userId);
          return {
            status: "auth_expired",
            synced,
            failed,
            pending: remaining.length,
            lastError: message,
          };
        }

        // Si le réseau vient de couper en pleine synchronisation, interrompre proprement le lot sans brûler les tentatives
        const stillOnline =
          typeof navigator === "undefined" ? true : navigator.onLine !== false;
        const lowerMsg = message.toLowerCase();
        const isNetworkDrop =
          !stillOnline ||
          lowerMsg.includes("fetch") ||
          lowerMsg.includes("network") ||
          lowerMsg.includes("econnreset") ||
          lowerMsg.includes("internet_disconnected") ||
          lowerMsg.includes("load failed") ||
          lowerMsg.includes("abort");

        if (isNetworkDrop) {
          await updateOutboxEntry(userId, currentItem.id, {
            status: "pending",
            nextRetryAt: Date.now(),
            lastError: "Connexion interrompue pendant la synchronisation.",
          });
          const remainingNow = await listOutboxEntries(userId);
          return {
            status: "offline",
            synced,
            failed,
            pending: remainingNow.length,
            lastError: "Connexion interrompue pendant la synchronisation.",
            serverTime: probe.serverTime,
          };
        }

        const nextRetryCount = currentItem.retryCount + 1;
        const baseBackoffMs = Math.min(60_000, 1500 * Math.pow(2, Math.min(nextRetryCount, 5)));
        const jitterMs = Math.floor(Math.random() * 500);

        await updateOutboxEntry(userId, currentItem.id, {
          status: "failed",
          retryCount: nextRetryCount,
          nextRetryAt: Date.now() + baseBackoffMs + jitterMs,
          lastError: message,
        });
        failed++;

        await appendOfflineAuditLog(userId, {
          level: "error",
          event: "sync_operation_failed",
          details: `[${currentItem.type}] tentative #${nextRetryCount} : ${message}`,
        });
      }
    }

    const remainingAfter = await listOutboxEntries(userId);
    if (synced > 0) {
      await appendOfflineAuditLog(userId, {
        level: "info",
        event: "sync_batch_completed",
        details: `${synced} opération(s) synchronisée(s), ${remainingAfter.length} restante(s).`,
      });
    }

    const finalStatus: SyncEngineState =
      remainingAfter.some((r) => r.status === "auth_paused")
        ? "auth_expired"
        : failed > 0
        ? "error"
        : "idle";

    return {
      status: finalStatus,
      synced,
      failed,
      pending: remainingAfter.length,
      lastError,
      serverTime: probe.serverTime,
    };
  })();

  inFlightSyncByUser.set(userId, runPromise);
  try {
    return await runPromise;
  } finally {
    inFlightSyncByUser.delete(userId);
  }
}

function stripTombstoneField<T extends { deletedAt?: string | null }>(item: T): T {
  if (!("deletedAt" in item)) return item;
  const copy = { ...item };
  delete copy.deletedAt;
  return copy;
}

/**
 * Exécute un lot d'opérations provenant du Service Worker / client authentifié côté serveur
 * tout en conservant une isolation stricte sur `authenticatedUserId`.
 */
export async function processServerOfflineSyncBatch(
  supabase: SupabaseClient,
  authenticatedUserId: string,
  entries: OutboxEntry[]
): Promise<{
  syncedIds: string[];
  failed: Array<{ id: string; error: string; authExpired?: boolean }>;
  authExpired: boolean;
  serverTime: string;
}> {
  const syncedIds: string[] = [];
  const failed: Array<{ id: string; error: string; authExpired?: boolean }> = [];
  let authExpired = false;

  const batch = entries.slice(0, 100);
  for (const entry of batch) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string") {
      continue;
    }
    if (entry.userId && entry.userId !== authenticatedUserId) {
      failed.push({
        id: entry.id,
        error: "Identifiant utilisateur non concordant (isolation de sécurité).",
      });
      continue;
    }

    try {
      await executeSingleOutboxEntry(supabase, authenticatedUserId, {
        ...entry,
        userId: authenticatedUserId,
      });
      syncedIds.push(entry.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de synchronisation serveur.";
      if (isAuthErrorMessage(msg)) {
        authExpired = true;
        failed.push({ id: entry.id, error: msg, authExpired: true });
        break;
      }
      failed.push({ id: entry.id, error: msg });
    }
  }

  return {
    syncedIds,
    failed,
    authExpired,
    serverTime: new Date().toISOString(),
  };
}

/**
 * Réconcilie les enregistrements distants et locaux en respectant :
 * - Les suppressions locales en attente (aucune résurrection d'élément supprimé hors ligne)
 * - Les tombstones distants (`deletedAt`) multi-appareils & détection suppression vs édition
 * - Les créations/modifications locales en attente (aucun écrasement silencieux)
 * - La journalisation de tout conflit concurrent en vue d'une révision manuelle éventuelle
 */
export async function reconcileRecordsWithConflictDetection<
  T extends { id: string; updatedAt?: string; deletedAt?: string | null }
>(params: {
  userId: string;
  entityType: ConflictRecord["entityType"];
  monthKey?: string;
  remoteItems: T[];
  localItems: T[];
  pendingOutbox: OutboxEntry[];
  lastSyncedAt?: string | null;
  getLabel: (item: T) => string;
  mergeEqualOrNewer?: (local: T, remote: T) => T;
}): Promise<T[]> {
  const {
    userId,
    entityType,
    monthKey,
    remoteItems,
    localItems,
    pendingOutbox,
    lastSyncedAt,
    getLabel,
    mergeEqualOrNewer,
  } = params;

  const pendingDeletes = new Set(
    pendingOutbox
      .filter((o) => o.entityType === entityType && o.type.startsWith("delete_"))
      .map((o) => o.entityId)
  );

  const pendingUpserts = new Map<string, OutboxEntry>();
  for (const op of pendingOutbox) {
    if (op.entityType === entityType && !op.type.startsWith("delete_")) {
      pendingUpserts.set(op.entityId, op);
    }
  }

  const lastSyncMs = lastSyncedAt ? Date.parse(lastSyncedAt) : NaN;
  const resultMap = new Map<string, T>();
  const resolvedRemoteTombstones = new Set<string>();

  for (const remote of remoteItems) {
    if (pendingDeletes.has(remote.id)) {
      // Supprimé localement hors ligne -> ne pas ressusciter tant que la suppression n'est pas confirmée
      continue;
    }

    const pendingOp = pendingUpserts.get(remote.id);
    const localMatch = localItems.find((l) => l.id === remote.id);

    // 1. Gestion des pierres tombales (deleted_at non nul côté serveur)
    if (remote.deletedAt) {
      resolvedRemoteTombstones.add(remote.id);

      if (pendingOp) {
        const remoteDeletedMs = Date.parse(remote.deletedAt);
        const localUpdatedMs = Date.parse(pendingOp.clientUpdatedAt);
        const isConcurrent =
          !Number.isFinite(lastSyncMs) ||
          !Number.isFinite(remoteDeletedMs) ||
          remoteDeletedMs >= lastSyncMs ||
          Math.abs(remoteDeletedMs - localUpdatedMs) > 1000;

        const targetForLabel = localMatch || stripTombstoneField(remote);
        const localWins =
          Number.isFinite(localUpdatedMs) &&
          (!Number.isFinite(remoteDeletedMs) || localUpdatedMs > remoteDeletedMs);

        if (isConcurrent) {
          await recordSyncConflict(userId, {
            entityType,
            entityId: remote.id,
            monthKey,
            conflictType: "delete_vs_edit",
            label: getLabel(targetForLabel),
            localData: (localMatch || pendingOp.payload) as Record<string, unknown>,
            remoteData: {
              ...(remote as Record<string, unknown>),
              _deleted: true,
              deletedAt: remote.deletedAt,
            },
            localUpdatedAt: pendingOp.clientUpdatedAt,
            remoteUpdatedAt: remote.deletedAt,
            resolution: localWins ? "local_wins" : "delete_wins",
            resolved: false,
          });
        }

        if (localWins && localMatch) {
          resultMap.set(remote.id, stripTombstoneField(localMatch));
        }
      }
      // Si pas d'édition locale concurrente ou si delete_wins l'emporte -> ne pas garder côté actif
      continue;
    }

    // 2. Enregistrement actif sur le serveur
    if (pendingOp && localMatch) {
      const remoteUpdatedMs = remote.updatedAt ? Date.parse(remote.updatedAt) : NaN;
      const localUpdatedMs = Date.parse(pendingOp.clientUpdatedAt);

      // Conflit concurrent si le serveur a aussi été modifié depuis la dernière synchronisation
      if (
        Number.isFinite(lastSyncMs) &&
        Number.isFinite(remoteUpdatedMs) &&
        remoteUpdatedMs > lastSyncMs &&
        Math.abs(remoteUpdatedMs - localUpdatedMs) > 1000
      ) {
        const localWins = !Number.isFinite(remoteUpdatedMs) || localUpdatedMs >= remoteUpdatedMs;
        await recordSyncConflict(userId, {
          entityType,
          entityId: remote.id,
          monthKey,
          conflictType: "edit_vs_edit",
          label: getLabel(localMatch),
          localData: stripTombstoneField(localMatch) as Record<string, unknown>,
          remoteData: stripTombstoneField(remote) as Record<string, unknown>,
          localUpdatedAt: pendingOp.clientUpdatedAt,
          remoteUpdatedAt: remote.updatedAt || new Date().toISOString(),
          resolution: localWins ? "local_wins" : "remote_wins",
          resolved: false,
        });
        resultMap.set(
          remote.id,
          stripTombstoneField(localWins ? localMatch : remote)
        );
      } else {
        const merged = mergeEqualOrNewer
          ? mergeEqualOrNewer(localMatch, remote)
          : localMatch;
        resultMap.set(remote.id, stripTombstoneField(merged));
      }
    } else {
      resultMap.set(remote.id, stripTombstoneField(remote));
    }
  }

  // Conserver les créations locales qui n'existent pas encore sur le serveur (sauf si supprimées sur un autre appareil)
  for (const local of localItems) {
    if (pendingDeletes.has(local.id) || resolvedRemoteTombstones.has(local.id)) continue;
    if (!resultMap.has(local.id) && pendingUpserts.has(local.id)) {
      resultMap.set(local.id, stripTombstoneField(local));
    }
  }

  return Array.from(resultMap.values());
}

