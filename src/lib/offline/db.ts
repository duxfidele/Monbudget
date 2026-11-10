/**
 * Couche de persistance IndexedDB versionnée et isolée par utilisateur pour MonBudget.
 * Fournit :
 * - Stockage haute capacité structuré (stores : meta, months, outbox, conflicts, audit_log)
 * - Isolation stricte inter-comptes (une base IndexedDB dédiée par userId)
 * - Coalescence intelligente de la file d'attente (anti-redondance & annulation création+suppression locale)
 * - Reprise automatique des synchronisations interrompues
 * - Sauvegarde/Restauration locale avec contrôle d'intégrité SHA-256
 */

export const OFFLINE_DB_SCHEMA_VERSION = 1;
const DB_PREFIX = "monbudget_offline_v1_";
export const SW_REGISTRY_DB_NAME = "monbudget_sw_registry_v1";
const MAX_AUDIT_ENTRIES = 400;

export type OutboxEntityType =
  | "monthly_budget"
  | "transaction"
  | "category"
  | "allocation"
  | "income_entry"
  | "primary_salary"
  | "savings_goal"
  | "savings_contribution"
  | "debt"
  | "debt_payment"
  | "preferences";

export type OutboxOperationType =
  | "ensure_monthly_budget"
  | "upsert_transaction"
  | "delete_transaction"
  | "upsert_category"
  | "update_category"
  | "delete_category"
  | "upsert_allocation"
  | "upsert_income_entry"
  | "delete_income_entry"
  | "set_primary_salary"
  | "upsert_savings_goal"
  | "update_savings_goal_status"
  | "delete_savings_goal"
  | "upsert_savings_contribution"
  | "delete_savings_contribution"
  | "upsert_debt"
  | "delete_debt"
  | "upsert_debt_payment"
  | "delete_debt_payment"
  | "update_preferences";

export type OutboxStatus = "pending" | "syncing" | "failed" | "auth_paused";

export interface OutboxEntry {
  id: string;
  opId: string;
  userId: string;
  entityType: OutboxEntityType;
  entityId: string;
  monthKey?: string;
  coalesceKey?: string;
  type: OutboxOperationType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
  status: OutboxStatus;
  retryCount: number;
  nextRetryAt: number;
  createdAt: number;
  clientUpdatedAt: string;
  lastAttemptAt?: number;
  lastError?: string;
}

export interface ConflictRecord {
  id: string;
  userId: string;
  entityType: OutboxEntityType;
  entityId: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localData: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remoteData: Record<string, any>;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  resolution: "merged" | "local_wins" | "remote_wins" | "delete_wins" | "manual_review";
  resolved: boolean;
  conflictType?: "edit_vs_edit" | "delete_vs_edit";
  monthKey?: string;
  resolvedAt?: string;
  resolvedBy?: "auto" | "manual";
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  level: "info" | "warn" | "error";
  event: string;
  details?: string;
  timestamp: string;
}

export interface OfflineMonthRecord {
  monthKey: string;
  budgetId?: string | null;
  baseSalary: number;
  income: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  incomeEntries?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transactions: any[];
  updatedAt?: string;
}

export interface OfflineSnapshot {
  schemaVersion: number;
  userId: string;
  currency: string;
  payDay: number;
  alertThreshold: number;
  fullName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notifications?: any;
  months: Record<string, OfflineMonthRecord>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  savingsGoals: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debts: any[];
  subscriptionPlan?: string;
  billingCycle?: string;
  subscriptionExpiresAt?: string | null;
  subscriptionTrialEndsAt?: string | null;
  trialChoiceMadeAt?: string | null;
  subscriptionStatus?: string;
  lastSyncedAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  updatedAt: string;
}

const openConnections = new Map<string, Promise<IDBDatabase | null>>();

function sanitizeDbUserId(userId: string): string {
  const clean = (userId || "anon").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return clean || "anon";
}

export function getUserOfflineDbName(userId: string): string {
  return `${DB_PREFIX}${sanitizeDbUserId(userId)}`;
}

export function generateUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function createSchemaStores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains("meta")) {
    db.createObjectStore("meta", { keyPath: "key" });
  }
  if (!db.objectStoreNames.contains("months")) {
    const monthsStore = db.createObjectStore("months", { keyPath: "monthKey" });
    monthsStore.createIndex("updatedAt", "updatedAt", { unique: false });
  }
  if (!db.objectStoreNames.contains("outbox")) {
    const outboxStore = db.createObjectStore("outbox", { keyPath: "id" });
    outboxStore.createIndex("status", "status", { unique: false });
    outboxStore.createIndex("createdAt", "createdAt", { unique: false });
    outboxStore.createIndex("nextRetryAt", "nextRetryAt", { unique: false });
    outboxStore.createIndex("entityId", "entityId", { unique: false });
  }
  if (!db.objectStoreNames.contains("conflicts")) {
    const conflictStore = db.createObjectStore("conflicts", { keyPath: "id" });
    conflictStore.createIndex("createdAt", "createdAt", { unique: false });
    conflictStore.createIndex("resolved", "resolved", { unique: false });
  }
  if (!db.objectStoreNames.contains("audit_log")) {
    const auditStore = db.createObjectStore("audit_log", { keyPath: "id" });
    auditStore.createIndex("timestamp", "timestamp", { unique: false });
  }
}

async function updateSwUserRegistry(
  userId: string,
  dbName: string,
  mode: "add" | "remove"
): Promise<void> {
  if (!isIndexedDbAvailable() || !userId) return;
  await new Promise<void>((resolve) => {
    try {
      const req = window.indexedDB.open(SW_REGISTRY_DB_NAME, 1);
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("users")) {
          db.createObjectStore("users", { keyPath: "userId" });
        }
      };
      req.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        try {
          const tx = db.transaction("users", "readwrite");
          const store = tx.objectStore("users");
          if (mode === "add") {
            store.put({
              userId,
              dbName,
              updatedAt: new Date().toISOString(),
            });
          } else {
            store.delete(userId);
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            resolve();
          };
        } catch {
          db.close();
          resolve();
        }
      };
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function openUserOfflineDb(userId: string): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable() || !userId) return null;
  const dbName = getUserOfflineDbName(userId);

  const existing = openConnections.get(dbName);
  if (existing) {
    return existing;
  }

  const connectionPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = window.indexedDB.open(dbName, OFFLINE_DB_SCHEMA_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        createSchemaStores(db);
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.onversionchange = () => {
          db.close();
          openConnections.delete(dbName);
        };
        db.onclose = () => {
          openConnections.delete(dbName);
        };
        if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
          void updateSwUserRegistry(userId, dbName, "add");
        }
        resolve(db);
      };

      request.onerror = () => {
        openConnections.delete(dbName);
        resolve(null);
      };

      request.onblocked = () => {
        openConnections.delete(dbName);
        resolve(null);
      };
    } catch {
      openConnections.delete(dbName);
      resolve(null);
    }
  });

  openConnections.set(dbName, connectionPromise);
  return connectionPromise;
}

export async function closeAndDeleteUserOfflineDb(userId: string): Promise<void> {
  if (!isIndexedDbAvailable() || !userId) return;
  const dbName = getUserOfflineDbName(userId);
  const existing = openConnections.get(dbName);
  if (existing) {
    try {
      const db = await existing;
      db?.close();
    } catch {}
    openConnections.delete(dbName);
  }

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    await updateSwUserRegistry(userId, dbName, "remove");
  }

  await new Promise<void>((resolve) => {
    try {
      const req = window.indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

function idbRequestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB request failed"));
  });
}

function idbTransactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

export async function readOfflineSnapshot(userId: string): Promise<OfflineSnapshot | null> {
  const db = await openUserOfflineDb(userId);
  if (!db) return null;

  try {
    const tx = db.transaction(["meta", "months"], "readonly");
    const metaStore = tx.objectStore("meta");
    const monthsStore = tx.objectStore("months");

    const snapshotMeta = await idbRequestToPromise<{ key: string; value: OfflineSnapshot } | undefined>(
      metaStore.get("snapshot")
    );
    const allMonths = await idbRequestToPromise<OfflineMonthRecord[]>(monthsStore.getAll());
    await idbTransactionDone(tx);

    if (!snapshotMeta?.value && (!allMonths || allMonths.length === 0)) {
      return null;
    }

    const monthsMap: Record<string, OfflineMonthRecord> = {
      ...(snapshotMeta?.value?.months || {}),
    };
    for (const m of allMonths || []) {
      if (m?.monthKey) {
        monthsMap[m.monthKey] = m;
      }
    }

    const base: OfflineSnapshot = snapshotMeta?.value || {
      schemaVersion: OFFLINE_DB_SCHEMA_VERSION,
      userId,
      currency: "FCFA",
      payDay: 28,
      alertThreshold: 80,
      months: {},
      savingsGoals: [],
      debts: [],
      updatedAt: new Date().toISOString(),
    };

    return {
      ...base,
      userId,
      schemaVersion: OFFLINE_DB_SCHEMA_VERSION,
      months: monthsMap,
    };
  } catch {
    return null;
  }
}

export async function writeOfflineSnapshot(
  userId: string,
  snapshot: OfflineSnapshot
): Promise<void> {
  const db = await openUserOfflineDb(userId);
  if (!db) return;

  const cleanSnapshot: OfflineSnapshot = {
    ...snapshot,
    userId,
    schemaVersion: OFFLINE_DB_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };

  try {
    const tx = db.transaction(["meta", "months"], "readwrite");
    const metaStore = tx.objectStore("meta");
    const monthsStore = tx.objectStore("months");

    const monthEntries = Object.entries(cleanSnapshot.months || {});
    for (const [monthKey, monthData] of monthEntries) {
      monthsStore.put({
        ...monthData,
        monthKey,
        updatedAt: monthData.updatedAt || cleanSnapshot.updatedAt,
      });
    }

    // Garder dans meta le snapshot global (sans dupliquer les gros tableaux mensuels déjà dans le store months)
    const metaCopy: OfflineSnapshot = {
      ...cleanSnapshot,
      months: {},
    };
    metaStore.put({ key: "snapshot", value: metaCopy });
    metaStore.put({ key: "schema_version", value: OFFLINE_DB_SCHEMA_VERSION });

    await idbTransactionDone(tx);
  } catch (err) {
    console.warn("[OfflineDB] Failed to persist snapshot:", err);
  }
}

export async function listOutboxEntries(
  userId: string,
  statuses?: OutboxStatus[]
): Promise<OutboxEntry[]> {
  const db = await openUserOfflineDb(userId);
  if (!db) return [];

  try {
    const tx = db.transaction("outbox", "readonly");
    const store = tx.objectStore("outbox");
    const all = await idbRequestToPromise<OutboxEntry[]>(store.getAll());
    await idbTransactionDone(tx);

    const filtered = (all || [])
      .filter((item) => item.userId === userId)
      .filter((item) => (!statuses ? true : statuses.includes(item.status)))
      .sort((a, b) => a.createdAt - b.createdAt);

    return filtered;
  } catch {
    return [];
  }
}

const CREATE_OPS = new Set<OutboxOperationType>([
  "upsert_transaction",
  "upsert_category",
  "upsert_income_entry",
  "upsert_savings_goal",
  "upsert_savings_contribution",
  "upsert_debt",
  "upsert_debt_payment",
]);

const DELETE_TO_CREATE_OP: Partial<Record<OutboxOperationType, OutboxOperationType>> = {
  delete_transaction: "upsert_transaction",
  delete_category: "upsert_category",
  delete_income_entry: "upsert_income_entry",
  delete_savings_goal: "upsert_savings_goal",
  delete_savings_contribution: "upsert_savings_contribution",
  delete_debt: "upsert_debt",
  delete_debt_payment: "upsert_debt_payment",
};

export async function enqueueOutboxEntry(
  userId: string,
  input: Omit<
    OutboxEntry,
    "id" | "opId" | "userId" | "status" | "retryCount" | "nextRetryAt" | "createdAt"
  > & { id?: string; opId?: string }
): Promise<OutboxEntry> {
  const now = Date.now();
  const entry: OutboxEntry = {
    id: input.id || generateUuidV4(),
    opId: input.opId || generateUuidV4(),
    userId,
    entityType: input.entityType,
    entityId: input.entityId,
    monthKey: input.monthKey,
    coalesceKey: input.coalesceKey,
    type: input.type,
    payload: input.payload,
    status: "pending",
    retryCount: 0,
    nextRetryAt: now,
    createdAt: now,
    clientUpdatedAt: input.clientUpdatedAt || new Date(now).toISOString(),
  };

  const db = await openUserOfflineDb(userId);
  if (!db) return entry;

  try {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const existingAll = await idbRequestToPromise<OutboxEntry[]>(store.getAll());
    const userEntries = (existingAll || []).filter((e) => e.userId === userId);

    // 1. Si suppression d'une entité créée hors ligne et jamais encore synchronisée : annulation mutuelle propre
    const matchingCreateOp = DELETE_TO_CREATE_OP[entry.type];
    if (matchingCreateOp) {
      const unsyncedCreates = userEntries.filter(
        (e) =>
          e.entityId === entry.entityId &&
          (e.status === "pending" || e.status === "failed" || e.status === "auth_paused") &&
          CREATE_OPS.has(e.type)
      );
      if (unsyncedCreates.length > 0) {
        for (const c of unsyncedCreates) {
          store.delete(c.id);
        }
        // Supprimer aussi d'éventuelles mises à jour intermédiaires sur cette entité non synchronisée
        for (const e of userEntries) {
          if (
            e.entityId === entry.entityId &&
            (e.status === "pending" || e.status === "failed" || e.status === "auth_paused")
          ) {
            store.delete(e.id);
          }
        }
        await idbTransactionDone(tx);
        return entry;
      }
    }

    // 2. Coalescence des opérations idempotentes répétées (ex: curseur allocation budget, salaire, préférences)
    if (entry.coalesceKey) {
      const existingCoalesced = userEntries.find(
        (e) =>
          e.coalesceKey === entry.coalesceKey &&
          e.type === entry.type &&
          (e.status === "pending" || e.status === "failed" || e.status === "auth_paused")
      );
      if (existingCoalesced) {
        const merged: OutboxEntry = {
          ...existingCoalesced,
          payload: { ...existingCoalesced.payload, ...entry.payload },
          status: "pending",
          nextRetryAt: now,
          clientUpdatedAt: entry.clientUpdatedAt,
        };
        store.put(merged);
        await idbTransactionDone(tx);
        return merged;
      }
    }

    store.put(entry);
    await idbTransactionDone(tx);
  } catch (err) {
    console.warn("[OfflineDB] Failed to enqueue outbox entry:", err);
  }

  return entry;
}

export async function updateOutboxEntry(
  userId: string,
  id: string,
  patch: Partial<OutboxEntry>
): Promise<void> {
  const db = await openUserOfflineDb(userId);
  if (!db) return;

  try {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const current = await idbRequestToPromise<OutboxEntry | undefined>(store.get(id));
    if (current && current.userId === userId) {
      store.put({ ...current, ...patch });
    }
    await idbTransactionDone(tx);
  } catch {}
}

export async function removeOutboxEntry(userId: string, id: string): Promise<void> {
  const db = await openUserOfflineDb(userId);
  if (!db) return;

  try {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const current = await idbRequestToPromise<OutboxEntry | undefined>(store.get(id));
    if (current && current.userId === userId) {
      store.delete(id);
    }
    await idbTransactionDone(tx);
  } catch {}
}

export async function clearOutboxEntriesForEntity(
  userId: string,
  entityId: string
): Promise<number> {
  const db = await openUserOfflineDb(userId);
  if (!db) return 0;

  let removed = 0;
  try {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const all = await idbRequestToPromise<OutboxEntry[]>(store.getAll());
    for (const item of all || []) {
      if (item.userId === userId && item.entityId === entityId) {
        store.delete(item.id);
        removed++;
      }
    }
    await idbTransactionDone(tx);
  } catch {}
  return removed;
}

export async function recoverInterruptedSyncEntries(userId: string): Promise<number> {
  const db = await openUserOfflineDb(userId);
  if (!db) return 0;

  let recovered = 0;
  try {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const all = await idbRequestToPromise<OutboxEntry[]>(store.getAll());
    for (const item of all || []) {
      if (item.userId === userId && item.status === "syncing") {
        store.put({
          ...item,
          status: "pending",
          nextRetryAt: Date.now(),
        });
        recovered++;
      }
    }
    await idbTransactionDone(tx);
  } catch {}
  return recovered;
}

export async function recordSyncConflict(
  userId: string,
  conflict: Omit<ConflictRecord, "id" | "userId" | "createdAt">
): Promise<ConflictRecord> {
  const fullRecord: ConflictRecord = {
    id: generateUuidV4(),
    userId,
    createdAt: new Date().toISOString(),
    ...conflict,
  };

  const db = await openUserOfflineDb(userId);
  if (!db) return fullRecord;

  try {
    const tx = db.transaction("conflicts", "readwrite");
    const store = tx.objectStore("conflicts");
    const existingAll = await idbRequestToPromise<ConflictRecord[]>(store.getAll());
    const existingPending = (existingAll || []).find(
      (c) =>
        c.userId === userId &&
        !c.resolved &&
        c.entityType === conflict.entityType &&
        c.entityId === conflict.entityId
    );
    const toPersist: ConflictRecord = existingPending
      ? {
          ...existingPending,
          ...conflict,
          id: existingPending.id,
          userId,
          createdAt: existingPending.createdAt,
        }
      : fullRecord;
    store.put(toPersist);
    await idbTransactionDone(tx);
    return toPersist;
  } catch {}

  return fullRecord;
}

export async function listSyncConflicts(
  userId: string,
  onlyUnresolved = false
): Promise<ConflictRecord[]> {
  const db = await openUserOfflineDb(userId);
  if (!db) return [];

  try {
    const tx = db.transaction("conflicts", "readonly");
    const all = await idbRequestToPromise<ConflictRecord[]>(tx.objectStore("conflicts").getAll());
    await idbTransactionDone(tx);
    return (all || [])
      .filter((c) => c.userId === userId)
      .filter((c) => (!onlyUnresolved ? true : !c.resolved))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function resolveSyncConflict(
  userId: string,
  conflictId: string,
  resolution?: ConflictRecord["resolution"]
): Promise<ConflictRecord | null> {
  const db = await openUserOfflineDb(userId);
  if (!db) return null;

  try {
    const tx = db.transaction("conflicts", "readwrite");
    const store = tx.objectStore("conflicts");
    const item = await idbRequestToPromise<ConflictRecord | undefined>(store.get(conflictId));
    let updated: ConflictRecord | null = null;
    if (item && item.userId === userId) {
      updated = {
        ...item,
        resolved: true,
        resolution: resolution ?? item.resolution,
        resolvedAt: new Date().toISOString(),
        resolvedBy: "manual",
      };
      store.put(updated);
    }
    await idbTransactionDone(tx);
    return updated;
  } catch {
    return null;
  }
}

export async function clearResolvedSyncConflicts(userId: string): Promise<number> {
  const db = await openUserOfflineDb(userId);
  if (!db) return 0;

  let removed = 0;
  try {
    const tx = db.transaction("conflicts", "readwrite");
    const store = tx.objectStore("conflicts");
    const all = await idbRequestToPromise<ConflictRecord[]>(store.getAll());
    for (const c of all || []) {
      if (c.userId === userId && c.resolved) {
        store.delete(c.id);
        removed++;
      }
    }
    await idbTransactionDone(tx);
  } catch {}
  return removed;
}

export async function appendOfflineAuditLog(
  userId: string,
  entry: Omit<AuditLogEntry, "id" | "userId" | "timestamp">
): Promise<void> {
  const db = await openUserOfflineDb(userId);
  if (!db) return;

  const record: AuditLogEntry = {
    id: generateUuidV4(),
    userId,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  try {
    const tx = db.transaction("audit_log", "readwrite");
    const store = tx.objectStore("audit_log");
    store.put(record);
    const all = await idbRequestToPromise<AuditLogEntry[]>(store.getAll());
    if (all && all.length > MAX_AUDIT_ENTRIES) {
      const sorted = all.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const excess = sorted.slice(0, all.length - MAX_AUDIT_ENTRIES);
      for (const oldItem of excess) {
        store.delete(oldItem.id);
      }
    }
    await idbTransactionDone(tx);
  } catch {}
}

export async function listOfflineAuditLogs(
  userId: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  const db = await openUserOfflineDb(userId);
  if (!db) return [];

  try {
    const tx = db.transaction("audit_log", "readonly");
    const all = await idbRequestToPromise<AuditLogEntry[]>(tx.objectStore("audit_log").getAll());
    await idbTransactionDone(tx);
    return (all || [])
      .filter((a) => a.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function getOfflineStorageStats(userId: string): Promise<{
  quotaBytes: number | null;
  usageBytes: number | null;
  outboxCount: number;
  failedCount: number;
  conflictCount: number;
  schemaVersion: number;
}> {
  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;

  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      quotaBytes = typeof est.quota === "number" ? est.quota : null;
      usageBytes = typeof est.usage === "number" ? est.usage : null;
    } catch {}
  }

  const outbox = await listOutboxEntries(userId);
  const conflicts = await listSyncConflicts(userId, true);

  return {
    quotaBytes,
    usageBytes,
    outboxCount: outbox.length,
    failedCount: outbox.filter((o) => o.status === "failed" || o.status === "auth_paused").length,
    conflictCount: conflicts.length,
    schemaVersion: OFFLINE_DB_SCHEMA_VERSION,
  };
}

async function computeSha256Hex(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", encoder.encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function exportOfflineBackupPackage(userId: string) {
  const snapshot = await readOfflineSnapshot(userId);
  const outbox = await listOutboxEntries(userId);
  const conflicts = await listSyncConflicts(userId);
  const payloadToHash = JSON.stringify({ snapshot, outbox, conflicts });
  const checksumSha256 = await computeSha256Hex(payloadToHash);

  return {
    version: OFFLINE_DB_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    userId,
    checksumSha256,
    snapshot,
    outbox,
    conflicts,
  };
}

export async function verifyAndRestoreOfflineBackupPackage(
  userId: string,
  pkg: unknown
): Promise<{ ok: boolean; error?: string; restoredMonths: number; restoredOutbox: number }> {
  if (!pkg || typeof pkg !== "object") {
    return { ok: false, error: "Fichier de sauvegarde invalide.", restoredMonths: 0, restoredOutbox: 0 };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = pkg as Record<string, any>;
  if (data.userId && data.userId !== userId) {
    return {
      ok: false,
      error: "Cette sauvegarde appartient à un autre compte utilisateur (isolation de sécurité).",
      restoredMonths: 0,
      restoredOutbox: 0,
    };
  }

  const snapshot = (data.snapshot ?? null) as OfflineSnapshot | null;
  const outbox = Array.isArray(data.outbox) ? (data.outbox as OutboxEntry[]) : [];
  const conflicts = Array.isArray(data.conflicts) ? (data.conflicts as ConflictRecord[]) : [];

  if (data.checksumSha256) {
    const expected = await computeSha256Hex(JSON.stringify({ snapshot, outbox, conflicts }));
    if (expected !== data.checksumSha256) {
      return {
        ok: false,
        error: "Échec du contrôle d'intégrité SHA-256 : le fichier de sauvegarde a été altéré.",
        restoredMonths: 0,
        restoredOutbox: 0,
      };
    }
  }

  if (snapshot) {
    await writeOfflineSnapshot(userId, { ...snapshot, userId });
  }

  const db = await openUserOfflineDb(userId);
  let restoredOutbox = 0;
  if (db) {
    const tx = db.transaction(["outbox", "conflicts"], "readwrite");
    const outboxStore = tx.objectStore("outbox");
    const conflictStore = tx.objectStore("conflicts");
    for (const op of outbox) {
      outboxStore.put({
        ...op,
        userId,
        status: op.status === "syncing" ? "pending" : op.status,
      });
      restoredOutbox++;
    }
    for (const c of conflicts) {
      conflictStore.put({ ...c, userId });
    }
    await idbTransactionDone(tx);
  }

  await appendOfflineAuditLog(userId, {
    level: "info",
    event: "backup_restored",
    details: `${Object.keys(snapshot?.months || {}).length} mois et ${restoredOutbox} opération(s) restaurés.`,
  });

  return {
    ok: true,
    restoredMonths: Object.keys(snapshot?.months || {}).length,
    restoredOutbox,
  };
}

