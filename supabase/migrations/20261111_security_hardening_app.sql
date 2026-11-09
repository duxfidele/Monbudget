-- =============================================================================
-- Migration de durcissement sécurité (Étape 2 — Uploads, SQL CHECK & RLS Plans Payants)
-- Date : 2026-11-11
-- Objectifs :
--   1. Rendre le bucket Storage 'receipts' STRICTEMENT PRIVÉ (5 Mo, JPEG/PNG/WebP/PDF)
--      avec politiques RLS par dossier utilisateur auth.uid()::text
--   2. Ajouter des contraintes CHECK (NOT VALID) sur les montants financiers
--   3. Créer public.user_has_paid_plan(TEXT) et verrouiller en base (RLS)
--      les écritures (INSERT/UPDATE) sur les tables réservées aux plans payants :
--      budget_allocations, savings_goals, savings_contributions, debts, debt_payments
-- =============================================================================

-- 1. Bucket Storage 'receipts' privé + limites MIME/taille
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

DROP POLICY IF EXISTS "Users can read own receipts" ON storage.objects;
CREATE POLICY "Users can read own receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload own receipts" ON storage.objects;
CREATE POLICY "Users can upload own receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own receipts" ON storage.objects;
CREATE POLICY "Users can update own receipts"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
CREATE POLICY "Users can delete own receipts"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Contraintes CHECK idempotentes sur les montants (NOT VALID pour ne pas bloquer d'éventuelles lignes historiques)
DO $$
BEGIN
  IF to_regclass('public.income_entries') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_income_entries_amount_non_negative'
      AND conrelid = 'public.income_entries'::regclass
  ) THEN
    ALTER TABLE public.income_entries
      ADD CONSTRAINT chk_income_entries_amount_non_negative CHECK (amount >= 0) NOT VALID;
  END IF;

  IF to_regclass('public.budget_allocations') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_budget_allocations_amount_non_negative'
      AND conrelid = 'public.budget_allocations'::regclass
  ) THEN
    ALTER TABLE public.budget_allocations
      ADD CONSTRAINT chk_budget_allocations_amount_non_negative CHECK (allocated_amount >= 0) NOT VALID;
  END IF;

  IF to_regclass('public.transactions') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_transactions_amount_positive'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT chk_transactions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  IF to_regclass('public.savings_goals') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'chk_savings_goals_target_positive'
        AND conrelid = 'public.savings_goals'::regclass
    ) THEN
      ALTER TABLE public.savings_goals
        ADD CONSTRAINT chk_savings_goals_target_positive CHECK (target_amount > 0) NOT VALID;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'chk_savings_goals_current_non_negative'
        AND conrelid = 'public.savings_goals'::regclass
    ) THEN
      ALTER TABLE public.savings_goals
        ADD CONSTRAINT chk_savings_goals_current_non_negative CHECK (current_amount >= 0) NOT VALID;
    END IF;
  END IF;

  IF to_regclass('public.savings_contributions') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_savings_contributions_amount_positive'
      AND conrelid = 'public.savings_contributions'::regclass
  ) THEN
    ALTER TABLE public.savings_contributions
      ADD CONSTRAINT chk_savings_contributions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
END $$;

-- 3. Fonction d'autorisation serveur des plans payants pour les politiques RLS
CREATE OR REPLACE FUNCTION public.user_has_paid_plan(p_min_plan TEXT DEFAULT 'personal')
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_plan TEXT;
  v_status TEXT;
  v_period_end TIMESTAMPTZ;
  v_rank INTEGER := 0;
  v_required_rank INTEGER := 1;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Les Super-Admins conservent toujours l'accès complet
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

  SELECT plan_id, status, current_period_end
  INTO v_plan, v_status, v_period_end
  FROM public.user_subscriptions
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    v_plan := 'free';
  ELSIF v_status <> 'active' OR (v_period_end IS NOT NULL AND v_period_end <= NOW()) THEN
    v_plan := 'free';
  END IF;

  v_rank := CASE v_plan
    WHEN 'business' THEN 2
    WHEN 'personal' THEN 1
    ELSE 0
  END;

  RETURN v_rank >= v_required_rank;
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_paid_plan(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_paid_plan(TEXT) TO authenticated, service_role;

-- 4. Application RLS par plan sur les tables payantes (SELECT/DELETE restent accessibles au propriétaire, INSERT/UPDATE exigent 'personal'+)
DO $$
BEGIN
  -- 4a. budget_allocations
  IF to_regclass('public.budget_allocations') IS NOT NULL
     AND to_regclass('public.monthly_budgets') IS NOT NULL THEN
    EXECUTE $sql$ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can CRUD own allocations via budget." ON public.budget_allocations$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can read own allocations via budget." ON public.budget_allocations$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Paid users can insert own allocations via budget." ON public.budget_allocations$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Paid users can update own allocations via budget." ON public.budget_allocations$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can delete own allocations via budget." ON public.budget_allocations$sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can read own allocations via budget."
        ON public.budget_allocations FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.monthly_budgets
          WHERE id::text = budget_allocations.monthly_budget_id::text
            AND user_id::text = auth.uid()::text
        ))
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Paid users can insert own allocations via budget."
        ON public.budget_allocations FOR INSERT
        WITH CHECK (
          public.user_has_paid_plan('personal')
          AND EXISTS (
            SELECT 1 FROM public.monthly_budgets
            WHERE id::text = budget_allocations.monthly_budget_id::text
              AND user_id::text = auth.uid()::text
          )
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Paid users can update own allocations via budget."
        ON public.budget_allocations FOR UPDATE
        USING (
          public.user_has_paid_plan('personal')
          AND EXISTS (
            SELECT 1 FROM public.monthly_budgets
            WHERE id::text = budget_allocations.monthly_budget_id::text
              AND user_id::text = auth.uid()::text
          )
        )
        WITH CHECK (
          public.user_has_paid_plan('personal')
          AND EXISTS (
            SELECT 1 FROM public.monthly_budgets
            WHERE id::text = budget_allocations.monthly_budget_id::text
              AND user_id::text = auth.uid()::text
          )
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can delete own allocations via budget."
        ON public.budget_allocations FOR DELETE
        USING (EXISTS (
          SELECT 1 FROM public.monthly_budgets
          WHERE id::text = budget_allocations.monthly_budget_id::text
            AND user_id::text = auth.uid()::text
        ))
    $sql$;
  END IF;

  -- 4b. savings_goals
  IF to_regclass('public.savings_goals') IS NOT NULL THEN
    EXECUTE $sql$ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can CRUD own savings goals." ON public.savings_goals$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can read own savings goals." ON public.savings_goals$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Paid users can insert own savings goals." ON public.savings_goals$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Paid users can update own savings goals." ON public.savings_goals$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can delete own savings goals." ON public.savings_goals$sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can read own savings goals."
        ON public.savings_goals FOR SELECT
        USING (auth.uid()::text = user_id::text)
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Paid users can insert own savings goals."
        ON public.savings_goals FOR INSERT
        WITH CHECK (
          auth.uid()::text = user_id::text
          AND public.user_has_paid_plan('personal')
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Paid users can update own savings goals."
        ON public.savings_goals FOR UPDATE
        USING (
          auth.uid()::text = user_id::text
          AND public.user_has_paid_plan('personal')
        )
        WITH CHECK (
          auth.uid()::text = user_id::text
          AND public.user_has_paid_plan('personal')
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can delete own savings goals."
        ON public.savings_goals FOR DELETE
        USING (auth.uid()::text = user_id::text)
    $sql$;
  END IF;

  -- 4c. savings_contributions
  IF to_regclass('public.savings_contributions') IS NOT NULL
     AND to_regclass('public.savings_goals') IS NOT NULL THEN
    EXECUTE $sql$ALTER TABLE public.savings_contributions ENABLE ROW LEVEL SECURITY$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can CRUD own contributions via goal." ON public.savings_contributions$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can read own contributions via goal." ON public.savings_contributions$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Paid users can insert own contributions via goal." ON public.savings_contributions$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Paid users can update own contributions via goal." ON public.savings_contributions$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can delete own contributions via goal." ON public.savings_contributions$sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can read own contributions via goal."
        ON public.savings_contributions FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.savings_goals
          WHERE id::text = savings_contributions.savings_goal_id::text
            AND user_id::text = auth.uid()::text
        ))
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Paid users can insert own contributions via goal."
        ON public.savings_contributions FOR INSERT
        WITH CHECK (
          public.user_has_paid_plan('personal')
          AND EXISTS (
            SELECT 1 FROM public.savings_goals
            WHERE id::text = savings_contributions.savings_goal_id::text
              AND user_id::text = auth.uid()::text
          )
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Paid users can update own contributions via goal."
        ON public.savings_contributions FOR UPDATE
        USING (
          public.user_has_paid_plan('personal')
          AND EXISTS (
            SELECT 1 FROM public.savings_goals
            WHERE id::text = savings_contributions.savings_goal_id::text
              AND user_id::text = auth.uid()::text
          )
        )
        WITH CHECK (
          public.user_has_paid_plan('personal')
          AND EXISTS (
            SELECT 1 FROM public.savings_goals
            WHERE id::text = savings_contributions.savings_goal_id::text
              AND user_id::text = auth.uid()::text
          )
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can delete own contributions via goal."
        ON public.savings_contributions FOR DELETE
        USING (EXISTS (
          SELECT 1 FROM public.savings_goals
          WHERE id::text = savings_contributions.savings_goal_id::text
            AND user_id::text = auth.uid()::text
        ))
    $sql$;
  END IF;

  -- 4d. debts
  IF to_regclass('public.debts') IS NOT NULL THEN
    EXECUTE $sql$ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can CRUD own debts." ON public.debts$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can read own debts." ON public.debts$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Paid users can insert own debts." ON public.debts$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Paid users can update own debts." ON public.debts$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can delete own debts." ON public.debts$sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can read own debts."
        ON public.debts FOR SELECT
        USING (auth.uid()::text = user_id::text)
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Paid users can insert own debts."
        ON public.debts FOR INSERT
        WITH CHECK (
          auth.uid()::text = user_id::text
          AND public.user_has_paid_plan('personal')
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Paid users can update own debts."
        ON public.debts FOR UPDATE
        USING (
          auth.uid()::text = user_id::text
          AND public.user_has_paid_plan('personal')
        )
        WITH CHECK (
          auth.uid()::text = user_id::text
          AND public.user_has_paid_plan('personal')
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can delete own debts."
        ON public.debts FOR DELETE
        USING (auth.uid()::text = user_id::text)
    $sql$;
  END IF;

  -- 4e. debt_payments
  IF to_regclass('public.debt_payments') IS NOT NULL
     AND to_regclass('public.debts') IS NOT NULL THEN
    EXECUTE $sql$ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can CRUD own debt payments via debt." ON public.debt_payments$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can read own debt payments via debt." ON public.debt_payments$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Paid users can insert own debt payments via debt." ON public.debt_payments$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Paid users can update own debt payments via debt." ON public.debt_payments$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Users can delete own debt payments via debt." ON public.debt_payments$sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can read own debt payments via debt."
        ON public.debt_payments FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.debts
          WHERE id::text = debt_payments.debt_id::text
            AND user_id::text = auth.uid()::text
        ))
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Paid users can insert own debt payments via debt."
        ON public.debt_payments FOR INSERT
        WITH CHECK (
          public.user_has_paid_plan('personal')
          AND EXISTS (
            SELECT 1 FROM public.debts
            WHERE id::text = debt_payments.debt_id::text
              AND user_id::text = auth.uid()::text
          )
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Paid users can update own debt payments via debt."
        ON public.debt_payments FOR UPDATE
        USING (
          public.user_has_paid_plan('personal')
          AND EXISTS (
            SELECT 1 FROM public.debts
            WHERE id::text = debt_payments.debt_id::text
              AND user_id::text = auth.uid()::text
          )
        )
        WITH CHECK (
          public.user_has_paid_plan('personal')
          AND EXISTS (
            SELECT 1 FROM public.debts
            WHERE id::text = debt_payments.debt_id::text
              AND user_id::text = auth.uid()::text
          )
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Users can delete own debt payments via debt."
        ON public.debt_payments FOR DELETE
        USING (EXISTS (
          SELECT 1 FROM public.debts
          WHERE id::text = debt_payments.debt_id::text
            AND user_id::text = auth.uid()::text
        ))
    $sql$;
  END IF;
END $$;
