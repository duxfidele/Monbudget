-- =============================================================================
-- Migration 20261115_investments_enhancement : Valorisation Patrimoniale & Retraits
-- Objectifs :
--   1. Ajouter les colonnes current_valuation et total_withdrawals à public.investments
--   2. Élargir la contrainte CHECK sur public.investment_operations.type pour
--      supporter les 4 types d'opérations :
--        - capital_outflow : Apport de capital supplémentaire
--        - return_inflow : Gain / dividende perçu en cash
--        - capital_withdrawal : Retrait partiel ou total de capital
--        - valuation_update : Actualisation de la valeur marchande estimée
--   3. Assurer la rétrocompatibilité totale avec les données existantes
-- =============================================================================

-- 1. Ajout sécurisé des colonnes optionnelles à la table investments
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
END $$;

-- 2. Élargissement de la contrainte CHECK sur investment_operations.type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'investment_operations'
  ) THEN
    -- Supprimer l'ancienne contrainte CHECK si elle existe
    ALTER TABLE public.investment_operations
      DROP CONSTRAINT IF EXISTS investment_operations_type_check;

    -- Appliquer la nouvelle contrainte supportant les 4 types d'opérations
    ALTER TABLE public.investment_operations
      ADD CONSTRAINT investment_operations_type_check
      CHECK (type IN ('capital_outflow', 'return_inflow', 'capital_withdrawal', 'valuation_update'));
  END IF;
END $$;

-- 3. Commentaire de documentation
COMMENT ON COLUMN public.investments.current_valuation IS 'Valeur marchande actuelle estimée de l''actif ou du projet';
COMMENT ON COLUMN public.investments.total_withdrawals IS 'Total du capital désinvesti / retiré vers la trésorerie';

