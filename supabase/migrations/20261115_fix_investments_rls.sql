-- =============================================================================
-- Migration : 20261115_fix_investments_rls.sql
-- Description : Déblocage immédiat de la synchronisation des investissements
--               et sécurisation RLS par utilisateur propriétaire (user_id = auth.uid()).
-- =============================================================================

-- 1. S'assurer que les colonnes et contraintes pour les 4 types d'opérations sont présentes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'investments'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'investments' AND column_name = 'current_valuation'
    ) THEN
      ALTER TABLE public.investments ADD COLUMN current_valuation DECIMAL DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'investments' AND column_name = 'total_withdrawals'
    ) THEN
      ALTER TABLE public.investments ADD COLUMN total_withdrawals DECIMAL NOT NULL DEFAULT 0;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'investment_operations'
  ) THEN
    ALTER TABLE public.investment_operations
      DROP CONSTRAINT IF EXISTS investment_operations_type_check;

    ALTER TABLE public.investment_operations
      ADD CONSTRAINT investment_operations_type_check
      CHECK (type IN ('capital_outflow', 'return_inflow', 'capital_withdrawal', 'valuation_update'));
  END IF;
END $$;

-- 2. Fiabiliser la fonction user_has_paid_plan pour la détection Super-Admin via auth.users
CREATE OR REPLACE FUNCTION public.user_has_paid_plan(p_min_plan TEXT DEFAULT 'personal')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_plan TEXT;
  v_status TEXT;
  v_period_end TIMESTAMPTZ;
  v_trial_ends_at TIMESTAMPTZ;
  v_trial_choice_made_at TIMESTAMPTZ;
  v_rank INTEGER := 0;
  v_required_rank INTEGER := 1;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Récupération infaillible de l'email depuis auth.users si absent des claims JWT directs
  IF v_email = '' THEN
    SELECT LOWER(COALESCE(email, '')) INTO v_email
    FROM auth.users
    WHERE id = v_uid;
  END IF;

  -- Les Super-Admins conservent toujours l'accès complet à vie
  IF v_email IN ('degladux@gmail.com', 'fideleatchade@gmail.com') THEN
    RETURN TRUE;
  END IF;

  IF p_min_plan = 'business' THEN
    v_required_rank := 2;
  ELSIF p_min_plan = 'free' THEN
    v_required_rank := 0;
  ELSE
    v_required_rank := 1;
  END IF;

  SELECT plan_id, status, current_period_end, trial_ends_at, trial_choice_made_at
  INTO v_plan, v_status, v_period_end, v_trial_ends_at, v_trial_choice_made_at
  FROM public.user_subscriptions
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    v_rank := 0;
  ELSE
    IF v_status = 'active' AND (v_period_end IS NULL OR v_period_end > NOW()) THEN
      v_rank := CASE v_plan
        WHEN 'business' THEN 2
        WHEN 'personal' THEN 1
        ELSE 0
      END;
    ELSE
      v_rank := 0;
    END IF;

    -- Pendant les 30 jours d'essai gratuit (sans choix gratuit déjà enregistré), accès niveau Particulier
    IF v_status = 'active'
       AND v_trial_ends_at IS NOT NULL
       AND v_trial_ends_at > NOW()
       AND v_trial_choice_made_at IS NULL THEN
      v_rank := GREATEST(v_rank, 1);
    END IF;
  END IF;

  RETURN v_rank >= v_required_rank;
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_paid_plan(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_paid_plan(TEXT) TO authenticated, service_role;

-- 3. Déblocage et renforcement des politiques RLS sur public.investments
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own investments." ON public.investments;
DROP POLICY IF EXISTS "Paid users can insert own investments." ON public.investments;
DROP POLICY IF EXISTS "Users can insert own investments." ON public.investments;
DROP POLICY IF EXISTS "Paid users can update own investments." ON public.investments;
DROP POLICY IF EXISTS "Users can update own investments." ON public.investments;
DROP POLICY IF EXISTS "Users can delete own investments." ON public.investments;

CREATE POLICY "Users can read own investments."
  ON public.investments FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own investments."
  ON public.investments FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own investments."
  ON public.investments FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own investments."
  ON public.investments FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- 4. Déblocage et renforcement des politiques RLS sur public.investment_operations
ALTER TABLE public.investment_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own investment operations." ON public.investment_operations;
DROP POLICY IF EXISTS "Paid users can insert own investment operations." ON public.investment_operations;
DROP POLICY IF EXISTS "Users can insert own investment operations." ON public.investment_operations;
DROP POLICY IF EXISTS "Paid users can update own investment operations." ON public.investment_operations;
DROP POLICY IF EXISTS "Users can update own investment operations." ON public.investment_operations;
DROP POLICY IF EXISTS "Users can delete own investment operations." ON public.investment_operations;

CREATE POLICY "Users can read own investment operations."
  ON public.investment_operations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.investments
    WHERE id::text = investment_operations.investment_id::text
      AND user_id::text = auth.uid()::text
  ));

CREATE POLICY "Users can insert own investment operations."
  ON public.investment_operations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.investments
    WHERE id::text = investment_operations.investment_id::text
      AND user_id::text = auth.uid()::text
  ));

CREATE POLICY "Users can update own investment operations."
  ON public.investment_operations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.investments
    WHERE id::text = investment_operations.investment_id::text
      AND user_id::text = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.investments
    WHERE id::text = investment_operations.investment_id::text
      AND user_id::text = auth.uid()::text
  ));

CREATE POLICY "Users can delete own investment operations."
  ON public.investment_operations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.investments
    WHERE id::text = investment_operations.investment_id::text
      AND user_id::text = auth.uid()::text
  ));
