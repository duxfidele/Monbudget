-- =============================================================================
-- Migration : 20261115_add_expected_return_percent.sql
-- Description : Ajout de la colonne expected_return_percent sur public.investments
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'investments'
  ) THEN
    -- 1. Ajouter la colonne expected_return_percent si elle n'existe pas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'investments' AND column_name = 'expected_return_percent'
    ) THEN
      ALTER TABLE public.investments ADD COLUMN expected_return_percent DECIMAL DEFAULT 15;
    END IF;

    -- 2. Reporter les données si expected_return_rate contenait des valeurs
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'investments' AND column_name = 'expected_return_rate'
    ) THEN
      UPDATE public.investments 
      SET expected_return_percent = COALESCE(expected_return_rate, 15)
      WHERE expected_return_percent IS NULL OR expected_return_percent = 15;
    END IF;
  END IF;
END $$;

