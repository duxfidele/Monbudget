-- =============================================================================
-- Migration 20261115 : Module Investissements & Suivi des Rendements (ROI)
-- Objectifs :
--   1. Créer les tables public.investments et public.investment_operations
--   2. Inclure les colonnes Offline-First (updated_at, client_op_id, sync_version, deleted_at)
--   3. Appliquer le verrouillage RLS par plan : accessible pendant les 30 jours
--      d'essai gratuit et sur les plans payants (Particulier 500F / Entreprise),
--      cadenassé en écriture sur l'abonnement Gratuit après les 30 jours.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE
  v_profile_id_type TEXT;
  v_investment_id_type TEXT;
BEGIN
  SELECT CASE WHEN data_type = 'uuid' THEN 'UUID' ELSE 'TEXT' END
  INTO v_profile_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id';

  v_profile_id_type := COALESCE(v_profile_id_type, 'UUID');

  -- 1. Table principale des projets d'investissement
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'investments'
  ) THEN
    EXECUTE format('
      CREATE TABLE public.investments (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id %s REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT ''Commerce & Boutique'',
        invested_amount DECIMAL NOT NULL DEFAULT 0 CHECK (invested_amount >= 0),
        target_amount DECIMAL NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
        expected_return_rate DECIMAL NOT NULL DEFAULT 15 CHECK (expected_return_rate >= 0),
        total_returns DECIMAL NOT NULL DEFAULT 0 CHECK (total_returns >= 0),
        start_date DATE DEFAULT CURRENT_DATE,
        status TEXT NOT NULL DEFAULT ''active'' CHECK (status IN (''active'', ''completed'', ''paused'')),
        color TEXT DEFAULT ''bg-indigo-600'',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT timezone(''utc''::text, now()) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT timezone(''utc''::text, now()) NOT NULL,
        client_op_id TEXT,
        sync_version INTEGER DEFAULT 1 NOT NULL,
        deleted_at TIMESTAMPTZ
      )', v_profile_id_type);
  END IF;

  SELECT CASE WHEN data_type = 'uuid' THEN 'UUID' ELSE 'TEXT' END
  INTO v_investment_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'investments' AND column_name = 'id';

  v_investment_id_type := COALESCE(v_investment_id_type, 'UUID');

  -- 2. Table de l'historique des opérations d'investissement (placements de capital & encaissements de gains)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'investment_operations'
  ) THEN
    EXECUTE format('
      CREATE TABLE public.investment_operations (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        investment_id %s REFERENCES public.investments(id) ON DELETE CASCADE NOT NULL,
        type TEXT NOT NULL CHECK (type IN (''capital_outflow'', ''return_inflow'')),
        amount DECIMAL NOT NULL CHECK (amount > 0),
        operation_date DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        linked_transaction_id TEXT,
        created_at TIMESTAMPTZ DEFAULT timezone(''utc''::text, now()) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT timezone(''utc''::text, now()) NOT NULL,
        client_op_id TEXT,
        sync_version INTEGER DEFAULT 1 NOT NULL,
        deleted_at TIMESTAMPTZ
      )', v_investment_id_type);
  END IF;
END $$;

-- 3. Index de performance et de synchronisation hors-ligne
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments (user_id);
CREATE INDEX IF NOT EXISTS idx_investments_updated_at ON public.investments (updated_at);
CREATE INDEX IF NOT EXISTS idx_investments_client_op_id ON public.investments (client_op_id) WHERE client_op_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_investment_operations_investment_id ON public.investment_operations (investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_operations_updated_at ON public.investment_operations (updated_at);
CREATE INDEX IF NOT EXISTS idx_investment_operations_client_op_id ON public.investment_operations (client_op_id) WHERE client_op_id IS NOT NULL;

-- 4. Triggers automatiques updated_at & sync_version
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_offline_sync_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_investments_offline_sync_updated_at ON public.investments;
    CREATE TRIGGER trg_investments_offline_sync_updated_at
      BEFORE INSERT OR UPDATE ON public.investments
      FOR EACH ROW EXECUTE FUNCTION public.set_offline_sync_updated_at();

    DROP TRIGGER IF EXISTS trg_investment_operations_offline_sync_updated_at ON public.investment_operations;
    CREATE TRIGGER trg_investment_operations_offline_sync_updated_at
      BEFORE INSERT OR UPDATE ON public.investment_operations
      FOR EACH ROW EXECUTE FUNCTION public.set_offline_sync_updated_at();
  END IF;
END $$;

-- 5. Politiques Row Level Security (RLS) avec verrouillage après les 30 jours d'essai gratuit
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own investments." ON public.investments;
CREATE POLICY "Users can read own investments."
  ON public.investments FOR SELECT
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Paid users can insert own investments." ON public.investments;
CREATE POLICY "Paid users can insert own investments."
  ON public.investments FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id::text
    AND public.user_has_paid_plan('personal')
  );

DROP POLICY IF EXISTS "Paid users can update own investments." ON public.investments;
CREATE POLICY "Paid users can update own investments."
  ON public.investments FOR UPDATE
  USING (
    auth.uid()::text = user_id::text
    AND public.user_has_paid_plan('personal')
  )
  WITH CHECK (
    auth.uid()::text = user_id::text
    AND public.user_has_paid_plan('personal')
  );

DROP POLICY IF EXISTS "Users can delete own investments." ON public.investments;
CREATE POLICY "Users can delete own investments."
  ON public.investments FOR DELETE
  USING (auth.uid()::text = user_id::text);

ALTER TABLE public.investment_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own investment operations." ON public.investment_operations;
CREATE POLICY "Users can read own investment operations."
  ON public.investment_operations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.investments
    WHERE id::text = investment_operations.investment_id::text
      AND user_id::text = auth.uid()::text
  ));

DROP POLICY IF EXISTS "Paid users can insert own investment operations." ON public.investment_operations;
CREATE POLICY "Paid users can insert own investment operations."
  ON public.investment_operations FOR INSERT
  WITH CHECK (
    public.user_has_paid_plan('personal')
    AND EXISTS (
      SELECT 1 FROM public.investments
      WHERE id::text = investment_operations.investment_id::text
        AND user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Paid users can update own investment operations." ON public.investment_operations;
CREATE POLICY "Paid users can update own investment operations."
  ON public.investment_operations FOR UPDATE
  USING (
    public.user_has_paid_plan('personal')
    AND EXISTS (
      SELECT 1 FROM public.investments
      WHERE id::text = investment_operations.investment_id::text
        AND user_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    public.user_has_paid_plan('personal')
    AND EXISTS (
      SELECT 1 FROM public.investments
      WHERE id::text = investment_operations.investment_id::text
        AND user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can delete own investment operations." ON public.investment_operations;
CREATE POLICY "Users can delete own investment operations."
  ON public.investment_operations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.investments
    WHERE id::text = investment_operations.investment_id::text
      AND user_id::text = auth.uid()::text
  ));
