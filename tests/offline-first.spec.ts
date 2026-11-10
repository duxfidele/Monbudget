import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  appendOfflineAuditLog,
  clearOutboxEntriesForEntity,
  closeAndDeleteUserOfflineDb,
  enqueueOutboxEntry,
  exportOfflineBackupPackage,
  generateUuidV4,
  getOfflineStorageStats,
  getUserOfflineDbName,
  listOfflineAuditLogs,
  listOutboxEntries,
  listSyncConflicts,
  OFFLINE_DB_SCHEMA_VERSION,
  readOfflineSnapshot,
  recoverInterruptedSyncEntries,
  resolveSyncConflict,
  SW_REGISTRY_DB_NAME,
  updateOutboxEntry,
  verifyAndRestoreOfflineBackupPackage,
  writeOfflineSnapshot,
} from "../src/lib/offline/db";
import {
  checkServerReachability,
  ensureValidUuid,
  migrateLegacyCacheToIndexedDb,
  OUTBOX_BACKGROUND_SYNC_TAG,
  processOutboxQueue,
  processServerOfflineSyncBatch,
  reconcileRecordsWithConflictDetection,
} from "../src/lib/offline/sync-engine";
import { GET as healthGet, HEAD as healthHead } from "../src/app/api/health/route";
import { updateSession } from "../src/lib/supabase/middleware";

// ============================================================================
// HARNAIS DETERMINISTE : IndexedDB en mémoire persistante + Supabase simulé
// ============================================================================

type StoreSchema = {
  keyPath: string;
  records: Map<string, unknown>;
};

type DbBacking = {
  version: number;
  stores: Map<string, StoreSchema>;
};

function installPersistentIndexedDbMock() {
  const databases = new Map<string, DbBacking>();

  function createDbHandle(name: string, backing: DbBacking) {
    return {
      name,
      version: backing.version,
      onversionchange: null as null | (() => void),
      onclose: null as null | (() => void),
      objectStoreNames: {
        contains: (storeName: string) => backing.stores.has(storeName),
      },
      createObjectStore: (storeName: string, opts?: { keyPath?: string }) => {
        const schema: StoreSchema = {
          keyPath: opts?.keyPath || "id",
          records: new Map(),
        };
        backing.stores.set(storeName, schema);
        return {
          createIndex: () => ({}),
        };
      },
      transaction: (storeNames: string | string[]) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        let pendingOps = 0;
        let finished = false;
        const tx: Record<string, unknown> = {
          oncomplete: null as null | (() => void),
          onerror: null as null | (() => void),
          onabort: null as null | (() => void),
          error: null,
        };

        const maybeComplete = () => {
          if (!finished && pendingOps === 0) {
            finished = true;
            setTimeout(() => {
              if (typeof tx.oncomplete === "function") {
                (tx.oncomplete as () => void)();
              }
            }, 0);
          }
        };

        // Garantir la complétion même si aucune requête n'est appelée
        setTimeout(maybeComplete, 0);

        tx.objectStore = (storeName: string) => {
          if (!names.includes(storeName)) {
            throw new Error(`Store ${storeName} not in transaction scope`);
          }
          const schema = backing.stores.get(storeName);
          if (!schema) {
            throw new Error(`Store ${storeName} does not exist`);
          }

          const scheduleRequest = <T>(compute: () => T) => {
            pendingOps++;
            const req: {
              result?: T;
              error?: Error;
              onsuccess: null | (() => void);
              onerror: null | (() => void);
            } = {
              onsuccess: null,
              onerror: null,
            };

            queueMicrotask(() => {
              try {
                req.result = compute();
                if (typeof req.onsuccess === "function") {
                  req.onsuccess();
                }
              } catch (err) {
                req.error = err instanceof Error ? err : new Error(String(err));
                tx.error = req.error;
                if (typeof req.onerror === "function") {
                  req.onerror();
                }
              } finally {
                pendingOps--;
                maybeComplete();
              }
            });

            return req;
          };

          return {
            get: (key: string) =>
              scheduleRequest(() => {
                const raw = schema.records.get(String(key));
                return raw === undefined ? undefined : structuredClone(raw);
              }),
            getAll: () =>
              scheduleRequest(() =>
                Array.from(schema.records.values()).map((v) => structuredClone(v))
              ),
            put: (value: Record<string, unknown>) =>
              scheduleRequest(() => {
                const key = String(value[schema.keyPath]);
                schema.records.set(key, structuredClone(value));
                return key;
              }),
            delete: (key: string) =>
              scheduleRequest(() => {
                schema.records.delete(String(key));
                return undefined;
              }),
            clear: () =>
              scheduleRequest(() => {
                schema.records.clear();
                return undefined;
              }),
          };
        };

        return tx;
      },
      close: () => {},
    };
  }

  const fakeIndexedDB = {
    open: (name: string, version = 1) => {
      const req: {
        result?: unknown;
        error?: Error;
        onupgradeneeded: null | ((e: { target: { result: unknown } }) => void);
        onsuccess: null | ((e: { target: { result: unknown } }) => void);
        onerror: null | (() => void);
        onblocked: null | (() => void);
      } = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };

      queueMicrotask(() => {
        let backing = databases.get(name);
        const isUpgrade = !backing || backing.version < version;
        if (!backing) {
          backing = { version, stores: new Map() };
          databases.set(name, backing);
        } else {
          backing.version = version;
        }

        const handle = createDbHandle(name, backing);
        req.result = handle;

        if (isUpgrade && typeof req.onupgradeneeded === "function") {
          req.onupgradeneeded({ target: { result: handle } });
        }
        if (typeof req.onsuccess === "function") {
          req.onsuccess({ target: { result: handle } });
        }
      });

      return req;
    },
    deleteDatabase: (name: string) => {
      const req: {
        onsuccess: null | (() => void);
        onerror: null | (() => void);
        onblocked: null | (() => void);
      } = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      queueMicrotask(() => {
        databases.delete(name);
        if (typeof req.onsuccess === "function") {
          req.onsuccess();
        }
      });
      return req;
    },
  };

  const winObj = (globalThis as Record<string, unknown>).window as
    | Record<string, unknown>
    | undefined;
  if (winObj) {
    winObj.indexedDB = fakeIndexedDB;
  } else {
    (globalThis as Record<string, unknown>).window = {
      indexedDB: fakeIndexedDB,
    };
  }

  return {
    databases,
    resetAll: () => databases.clear(),
  };
}

class MockSupabaseServer {
  tables = new Map<string, Map<string, Record<string, unknown>>>();
  online = true;
  authenticatedUserId: string | null = null;
  sessionExpired = false;
  failNextWrites = 0;
  failStatus: "network" | "server_500" | "auth_expired" = "server_500";
  cutAfterSuccessCount: number | null = null;
  rlsDeniedUpdateTables = new Set<string>();
  successfulWriteCount = 0;
  totalWriteAttempts = 0;

  private getTable(name: string) {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  getRows(tableName: string): Record<string, unknown>[] {
    return Array.from(this.getTable(tableName).values()).map((r) => structuredClone(r));
  }

  private checkFailure(): { message: string; code?: string } | null {
    this.totalWriteAttempts++;
    if (!this.online) {
      return { message: "Failed to fetch: network offline" };
    }
    if (this.failNextWrites > 0) {
      this.failNextWrites--;
      if (this.failStatus === "auth_expired") {
        return { message: "JWT expired (401 Unauthorized)", code: "PGRST301" };
      }
      if (this.failStatus === "network") {
        return { message: "NetworkError when attempting to fetch resource" };
      }
      return { message: "Internal Server Error (500)", code: "500" };
    }
    if (
      this.cutAfterSuccessCount !== null &&
      this.successfulWriteCount >= this.cutAfterSuccessCount
    ) {
      this.online = false;
      return { message: "Connection reset during sync (ECONNRESET)" };
    }
    return null;
  }

  asClient(defaultUserId?: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const server = this;

    return {
      auth: {
        async getUser() {
          if (!server.online) {
            return { data: { user: null }, error: { message: "Network offline" } };
          }
          if (server.sessionExpired) {
            return { data: { user: null }, error: { message: "JWT expired (401)" } };
          }
          const uid = server.authenticatedUserId ?? defaultUserId ?? null;
          return {
            data: { user: uid ? { id: uid } : null },
            error: uid ? null : { message: "Not authenticated" },
          };
        },
        async refreshSession() {
          if (!server.online || server.sessionExpired) {
            return { data: { user: null, session: null }, error: { message: "Refresh token expired" } };
          }
          const uid = server.authenticatedUserId ?? defaultUserId ?? null;
          return {
            data: { user: uid ? { id: uid } : null, session: uid ? { user: { id: uid } } : null },
            error: null,
          };
        },
      },
      from(tableName: string) {
        const filters: Array<(row: Record<string, unknown>) => boolean> = [];
        let limitCount: number | null = null;

        const applyFilters = (rows: Record<string, unknown>[]) => {
          let out = rows.filter((r) => filters.every((fn) => fn(r)));
          if (limitCount !== null) out = out.slice(0, limitCount);
          return out;
        };

        const queryBuilder = {
          select() {
            return queryBuilder;
          },
          eq(col: string, val: unknown) {
            filters.push((r) => r[col] === val);
            return queryBuilder;
          },
          limit(n: number) {
            limitCount = n;
            return queryBuilder;
          },
          async maybeSingle() {
            if (!server.online) {
              return { data: null, error: { message: "Network offline" } };
            }
            const rows = applyFilters(server.getRows(tableName));
            return { data: rows[0] ?? null, error: null };
          },
          then(resolve: (res: { data: Record<string, unknown>[]; error: null }) => void) {
            const rows = applyFilters(server.getRows(tableName));
            resolve({ data: rows, error: null });
          },
          async upsert(
            row: Record<string, unknown>,
            opts?: { onConflict?: string; ignoreDuplicates?: boolean }
          ) {
            const err = server.checkFailure();
            if (err) return { data: null, error: err };

            const table = server.getTable(tableName);
            const conflictCols = (opts?.onConflict || "id").split(",").map((s) => s.trim());
            let key = String(row.id || "");
            if (conflictCols.length > 1 || conflictCols[0] !== "id") {
              key = conflictCols.map((c) => String(row[c] ?? "")).join("::");
            }
            if (!key) key = generateUuidV4();

            const existing = table.get(key);
            if (existing && opts?.ignoreDuplicates) {
              server.successfulWriteCount++;
              return { data: existing, error: null };
            }

            const stored = {
              ...existing,
              ...structuredClone(row),
              id: row.id || existing?.id || generateUuidV4(),
              updated_at: new Date().toISOString(),
            };
            table.set(key, stored);
            server.successfulWriteCount++;
            return { data: stored, error: null };
          },
          insert(row: Record<string, unknown>) {
            const insertedId = String(row.id || generateUuidV4());
            const execInsert = async () => {
              const err = server.checkFailure();
              if (err) return { data: null, error: err };

              const table = server.getTable(tableName);
              const stored = {
                ...structuredClone(row),
                id: insertedId,
                updated_at: new Date().toISOString(),
              };
              table.set(insertedId, stored);
              server.successfulWriteCount++;
              return { data: stored, error: null };
            };

            return {
              select() {
                return {
                  maybeSingle: execInsert,
                  single: execInsert,
                };
              },
              then(resolve: (res: unknown) => void) {
                void execInsert().then(resolve);
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              async eq(col: string, val: unknown) {
                const err = server.checkFailure();
                if (err) return { data: null, error: err };

                if (server.rlsDeniedUpdateTables.has(tableName)) {
                  return {
                    data: null,
                    error: {
                      code: "42501",
                      message: `new row violates row-level security policy for table "${tableName}"`,
                    },
                  };
                }

                const table = server.getTable(tableName);
                for (const [k, r] of table.entries()) {
                  if (r[col] === val) {
                    table.set(k, {
                      ...r,
                      ...structuredClone(patch),
                      updated_at: new Date().toISOString(),
                    });
                  }
                }
                server.successfulWriteCount++;
                return { data: null, error: null };
              },
            };
          },
          delete() {
            return {
              async eq(col: string, val: unknown) {
                const err = server.checkFailure();
                if (err) return { data: null, error: err };

                const table = server.getTable(tableName);
                for (const [k, r] of table.entries()) {
                  if (r[col] === val) {
                    table.delete(k);
                  }
                }
                server.successfulWriteCount++;
                return { data: null, error: null };
              },
            };
          },
        };

        return queryBuilder;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }
}

function setSimulatedConnectivity(options: {
  navigatorOnline: boolean;
  serverReachable: boolean;
}) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: options.navigatorOnline },
  });

  (globalThis as Record<string, unknown>).fetch = async (input: string | URL) => {
    const urlStr = String(input);
    if (urlStr.includes("/api/health")) {
      if (!options.serverReachable) {
        throw new Error("Failed to fetch /api/health");
      }
      return new Response(
        JSON.stringify({
          ok: true,
          service: "monbudget-sync",
          serverTime: new Date().toISOString(),
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    throw new Error(`Unexpected fetch URL in offline test: ${urlStr}`);
  };
}

// ============================================================================
// SUITE DE 12 TESTS DE RÉSISTANCE & STRESS OFFLINE-FIRST
// ============================================================================

test.describe("Architecture Offline-First — Audit, Synchronisation, Conflits & Résilience", () => {
  let idbEnv: ReturnType<typeof installPersistentIndexedDbMock>;

  test.beforeEach(() => {
    idbEnv = installPersistentIndexedDbMock();
    expect(idbEnv.databases.size).toBe(0);
    setSimulatedConnectivity({ navigatorOnline: true, serverReachable: true });
  });

  test("1. Ouverture sans Internet, Service Worker App Shell, BackgroundSync & sonde /api/health", async () => {
    // Vérifier le Service Worker v4, l'App Shell et le support réel de BackgroundSync
    const swPath = path.join(process.cwd(), "public", "sw.js");
    const swSource = fs.readFileSync(swPath, "utf8");
    expect(swSource).toContain("monbudget-cache-v4");
    expect(swSource).toContain(OUTBOX_BACKGROUND_SYNC_TAG);
    expect(swSource).toContain(SW_REGISTRY_DB_NAME);
    expect(swSource).toContain('addEventListener("sync"');
    expect(swSource).toContain("/api/offline/sync");
    expect(swSource).toContain("/dashboard");
    expect(swSource).toContain("/transactions");
    expect(swSource).toContain("/budget");
    expect(swSource).toContain("/savings");
    expect(swSource).toContain("/debts");
    expect(swSource).toContain("/reports");
    expect(swSource).toContain("/settings");
    expect(swSource).toContain("SKIP_WAITING");
    expect(swSource).toContain("WARM_APP_SHELL");

    // Vérifier la route serveur /api/health
    const res = await healthGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("monbudget-sync");

    const headRes = await healthHead();
    expect(headRes.status).toBe(200);

    // Faux positif Wi-Fi captif (navigator.onLine = true mais serveur inaccessible)
    setSimulatedConnectivity({ navigatorOnline: true, serverReachable: false });
    const captiveProbe = await checkServerReachability(500);
    expect(captiveProbe.reachable).toBe(false);

    // Mode avion complet (navigator.onLine = false)
    setSimulatedConnectivity({ navigatorOnline: false, serverReachable: false });
    const offlineProbe = await checkServerReachability(500);
    expect(offlineProbe.reachable).toBe(false);

    // Middleware SSR : ne redirige PAS vers /login si un cookie de session Supabase est présent hors-ligne
    const offlineReq = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "sb-monbudget-auth-token=base64-offline-session-payload",
      },
    });
    const mwRes = await updateSession(offlineReq);
    expect(mwRes.status).toBe(200);
    expect(mwRes.headers.get("location")).toBeNull();
  });

  test("2. Opérations multiples hors-ligne (CRUD complet, coalescence & annulation création+suppression)", async () => {
    const userId = "user-offline-crud-001";
    setSimulatedConnectivity({ navigatorOnline: false, serverReachable: false });

    const catId = ensureValidUuid(null);
    const txKeepId = ensureValidUuid(null);
    const txTempId = ensureValidUuid(null);
    const goalId = ensureValidUuid(null);
    const contribId = ensureValidUuid(null);
    const debtId = ensureValidUuid(null);
    const paymentId = ensureValidUuid(null);

    // 1) Création catégorie + allocations répétées (doivent être coalescées en 1 seule entrée)
    await enqueueOutboxEntry(userId, {
      entityType: "category",
      entityId: catId,
      monthKey: "2026-11",
      type: "upsert_category",
      payload: { id: catId, name: "Alimentation", color: "bg-emerald-500" },
      clientUpdatedAt: new Date().toISOString(),
    });
    await enqueueOutboxEntry(userId, {
      entityType: "allocation",
      entityId: catId,
      monthKey: "2026-11",
      coalesceKey: `alloc:2026-11:${catId}`,
      type: "upsert_allocation",
      payload: { year: 2026, month: 11, categoryId: catId, amount: 45000 },
      clientUpdatedAt: new Date().toISOString(),
    });
    await enqueueOutboxEntry(userId, {
      entityType: "allocation",
      entityId: catId,
      monthKey: "2026-11",
      coalesceKey: `alloc:2026-11:${catId}`,
      type: "upsert_allocation",
      payload: { year: 2026, month: 11, categoryId: catId, amount: 65000 },
      clientUpdatedAt: new Date().toISOString(),
    });

    // 2) Création d'une transaction conservée + d'une transaction temporaire ensuite supprimée hors-ligne
    await enqueueOutboxEntry(userId, {
      entityType: "transaction",
      entityId: txKeepId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: {
        id: txKeepId,
        year: 2026,
        month: 11,
        category_id: catId,
        amount: 12500,
        description: "Marché hebdomadaire",
        transaction_date: "2026-11-10",
        type: "expense",
      },
      clientUpdatedAt: new Date().toISOString(),
    });
    await enqueueOutboxEntry(userId, {
      entityType: "transaction",
      entityId: txTempId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: {
        id: txTempId,
        year: 2026,
        month: 11,
        amount: 3000,
        description: "Erreur de saisie",
        transaction_date: "2026-11-10",
        type: "expense",
      },
      clientUpdatedAt: new Date().toISOString(),
    });
    await enqueueOutboxEntry(userId, {
      entityType: "transaction",
      entityId: txTempId,
      monthKey: "2026-11",
      type: "delete_transaction",
      payload: { id: txTempId },
      clientUpdatedAt: new Date().toISOString(),
    });

    // 3) Épargne + versement, Dette + remboursement, Préférences
    await enqueueOutboxEntry(userId, {
      entityType: "savings_goal",
      entityId: goalId,
      type: "upsert_savings_goal",
      payload: { id: goalId, name: "Fonds d'urgence", target_amount: 500000, current_amount: 0 },
      clientUpdatedAt: new Date().toISOString(),
    });
    await enqueueOutboxEntry(userId, {
      entityType: "savings_contribution",
      entityId: contribId,
      type: "upsert_savings_contribution",
      payload: {
        id: contribId,
        savings_goal_id: goalId,
        amount: 25000,
        newCurrent: 25000,
        goalStatus: "active",
      },
      clientUpdatedAt: new Date().toISOString(),
    });
    await enqueueOutboxEntry(userId, {
      entityType: "debt",
      entityId: debtId,
      type: "upsert_debt",
      payload: {
        id: debtId,
        type: "payable",
        person_name: "Moussa",
        total_amount: 40000,
        remaining_amount: 40000,
      },
      clientUpdatedAt: new Date().toISOString(),
    });
    await enqueueOutboxEntry(userId, {
      entityType: "debt_payment",
      entityId: paymentId,
      type: "upsert_debt_payment",
      payload: {
        id: paymentId,
        debt_id: debtId,
        amount: 15000,
        remainingAmount: 25000,
        debtStatus: "partial",
      },
      clientUpdatedAt: new Date().toISOString(),
    });
    await enqueueOutboxEntry(userId, {
      entityType: "preferences",
      entityId: userId,
      coalesceKey: "preferences",
      type: "update_preferences",
      payload: { currency: "FCFA", alertThreshold: 85 },
      clientUpdatedAt: new Date().toISOString(),
    });

    const outbox = await listOutboxEntries(userId);
    // Vérifier la coalescence (allocation finale = 65000) et l'annulation mutuelle de txTempId
    expect(outbox.some((o) => o.entityId === txTempId)).toBe(false);
    const allocEntries = outbox.filter((o) => o.type === "upsert_allocation");
    expect(allocEntries).toHaveLength(1);
    expect(allocEntries[0].payload.amount).toBe(65000);
    expect(outbox).toHaveLength(8);
  });

  test("3 & 4. Fermeture, réouverture sans connexion et conservation intégrale des opérations", async () => {
    const userId = "user-restart-persistence-002";
    setSimulatedConnectivity({ navigatorOnline: false, serverReachable: false });

    const txId = ensureValidUuid(null);
    await writeOfflineSnapshot(userId, {
      schemaVersion: OFFLINE_DB_SCHEMA_VERSION,
      userId,
      currency: "FCFA",
      payDay: 28,
      alertThreshold: 80,
      months: {
        "2026-11": {
          monthKey: "2026-11",
          baseSalary: 350000,
          income: 350000,
          categories: [{ id: ensureValidUuid(null), name: "Logement", amount: 120000, color: "bg-blue-500" }],
          transactions: [
            {
              id: txId,
              label: "Facture SENELEC",
              amount: 18500,
              category: "Logement",
              date: "2026-11-10",
              type: "expense",
              pendingSync: true,
            },
          ],
        },
      },
      savingsGoals: [],
      debts: [],
      updatedAt: new Date().toISOString(),
    });

    await enqueueOutboxEntry(userId, {
      entityType: "transaction",
      entityId: txId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: {
        id: txId,
        year: 2026,
        month: 11,
        amount: 18500,
        description: "Facture SENELEC",
        transaction_date: "2026-11-10",
        type: "expense",
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    // Simuler une fermeture complète de l'application puis réouverture hors-ligne
    const restoredSnapshot = await readOfflineSnapshot(userId);
    const restoredOutbox = await listOutboxEntries(userId);

    expect(restoredSnapshot).not.toBeNull();
    expect(restoredSnapshot?.months["2026-11"]?.baseSalary).toBe(350000);
    expect(restoredSnapshot?.months["2026-11"]?.transactions).toHaveLength(1);
    expect(restoredSnapshot?.months["2026-11"]?.transactions[0].id).toBe(txId);
    expect(restoredOutbox).toHaveLength(1);
    expect(restoredOutbox[0].entityId).toBe(txId);
    expect(restoredOutbox[0].status).toBe("pending");
  });

  test("5. Rétablissement d'Internet et synchronisation automatique vers le serveur", async () => {
    const userId = "user-reconnect-sync-003";
    const mockServer = new MockSupabaseServer();
    mockServer.online = false;
    setSimulatedConnectivity({ navigatorOnline: false, serverReachable: false });

    const catId = ensureValidUuid(null);
    const txId = ensureValidUuid(null);

    await enqueueOutboxEntry(userId, {
      entityType: "category",
      entityId: catId,
      monthKey: "2026-11",
      type: "upsert_category",
      payload: { id: catId, name: "Transport", color: "bg-sky-500" },
      clientUpdatedAt: new Date().toISOString(),
    });
    await enqueueOutboxEntry(userId, {
      entityType: "transaction",
      entityId: txId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: {
        id: txId,
        year: 2026,
        month: 11,
        category_id: catId,
        amount: 5000,
        description: "Taxi",
        transaction_date: "2026-11-10",
        type: "expense",
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    // Tentative pendant la coupure : rien n'est perdu ni supprimé
    const offlineAttempt = await processOutboxQueue(mockServer.asClient(), userId);
    expect(offlineAttempt.status).toBe("offline");
    expect(offlineAttempt.pending).toBe(2);
    expect((await listOutboxEntries(userId)).length).toBe(2);

    // Rétablissement de la connexion Internet
    mockServer.online = true;
    setSimulatedConnectivity({ navigatorOnline: true, serverReachable: true });

    const onlineResult = await processOutboxQueue(mockServer.asClient(userId), userId);
    expect(onlineResult.status).toBe("idle");
    expect(onlineResult.synced).toBe(2);
    expect(onlineResult.pending).toBe(0);
    expect((await listOutboxEntries(userId)).length).toBe(0);

    // Vérifier la création automatique du budget mensuel parent + catégorie + transaction
    expect(mockServer.getRows("monthly_budgets")).toHaveLength(1);
    expect(mockServer.getRows("categories")).toHaveLength(1);
    expect(mockServer.getRows("transactions")).toHaveLength(1);
    expect(mockServer.getRows("transactions")[0].id).toBe(txId);
  });

  test("6 & 7. Coupure Internet pendant une synchronisation : zéro perte et zéro duplication", async () => {
    const userId = "user-mid-sync-cut-004";
    const mockServer = new MockSupabaseServer();
    const budgetId = ensureValidUuid(null);
    mockServer.tables.set(
      "monthly_budgets",
      new Map([[budgetId, { id: budgetId, user_id: userId, year: 2026, month: 11 }]])
    );

    const txIds = Array.from({ length: 6 }, () => ensureValidUuid(null));
    for (let i = 0; i < txIds.length; i++) {
      await enqueueOutboxEntry(userId, {
        entityType: "transaction",
        entityId: txIds[i],
        monthKey: "2026-11",
        type: "upsert_transaction",
        payload: {
          id: txIds[i],
          monthly_budget_id: budgetId,
          amount: (i + 1) * 1000,
          description: `Opération #${i + 1}`,
          transaction_date: "2026-11-10",
          type: "expense",
        },
        clientUpdatedAt: new Date(Date.now() + i).toISOString(),
      });
    }

    // Simuler une entrée bloquée en état "syncing" suite à un crash brutal de l'onglet
    const preEntries = await listOutboxEntries(userId);
    await updateOutboxEntry(userId, preEntries[0].id, { status: "syncing" });
    const recoveredCount = await recoverInterruptedSyncEntries(userId);
    expect(recoveredCount).toBe(1);

    // Couper le réseau après exactement 2 écritures réussies sur 6
    mockServer.cutAfterSuccessCount = 2;
    const interruptedResult = await processOutboxQueue(mockServer.asClient(userId), userId);
    expect(interruptedResult.status).toBe("offline");
    expect(interruptedResult.synced).toBe(2);
    expect(interruptedResult.pending).toBe(4);
    expect(mockServer.getRows("transactions")).toHaveLength(2);

    // Rétablir la connexion et relancer la synchronisation
    mockServer.cutAfterSuccessCount = null;
    mockServer.online = true;
    setSimulatedConnectivity({ navigatorOnline: true, serverReachable: true });

    const resumedResult = await processOutboxQueue(mockServer.asClient(userId), userId, { force: true });
    expect(resumedResult.status).toBe("idle");
    expect(resumedResult.synced).toBe(4);
    expect(resumedResult.pending).toBe(0);

    // Vérifier : exactement 6 transactions sur le serveur, 0 perte, 0 doublon
    const serverTxs = mockServer.getRows("transactions");
    expect(serverTxs).toHaveLength(6);
    const uniqueIds = new Set(serverTxs.map((r) => String(r.id)));
    expect(uniqueIds.size).toBe(6);
  });

  test("8. Modifications simultanées sur deux appareils & détection/résolution des conflits", async () => {
    const userId = "user-conflict-2devices-005";
    const sharedTxId = ensureValidUuid(null);
    const pendingLocalTxId = ensureValidUuid(null);

    await enqueueOutboxEntry(userId, {
      entityType: "transaction",
      entityId: sharedTxId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: { id: sharedTxId, amount: 24000, description: "Courses Carrefour (Appareil Mobile)" },
      clientUpdatedAt: "2026-11-10T10:05:00.000Z",
    });
    await enqueueOutboxEntry(userId, {
      entityType: "transaction",
      entityId: pendingLocalTxId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: { id: pendingLocalTxId, amount: 9500, description: "Modification locale non encore synchronisée" },
      clientUpdatedAt: "2026-11-10T10:06:00.000Z",
    });

    const pendingOutbox = await listOutboxEntries(userId);

    const localItems = [
      {
        id: sharedTxId,
        label: "Courses Carrefour (Appareil Mobile)",
        amount: 24000,
        category: "Alimentation",
        date: "2026-11-10",
        type: "expense",
        updatedAt: "2026-11-10T10:05:00.000Z",
      },
      {
        id: pendingLocalTxId,
        label: "Modification locale non encore synchronisée",
        amount: 9500,
        category: "Transport",
        date: "2026-11-10",
        type: "expense",
        updatedAt: "2026-11-10T10:06:00.000Z",
      },
    ];

    // Appareil B (Desktop) a modifié sharedTxId plus récemment et n'a pas encore reçu pendingLocalTxId
    const remoteItems = [
      {
        id: sharedTxId,
        label: "Courses Carrefour (Desktop mis à jour)",
        amount: 26500,
        category: "Alimentation",
        date: "2026-11-10",
        type: "expense",
        updatedAt: "2026-11-10T10:09:00.000Z",
      },
    ];

    const reconciled = await reconcileRecordsWithConflictDetection({
      userId,
      entityType: "transaction",
      monthKey: "2026-11",
      localItems,
      remoteItems,
      pendingOutbox,
      lastSyncedAt: "2026-11-10T10:00:00.000Z",
      getLabel: (r) => r.label,
    });

    // Deuxième passe de réconciliation avant révision : le conflit reste dédupliqué
    await reconcileRecordsWithConflictDetection({
      userId,
      entityType: "transaction",
      monthKey: "2026-11",
      localItems,
      remoteItems,
      pendingOutbox,
      lastSyncedAt: "2026-11-10T10:00:00.000Z",
      getLabel: (r) => r.label,
    });

    // Le conflit sur sharedTxId est détecté et conservé en attente de révision manuelle (resolved: false)
    const conflicts = await listSyncConflicts(userId, false);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].entityId).toBe(sharedTxId);
    expect(conflicts[0].conflictType).toBe("edit_vs_edit");
    expect(conflicts[0].monthKey).toBe("2026-11");
    expect(conflicts[0].resolution).toBe("remote_wins");
    expect(conflicts[0].resolved).toBe(false);
    expect((await listSyncConflicts(userId, true)).length).toBe(1);

    // La version la plus récente (Desktop 26 500) est retenue ET pendingLocalTxId n'est PAS écrasé silencieusement
    expect(reconciled).toHaveLength(2);
    const mergedShared = reconciled.find((m) => m.id === sharedTxId);
    const mergedPending = reconciled.find((m) => m.id === pendingLocalTxId);
    expect(mergedShared?.amount).toBe(26500);
    expect(mergedPending).toBeDefined();

    // Résolution manuelle : l'utilisateur valide finalement son choix dans Paramètres
    const resolvedConflict = await resolveSyncConflict(userId, conflicts[0].id, "local_wins");
    expect(resolvedConflict?.resolved).toBe(true);
    expect(resolvedConflict?.resolution).toBe("local_wins");
    expect(resolvedConflict?.resolvedBy).toBe("manual");
    expect((await listSyncConflicts(userId, true)).length).toBe(0);
  });

  test("9. Expiration de session pendant une période hors-ligne : pause sûre puis reprise après reconnexion", async () => {
    const userId = "user-expired-session-006";
    const mockServer = new MockSupabaseServer();
    const budgetId = ensureValidUuid(null);
    mockServer.tables.set(
      "monthly_budgets",
      new Map([[budgetId, { id: budgetId, user_id: userId, year: 2026, month: 11 }]])
    );

    const txId = ensureValidUuid(null);
    await enqueueOutboxEntry(userId, {
      entityType: "transaction",
      entityId: txId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: {
        id: txId,
        monthly_budget_id: budgetId,
        amount: 14000,
        description: "Pharmacie",
        transaction_date: "2026-11-10",
        type: "expense",
      },
      clientUpdatedAt: new Date().toISOString(),
    });

    // Le serveur rejette la requête car le JWT a expiré pendant la période hors-ligne
    mockServer.sessionExpired = true;

    const expiredResult = await processOutboxQueue(mockServer.asClient(userId), userId);
    expect(expiredResult.status).toBe("auth_expired");
    expect(expiredResult.pending).toBe(1);

    // L'opération est mise en pause propre ("auth_paused") et jamais supprimée
    const pausedEntries = await listOutboxEntries(userId);
    expect(pausedEntries).toHaveLength(1);
    expect(pausedEntries[0].status).toBe("auth_paused");

    // Après reconnexion de l'utilisateur, la synchronisation reprend et enregistre la transaction
    mockServer.sessionExpired = false;
    const recoveredResult = await processOutboxQueue(mockServer.asClient(userId), userId, { force: true });
    expect(recoveredResult.status).toBe("idle");
    expect(recoveredResult.synced).toBe(1);
    expect(recoveredResult.pending).toBe(0);
    expect(mockServer.getRows("transactions")).toHaveLength(1);
  });

  test("10. Volume important en attente (120 opérations), statistiques stockage & sauvegarde SHA-256", async () => {
    const userId = "user-high-volume-007";
    const mockServer = new MockSupabaseServer();
    const budgetId = ensureValidUuid(null);
    mockServer.tables.set(
      "monthly_budgets",
      new Map([[budgetId, { id: budgetId, user_id: userId, year: 2026, month: 11 }]])
    );

    // Enregistrer 120 opérations hors-ligne
    for (let i = 0; i < 120; i++) {
      const txId = ensureValidUuid(null);
      await enqueueOutboxEntry(userId, {
        entityType: "transaction",
        entityId: txId,
        monthKey: "2026-11",
        type: "upsert_transaction",
        payload: {
          id: txId,
          monthly_budget_id: budgetId,
          amount: 500 + i * 10,
          description: `Lot haute volumétrie #${i + 1}`,
          transaction_date: "2026-11-10",
          type: "expense",
        },
        clientUpdatedAt: new Date(Date.now() + i).toISOString(),
      });
    }

    const statsBefore = await getOfflineStorageStats(userId);
    expect(statsBefore.outboxCount).toBe(120);

    // Tester l'export et la vérification d'intégrité SHA-256 avant synchronisation
    const backupPkg = await exportOfflineBackupPackage(userId);
    expect(backupPkg.checksumSha256).toHaveLength(64);
    expect(backupPkg.outbox).toHaveLength(120);

    // Altération détectée par SHA-256
    const tamperedJson = JSON.stringify({
      ...backupPkg,
      outbox: backupPkg.outbox.slice(0, 10),
    });
    const tamperedResult = await verifyAndRestoreOfflineBackupPackage(userId, tamperedJson);
    expect(tamperedResult.ok).toBe(false);

    // Synchronisation complète des 120 opérations
    const syncResult = await processOutboxQueue(mockServer.asClient(userId), userId);
    expect(syncResult.status).toBe("idle");
    expect(syncResult.synced).toBe(120);
    expect(syncResult.pending).toBe(0);
    expect(mockServer.getRows("transactions")).toHaveLength(120);
  });

  test("11. Isolation stricte des données entre utilisateurs différents & purge à la déconnexion", async () => {
    const userA = "user-alpha-isolation-008";
    const userB = "user-beta-isolation-009";

    expect(getUserOfflineDbName(userA)).not.toBe(getUserOfflineDbName(userB));

    const secretTxId = ensureValidUuid(null);
    await writeOfflineSnapshot(userA, {
      schemaVersion: OFFLINE_DB_SCHEMA_VERSION,
      userId: userA,
      currency: "FCFA",
      payDay: 25,
      alertThreshold: 80,
      months: {
        "2026-11": {
          monthKey: "2026-11",
          baseSalary: 900000,
          income: 900000,
          categories: [],
          transactions: [
            {
              id: secretTxId,
              label: "Salaire confidentiel Utilisateur A",
              amount: 900000,
              category: "Revenu",
              date: "2026-11-10",
              type: "income",
            },
          ],
        },
      },
      savingsGoals: [],
      debts: [],
      updatedAt: new Date().toISOString(),
    });

    await enqueueOutboxEntry(userA, {
      entityType: "transaction",
      entityId: secretTxId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: { id: secretTxId, amount: 900000, description: "Secret A" },
      clientUpdatedAt: new Date().toISOString(),
    });

    // L'utilisateur B sur le même navigateur ne voit strictement aucune donnée de A
    const snapshotB = await readOfflineSnapshot(userB);
    const outboxB = await listOutboxEntries(userB);
    expect(snapshotB).toBeNull();
    expect(outboxB).toHaveLength(0);

    // Déconnexion de A : suppression propre de sa base IndexedDB dédiée
    await closeAndDeleteUserOfflineDb(userA);
    expect(await readOfflineSnapshot(userA)).toBeNull();
    expect((await listOutboxEntries(userA)).length).toBe(0);
  });

  test("12. Récupération après erreur serveur (HTTP 500), backoff exponentiel et migration cache legacy", async () => {
    const userId = "user-server-500-recovery-010";
    const mockServer = new MockSupabaseServer();
    const budgetId = ensureValidUuid(null);
    mockServer.tables.set(
      "monthly_budgets",
      new Map([[budgetId, { id: budgetId, user_id: userId, year: 2026, month: 11 }]])
    );

    // Tester aussi la migration sans perte d'un ancien cache localStorage
    await migrateLegacyCacheToIndexedDb(userId, {
      currency: "FCFA",
      payDay: 28,
      alertThreshold: 80,
      months: {},
      savingsGoals: [],
      pendingSyncQueue: [
        {
          id: "legacy-sync-1",
          type: "add_transaction",
          timestamp: Date.now(),
          payload: {
            monthly_budget_id: budgetId,
            amount: 8500,
            description: "Transaction migrée depuis legacy cache",
            transaction_date: "2026-11-10",
            type: "expense",
          },
        },
      ],
    });

    const migratedOutbox = await listOutboxEntries(userId);
    expect(migratedOutbox).toHaveLength(1);

    // Simuler 2 erreurs HTTP 500 consécutives côté serveur
    mockServer.failNextWrites = 2;
    mockServer.failStatus = "server_500";

    const firstFail = await processOutboxQueue(mockServer.asClient(userId), userId);
    expect(firstFail.status).toBe("error");
    expect(firstFail.failed).toBe(1);
    expect(firstFail.pending).toBe(1);

    const afterFirstFail = await listOutboxEntries(userId);
    expect(afterFirstFail).toHaveLength(1);
    expect(afterFirstFail[0].status).toBe("failed");
    expect(afterFirstFail[0].retryCount).toBe(1);
    expect(afterFirstFail[0].nextRetryAt).toBeGreaterThan(Date.now());

    // Sans force=true, le backoff protège le serveur contre le martèlement
    const throttledRun = await processOutboxQueue(mockServer.asClient(userId), userId, { force: false });
    expect(throttledRun.pending).toBe(1);

    // Le serveur se rétablit et une relance (force=true) synchronise l'opération
    mockServer.failNextWrites = 0;
    await appendOfflineAuditLog(userId, {
      level: "info",
      event: "manual_retry_triggered",
      details: "Relance manuelle après rétablissement serveur",
    });
    const logs = await listOfflineAuditLogs(userId);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const finalRecovery = await processOutboxQueue(mockServer.asClient(userId), userId, { force: true });
    expect(finalRecovery.status).toBe("idle");
    expect(finalRecovery.synced).toBe(1);
    expect(finalRecovery.pending).toBe(0);
    expect(mockServer.getRows("transactions")).toHaveLength(1);
    expect(mockServer.getRows("transactions")[0].description).toBe(
      "Transaction migrée depuis legacy cache"
    );
  });

  test("13. Suppression logique multi-appareils (deleted_at IS NULL), repli RLS & conflit Suppression vs Édition", async () => {
    const userId = "user-soft-delete-multidevice-011";
    const mockServer = new MockSupabaseServer();
    const budgetId = ensureValidUuid(null);
    mockServer.tables.set(
      "monthly_budgets",
      new Map([[budgetId, { id: budgetId, user_id: userId, year: 2026, month: 11 }]])
    );

    const txId = ensureValidUuid(null);
    mockServer.tables.set(
      "transactions",
      new Map([
        [
          txId,
          {
            id: txId,
            monthly_budget_id: budgetId,
            amount: 15000,
            description: "Carburant Moto",
            transaction_date: "2026-11-10",
            type: "expense",
            deleted_at: null,
            updated_at: "2026-11-10T09:00:00.000Z",
          },
        ],
      ])
    );

    // 1) Appareil A supprime la transaction -> soft-delete avec deleted_at non nul (pas de DELETE physique)
    await enqueueOutboxEntry(userId, {
      entityType: "transaction",
      entityId: txId,
      monthKey: "2026-11",
      type: "delete_transaction",
      payload: { id: txId },
      clientUpdatedAt: "2026-11-10T10:15:00.000Z",
    });

    const delRes = await processOutboxQueue(mockServer.asClient(userId), userId);
    expect(delRes.status).toBe("idle");
    expect(delRes.synced).toBe(1);

    const serverRows = mockServer.getRows("transactions");
    expect(serverRows).toHaveLength(1);
    expect(serverRows[0].deleted_at).toBe("2026-11-10T10:15:00.000Z");

    // 2) Sur un Appareil B sans modif concurrente, la pierre tombale fait disparaître l'item silencieusement
    const cleanDeviceB = await reconcileRecordsWithConflictDetection({
      userId: `${userId}-cleanB`,
      entityType: "transaction",
      monthKey: "2026-11",
      remoteItems: [
        {
          id: txId,
          label: "Carburant Moto",
          amount: 15000,
          category: "Transport",
          date: "2026-11-10",
          type: "expense",
          updatedAt: "2026-11-10T10:15:00.000Z",
          deletedAt: "2026-11-10T10:15:00.000Z",
        },
      ],
      localItems: [
        {
          id: txId,
          label: "Carburant Moto",
          amount: 15000,
          category: "Transport",
          date: "2026-11-10",
          type: "expense",
        },
      ],
      pendingOutbox: [],
      lastSyncedAt: "2026-11-10T09:30:00.000Z",
      getLabel: (r) => r.label,
    });
    expect(cleanDeviceB).toHaveLength(0);
    expect(await listSyncConflicts(`${userId}-cleanB`, true)).toHaveLength(0);

    // 3) Sur un Appareil C ayant édité hors-ligne AVANT la suppression serveur -> delete_vs_edit sans résurrection
    const userDeviceC = `${userId}-conflictC`;
    await enqueueOutboxEntry(userDeviceC, {
      entityType: "transaction",
      entityId: txId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: { id: txId, amount: 18000, description: "Carburant Moto (édité hors ligne)" },
      clientUpdatedAt: "2026-11-10T10:05:00.000Z",
    });
    const outboxC = await listOutboxEntries(userDeviceC);

    const reconciledC = await reconcileRecordsWithConflictDetection({
      userId: userDeviceC,
      entityType: "transaction",
      monthKey: "2026-11",
      remoteItems: [
        {
          id: txId,
          label: "Carburant Moto",
          amount: 15000,
          category: "Transport",
          date: "2026-11-10",
          type: "expense",
          updatedAt: "2026-11-10T10:15:00.000Z",
          deletedAt: "2026-11-10T10:15:00.000Z",
        },
      ],
      localItems: [
        {
          id: txId,
          label: "Carburant Moto (édité hors ligne)",
          amount: 18000,
          category: "Transport",
          date: "2026-11-10",
          type: "expense",
        },
      ],
      pendingOutbox: outboxC,
      lastSyncedAt: "2026-11-10T09:30:00.000Z",
      getLabel: (r) => r.label,
    });

    // La suppression plus récente gagne côté actif (aucune résurrection), ET un conflit révisable est journalisé
    expect(reconciledC).toHaveLength(0);
    const conflictsC = await listSyncConflicts(userDeviceC, true);
    expect(conflictsC).toHaveLength(1);
    expect(conflictsC[0].conflictType).toBe("delete_vs_edit");
    expect(conflictsC[0].resolution).toBe("delete_wins");
    expect(conflictsC[0].remoteData._deleted).toBe(true);
    expect(conflictsC[0].resolved).toBe(false);

    // 4) Restauration manuelle choisissant la version locale : ré-upsert doit remettre deleted_at = null
    await clearOutboxEntriesForEntity(userDeviceC, txId);
    await enqueueOutboxEntry(userDeviceC, {
      entityType: "transaction",
      entityId: txId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: {
        id: txId,
        monthly_budget_id: budgetId,
        amount: 18000,
        description: "Carburant Moto restauré",
        transaction_date: "2026-11-10",
        type: "expense",
      },
      clientUpdatedAt: "2026-11-10T10:25:00.000Z",
    });
    mockServer.authenticatedUserId = userDeviceC;
    await processOutboxQueue(mockServer.asClient(userDeviceC), userDeviceC);
    const restoredRows = mockServer.getRows("transactions");
    expect(restoredRows[0].deleted_at).toBeNull();
    expect(restoredRows[0].amount).toBe(18000);

    // 5) Repli sécurisé vers DELETE physique si UPDATE est refusé par RLS (42501 sur table payante expirée)
    const goalId = ensureValidUuid(null);
    mockServer.tables.set(
      "savings_goals",
      new Map([[goalId, { id: goalId, user_id: userId, name: "Voyage", target_amount: 100000 }]])
    );
    mockServer.rlsDeniedUpdateTables.add("savings_goals");
    mockServer.authenticatedUserId = userId;
    await enqueueOutboxEntry(userId, {
      entityType: "savings_goal",
      entityId: goalId,
      type: "delete_savings_goal",
      payload: { id: goalId },
      clientUpdatedAt: new Date().toISOString(),
    });
    const fallbackDelRes = await processOutboxQueue(mockServer.asClient(userId), userId);
    expect(fallbackDelRes.status).toBe("idle");
    expect(fallbackDelRes.synced).toBe(1);
    expect(mockServer.getRows("savings_goals")).toHaveLength(0);
  });

  test("14. BackgroundSync serveur (/api/offline/sync), isolation inter-comptes, expiration session & UI révision", async () => {
    const legitimateUser = "user-bg-sync-legit-012";
    const attackerUser = "user-bg-sync-attacker-999";
    const mockServer = new MockSupabaseServer();
    const budgetId = ensureValidUuid(null);
    mockServer.tables.set(
      "monthly_budgets",
      new Map([[budgetId, { id: budgetId, user_id: legitimateUser, year: 2026, month: 11 }]])
    );

    const txId = ensureValidUuid(null);
    const hijackedTxId = ensureValidUuid(null);

    await enqueueOutboxEntry(legitimateUser, {
      entityType: "transaction",
      entityId: txId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: {
        id: txId,
        monthly_budget_id: budgetId,
        amount: 22000,
        description: "Facture Eau (BackgroundSync)",
        transaction_date: "2026-11-10",
        type: "expense",
      },
      clientUpdatedAt: new Date().toISOString(),
    });
    await enqueueOutboxEntry(legitimateUser, {
      entityType: "transaction",
      entityId: hijackedTxId,
      monthKey: "2026-11",
      type: "upsert_transaction",
      payload: { id: hijackedTxId, amount: 999999, description: "Tentative inter-comptes" },
      clientUpdatedAt: new Date().toISOString(),
    });

    // Simuler une entrée falsifiée avec un autre userId dans le lot envoyé à processServerOfflineSyncBatch
    const entries = await listOutboxEntries(legitimateUser);
    expect(entries).toHaveLength(2);
    const mixedBatch = [
      entries[0],
      { ...entries[1], userId: attackerUser },
    ];

    const batchRes = await processServerOfflineSyncBatch(
      mockServer.asClient(legitimateUser),
      legitimateUser,
      mixedBatch
    );

    expect(batchRes.syncedIds).toEqual([entries[0].id]);
    expect(batchRes.failed).toHaveLength(1);
    expect(batchRes.failed[0].id).toBe(entries[1].id);
    expect(batchRes.failed[0].error).toContain("isolation");
    expect(batchRes.authExpired).toBe(false);
    expect(mockServer.getRows("transactions")).toHaveLength(1);
    expect(mockServer.getRows("transactions")[0].id).toBe(txId);

    // Vérifier la gestion propre d'expiration de session côté batch BackgroundSync
    mockServer.failNextWrites = 1;
    mockServer.failStatus = "auth_expired";
    const expiredBatchRes = await processServerOfflineSyncBatch(
      mockServer.asClient(legitimateUser),
      legitimateUser,
      [entries[0]]
    );
    expect(expiredBatchRes.authExpired).toBe(true);
    expect(expiredBatchRes.syncedIds).toHaveLength(0);
    expect(expiredBatchRes.failed[0].authExpired).toBe(true);

    // Vérifier clearOutboxEntriesForEntity sur une entité précise
    await clearOutboxEntriesForEntity(legitimateUser, hijackedTxId);
    const remainingAfterClear = await listOutboxEntries(legitimateUser);
    expect(remainingAfterClear.some((e) => e.entityId === hijackedTxId)).toBe(false);
    expect(remainingAfterClear.some((e) => e.entityId === txId)).toBe(true);

    // Vérifier la présence effective du handler API /api/offline/sync et du panneau de révision dans Paramètres
    const routeSrc = fs.readFileSync(
      path.join(process.cwd(), "src", "app", "api", "offline", "sync", "route.ts"),
      "utf8"
    );
    expect(routeSrc).toContain("processServerOfflineSyncBatch");
    expect(routeSrc).toContain("AUTH_EXPIRED");

    const settingsSrc = fs.readFileSync(
      path.join(process.cwd(), "src", "app", "(dashboard)", "settings", "page.tsx"),
      "utf8"
    );
    expect(settingsSrc).toContain("conflicts-review");
    expect(settingsSrc).toContain("resolveConflictChoice");

    const networkStatusSrc = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "pwa", "network-status.tsx"),
      "utf8"
    );
    expect(networkStatusSrc).toContain("/settings?tab=security#conflicts-review");
  });
});
