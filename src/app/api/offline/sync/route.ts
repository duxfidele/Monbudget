import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OutboxEntry } from "@/lib/offline/db";
import { processServerOfflineSyncBatch } from "@/lib/offline/sync-engine";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          ok: false,
          code: "AUTH_EXPIRED",
          error: "Session expirée ou non authentifiée.",
          syncedIds: [],
          failed: [],
          authExpired: true,
        },
        {
          status: 401,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        }
      );
    }

    const body = await request.json().catch(() => null);
    const entries = Array.isArray(body?.entries) ? (body.entries as OutboxEntry[]) : [];

    if (entries.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          syncedIds: [],
          failed: [],
          authExpired: false,
          serverTime: new Date().toISOString(),
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        }
      );
    }

    const result = await processServerOfflineSyncBatch(supabase, user.id, entries);

    return NextResponse.json(
      {
        ok: result.failed.length === 0 && !result.authExpired,
        ...result,
      },
      {
        status: result.authExpired ? 401 : 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erreur serveur lors de la synchronisation hors-ligne.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        syncedIds: [],
        failed: [],
        authExpired: false,
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  }
}

