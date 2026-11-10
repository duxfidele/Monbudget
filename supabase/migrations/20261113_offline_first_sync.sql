-- =============================================================================
-- Migration 20261113 : Renforcement Offline-First (Synchronisation Incrémentale,
-- Idempotence via client_op_id, Horodatage serveur updated_at & Soft-Delete)
-- 100% additive et non destructrice (préserve toutes les données et politiques RLS).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_offline_sync_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  IF TG_OP = 'UPDATE' THEN
    NEW.sync_version := COALESCE(OLD.sync_version, 1) + 1;
  ELSE
    NEW.sync_version := COALESCE(NEW.sync_version, 1);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'profiles',
    'categories',
    'monthly_budgets',
    'income_entries',
    'budget_allocations',
    'transactions',
    'savings_goals',
    'savings_contributions',
    'debts',
    'debt_payments'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone(''utc''::text, now()) NOT NULL',
        v_table
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS client_op_id TEXT',
        v_table
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1 NOT NULL',
        v_table
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ',
        v_table
      );

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (updated_at)',
        'idx_' || v_table || '_updated_at',
        v_table
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (client_op_id) WHERE client_op_id IS NOT NULL',
        'idx_' || v_table || '_client_op_id',
        v_table
      );

      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON public.%I',
        'trg_' || v_table || '_offline_sync_updated_at',
        v_table
      );
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_offline_sync_updated_at()',
        'trg_' || v_table || '_offline_sync_updated_at',
        v_table
      );
    END IF;
  END LOOP;
END $$;

