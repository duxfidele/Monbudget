-- =============================================================================
-- Migration de réparation : Inscription Google OAuth & Email sans erreur
-- Corrige l'erreur "Database error saving new user" sur auth.users
-- =============================================================================

-- 1. S'assurer que toutes les colonnes attendues existent sur public.profiles
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'FCFA';
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'fr-FR';
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS alert_threshold_percent DECIMAL DEFAULT 80.0;
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS pay_day INTEGER DEFAULT 28;
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS notifications JSONB DEFAULT '{"budgetAlert": true, "budgetAlertThreshold": 80, "payDayReminder": true, "payDayReminderDays": 7, "weeklySummary": false}'::jsonb;

-- 2. Supprimer l'ancien trigger conflictuel de la migration 001 (sans search_path ni ON CONFLICT)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_monbudget ON auth.users;

-- 3. S'assurer que la table user_subscriptions existe
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'free' CHECK (plan_id IN ('free', 'personal', 'business')),
  billing_cycle TEXT NOT NULL DEFAULT 'none' CHECK (billing_cycle IN ('none', 'monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  last_order_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Fonction de trigger blindée : compatible UUID/TEXT et protégée par EXCEPTION WHEN OTHERS
--    Ne bloque JAMAIS la création d'un utilisateur dans auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_profile_and_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_is_admin BOOLEAN;
  v_profile_id_type TEXT;
BEGIN
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
    split_part(COALESCE(NEW.email, 'Membre'), '@', 1)
  );

  v_is_admin := LOWER(COALESCE(NEW.email, '')) IN ('degladux@gmail.com', 'fideleatchade@gmail.com');

  -- Bloc 1 : Création/mise à jour sécurisée du profil (avec détection du type id UUID ou TEXT)
  BEGIN
    SELECT data_type INTO v_profile_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id';

    IF v_profile_id_type = 'uuid' THEN
      INSERT INTO public.profiles (id, full_name, currency, locale, alert_threshold_percent, pay_day)
      VALUES (NEW.id, v_full_name, 'FCFA', 'fr-FR', 80, 28)
      ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name);
    ELSE
      INSERT INTO public.profiles (id, full_name, currency, locale, alert_threshold_percent, pay_day)
      VALUES (NEW.id::text, v_full_name, 'FCFA', 'fr-FR', 80, 28)
      ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[MonBudget Auth Trigger] Non-fatal profiles insert warning for user %: %', NEW.id, SQLERRM;
  END;

  -- Bloc 2 : Initialisation sécurisée de l'abonnement SaaS
  BEGIN
    INSERT INTO public.user_subscriptions (user_id, plan_id, billing_cycle, status, updated_at)
    VALUES (
      NEW.id,
      CASE WHEN v_is_admin THEN 'business' ELSE 'free' END,
      CASE WHEN v_is_admin THEN 'yearly' ELSE 'none' END,
      'active',
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[MonBudget Auth Trigger] Non-fatal subscription insert warning for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_monbudget
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile_and_subscription();

-- 5. Mettre à jour aussi handle_new_user() au cas où un autre script l'appellerait
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.handle_new_user_profile_and_subscription();
END;
$$;

-- 6. Rétro-remplissage (backfill) pour les utilisateurs existants sans abonnement
INSERT INTO public.user_subscriptions (user_id, plan_id, billing_cycle, status, updated_at)
SELECT
  u.id,
  CASE WHEN LOWER(COALESCE(u.email, '')) IN ('degladux@gmail.com', 'fideleatchade@gmail.com') THEN 'business' ELSE 'free' END,
  CASE WHEN LOWER(COALESCE(u.email, '')) IN ('degladux@gmail.com', 'fideleatchade@gmail.com') THEN 'yearly' ELSE 'none' END,
  'active',
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions s WHERE s.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

