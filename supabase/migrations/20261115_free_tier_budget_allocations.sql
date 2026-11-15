-- Migration: 20261115_free_tier_budget_allocations.sql
-- Description: Autorise tous les utilisateurs authentifiés (y compris le Plan Gratuit) à insérer et mettre à jour leurs propres enveloppes budgétaires (budget_allocations)

DO $$
BEGIN
  IF to_regclass('public.budget_allocations') IS NOT NULL
     AND to_regclass('public.monthly_budgets') IS NOT NULL THEN

    -- 1. Supprimer les anciennes politiques restrictives qui exigeaient un plan payant
    DROP POLICY IF EXISTS "Paid users can insert own allocations via budget." ON public.budget_allocations;
    DROP POLICY IF EXISTS "Paid users can update own allocations via budget." ON public.budget_allocations;
    DROP POLICY IF EXISTS "Users can insert own allocations via budget." ON public.budget_allocations;
    DROP POLICY IF EXISTS "Users can update own allocations via budget." ON public.budget_allocations;

    -- 2. Créer les nouvelles politiques permettant aux utilisateurs authentifiés de gérer leurs propres allocations
    CREATE POLICY "Users can insert own allocations via budget."
      ON public.budget_allocations FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.monthly_budgets
          WHERE id::text = budget_allocations.monthly_budget_id::text
            AND user_id::text = auth.uid()::text
        )
      );

    CREATE POLICY "Users can update own allocations via budget."
      ON public.budget_allocations FOR UPDATE
      USING (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.monthly_budgets
          WHERE id::text = budget_allocations.monthly_budget_id::text
            AND user_id::text = auth.uid()::text
        )
      )
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.monthly_budgets
          WHERE id::text = budget_allocations.monthly_budget_id::text
            AND user_id::text = auth.uid()::text
        )
      );

  END IF;
END;
$$;
