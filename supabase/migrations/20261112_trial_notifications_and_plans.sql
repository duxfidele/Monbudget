-- =============================================================================
-- Migration : Essai Gratuit 30 Jours, Notifications In-App & Relances Auto
-- Date      : 2026-11-12
-- =============================================================================

-- 1. Colonnes d'essai gratuit 30 jours et de déduplication des notifications sur user_subscriptions
ALTER TABLE IF EXISTS public.user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_choice_made_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_reminder_3d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_expired_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS renewal_reminder_3d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expired_sent_at TIMESTAMPTZ;

-- 2. Colonne de déduplication de confirmation post-paiement sur subscription_orders
ALTER TABLE IF EXISTS public.subscription_orders
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;

-- 3. Table des notifications in-app (cloche du header)
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'welcome_trial',
    'trial_reminder_3d',
    'trial_expired',
    'payment_success',
    'renewal_reminder_3d',
    'subscription_expired',
    'system'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  cta_href TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread_created
  ON public.user_notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own notifications" ON public.user_notifications;
CREATE POLICY "Users can read their own notifications"
  ON public.user_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can mark their own notifications as read" ON public.user_notifications;
CREATE POLICY "Users can mark their own notifications as read"
  ON public.user_notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Aucune insertion ou suppression client directe sur les notifications (passent par le serveur)
REVOKE INSERT, DELETE ON public.user_notifications FROM PUBLIC, anon, authenticated;

-- 4. Mettre à jour les comptes Super-Admin existants en gratuit à vie ('business' / 'yearly', sans essai ni expiration)
--    IMPORTANT : On ne touche PAS aux comptes non-admin préexistants (anciens tests).
INSERT INTO public.user_subscriptions (
  user_id,
  plan_id,
  billing_cycle,
  status,
  current_period_start,
  current_period_end,
  trial_started_at,
  trial_ends_at,
  trial_choice_made_at,
  updated_at
)
SELECT
  u.id,
  'business',
  'yearly',
  'active',
  NOW(),
  NULL,
  NULL,
  NULL,
  NULL,
  NOW()
FROM auth.users u
WHERE LOWER(COALESCE(u.email, '')) IN ('degladux@gmail.com', 'fideleatchade@gmail.com')
ON CONFLICT (user_id) DO UPDATE SET
  plan_id = 'business',
  billing_cycle = 'yearly',
  status = 'active',
  current_period_end = NULL,
  trial_started_at = NULL,
  trial_ends_at = NULL,
  trial_choice_made_at = NULL,
  updated_at = NOW();

-- 5. Trigger d'inscription (Email ou Google OAuth) :
--    - Nouveaux membres : plan 'free' + essai complet de 30 jours (trial_ends_at = NOW() + 30 jours)
--    - Super-Admins : plan 'business' gratuit à vie sans expiration
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
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
    split_part(COALESCE(NEW.email, 'Membre'), '@', 1)
  );

  v_is_admin := LOWER(COALESCE(NEW.email, '')) IN ('degladux@gmail.com', 'fideleatchade@gmail.com');

  -- Bloc 1 : Création/mise à jour sécurisée du profil (compatible UUID ou TEXT)
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

  -- Bloc 2 : Initialisation sécurisée de l'abonnement SaaS avec essai 30 jours pour nouveaux membres
  BEGIN
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_id,
      billing_cycle,
      status,
      current_period_start,
      current_period_end,
      trial_started_at,
      trial_ends_at,
      trial_choice_made_at,
      updated_at
    )
    VALUES (
      NEW.id,
      CASE WHEN v_is_admin THEN 'business' ELSE 'free' END,
      CASE WHEN v_is_admin THEN 'yearly' ELSE 'none' END,
      'active',
      v_now,
      NULL,
      CASE WHEN v_is_admin THEN NULL ELSE v_now END,
      CASE WHEN v_is_admin THEN NULL ELSE v_now + INTERVAL '30 days' END,
      NULL,
      v_now
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[MonBudget Auth Trigger] Non-fatal subscription insert warning for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_monbudget ON auth.users;
CREATE TRIGGER on_auth_user_created_monbudget
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile_and_subscription();

-- 6. Mettre à jour public.user_has_paid_plan(TEXT) pour autoriser aussi l'essai 30j actif (niveau 'personal')
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
  v_trial_ends_at TIMESTAMPTZ;
  v_trial_choice_made_at TIMESTAMPTZ;
  v_rank INTEGER := 0;
  v_required_rank INTEGER := 1;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
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

-- 7. Mettre à jour process_moneriz_webhook_event pour enregistrer le choix payant et réinitialiser les relances de renouvellement
CREATE OR REPLACE FUNCTION public.process_moneriz_webhook_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_mode TEXT,
  p_payment_id TEXT,
  p_reference TEXT,
  p_amount INTEGER,
  p_currency TEXT,
  p_payment_status TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.subscription_orders%ROWTYPE;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Garde-fou défense en profondeur : seul le backend privilégié (service_role) peut exécuter cette RPC
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN_SERVICE_ROLE_REQUIRED';
  END IF;

  -- 1. Déduplication atomique sur event_id
  INSERT INTO public.moneriz_webhook_inbox (
    event_id, event_type, mode, payment_id, reference, payload, received_at
  ) VALUES (
    p_event_id, p_event_type, p_mode, p_payment_id, p_reference, p_payload, NOW()
  )
  ON CONFLICT (event_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'order_status', 'unchanged');
  END IF;

  -- 2. Verrouillage de la commande correspondante
  SELECT * INTO v_order
  FROM public.subscription_orders
  WHERE reference = p_reference AND mode = p_mode
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND:%', p_reference;
  END IF;

  -- 3. Vérification stricte du montant et de la devise
  IF v_order.amount <> p_amount OR v_order.currency <> p_currency THEN
    RAISE EXCEPTION 'AMOUNT_OR_CURRENCY_MISMATCH';
  END IF;

  -- 4. Application de la machine d'états Moneriz
  IF p_event_type = 'payment.succeeded' AND p_payment_status = 'paid' THEN
    IF v_order.status <> 'paid' AND v_order.status <> 'reversed' THEN
      UPDATE public.subscription_orders
      SET status = 'paid',
          last_payment_id = p_payment_id,
          paid_at = COALESCE(p_occurred_at, NOW()),
          updated_at = NOW()
      WHERE id = v_order.id;

      IF v_order.billing_cycle = 'yearly' THEN
        v_period_end := NOW() + INTERVAL '1 year';
      ELSE
        v_period_end := NOW() + INTERVAL '1 month';
      END IF;

      INSERT INTO public.user_subscriptions (
        user_id,
        plan_id,
        billing_cycle,
        status,
        current_period_start,
        current_period_end,
        last_order_id,
        trial_choice_made_at,
        renewal_reminder_3d_sent_at,
        subscription_expired_sent_at,
        updated_at
      ) VALUES (
        v_order.user_id,
        v_order.plan_id,
        v_order.billing_cycle,
        'active',
        NOW(),
        v_period_end,
        v_order.id,
        NOW(),
        NULL,
        NULL,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        billing_cycle = EXCLUDED.billing_cycle,
        status = 'active',
        current_period_start = NOW(),
        current_period_end = EXCLUDED.current_period_end,
        last_order_id = EXCLUDED.last_order_id,
        trial_choice_made_at = COALESCE(public.user_subscriptions.trial_choice_made_at, NOW()),
        renewal_reminder_3d_sent_at = NULL,
        subscription_expired_sent_at = NULL,
        updated_at = NOW();
    END IF;

    RETURN jsonb_build_object('duplicate', false, 'order_status', 'paid', 'plan_id', v_order.plan_id);

  ELSIF p_event_type = 'payment.failed' THEN
    IF v_order.status = 'pending' THEN
      UPDATE public.subscription_orders
      SET status = 'failed',
          last_payment_id = p_payment_id,
          failed_at = COALESCE(p_occurred_at, NOW()),
          idempotency_key = NULL,
          request_snapshot = NULL,
          updated_at = NOW()
      WHERE id = v_order.id;
    END IF;
    RETURN jsonb_build_object('duplicate', false, 'order_status', 'failed');

  ELSIF p_event_type = 'payment.expired' THEN
    IF v_order.status = 'pending' THEN
      UPDATE public.subscription_orders
      SET status = 'expired',
          last_payment_id = p_payment_id,
          expired_at = COALESCE(p_occurred_at, NOW()),
          idempotency_key = NULL,
          request_snapshot = NULL,
          updated_at = NOW()
      WHERE id = v_order.id;
    END IF;
    RETURN jsonb_build_object('duplicate', false, 'order_status', 'expired');

  ELSIF p_event_type = 'payment.reversed' THEN
    UPDATE public.subscription_orders
    SET status = 'reversed',
        last_payment_id = p_payment_id,
        reversed_at = COALESCE(p_occurred_at, NOW()),
        updated_at = NOW()
    WHERE id = v_order.id;

    UPDATE public.user_subscriptions
    SET plan_id = 'free',
        billing_cycle = 'none',
        status = 'canceled',
        updated_at = NOW()
    WHERE user_id = v_order.user_id AND last_order_id = v_order.id;

    RETURN jsonb_build_object('duplicate', false, 'order_status', 'reversed');
  END IF;

  RETURN jsonb_build_object('duplicate', false, 'order_status', v_order.status);
END;
$$;

REVOKE ALL ON FUNCTION public.process_moneriz_webhook_event(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.process_moneriz_webhook_event(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TIMESTAMPTZ, JSONB
) TO service_role;

-- 8. Mettre à jour admin_set_user_subscription et admin_get_saas_overview pour inclure les essais 30j
CREATE OR REPLACE FUNCTION public.admin_set_user_subscription(
  p_target_user_id UUID,
  p_plan_id TEXT,
  p_billing_cycle TEXT DEFAULT 'monthly'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email TEXT;
  v_period_end TIMESTAMPTZ;
  v_target_email TEXT;
  v_is_target_admin BOOLEAN := FALSE;
BEGIN
  v_caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  IF v_caller_email NOT IN ('degladux@gmail.com', 'fideleatchade@gmail.com') THEN
    RAISE EXCEPTION 'FORBIDDEN_ADMIN';
  END IF;

  IF p_plan_id NOT IN ('free', 'personal', 'business') THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  SELECT LOWER(COALESCE(email, '')) INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  v_is_target_admin := v_target_email IN ('degladux@gmail.com', 'fideleatchade@gmail.com');

  IF v_is_target_admin THEN
    v_period_end := NULL;
  ELSIF p_plan_id = 'free' THEN
    v_period_end := NULL;
  ELSIF p_billing_cycle = 'yearly' THEN
    v_period_end := NOW() + INTERVAL '1 year';
  ELSE
    v_period_end := NOW() + INTERVAL '1 month';
  END IF;

  INSERT INTO public.user_subscriptions (
    user_id,
    plan_id,
    billing_cycle,
    status,
    current_period_start,
    current_period_end,
    trial_choice_made_at,
    renewal_reminder_3d_sent_at,
    subscription_expired_sent_at,
    updated_at
  ) VALUES (
    p_target_user_id,
    CASE WHEN v_is_target_admin THEN 'business' ELSE p_plan_id END,
    CASE WHEN v_is_target_admin THEN 'yearly' WHEN p_plan_id = 'free' THEN 'none' ELSE COALESCE(p_billing_cycle, 'monthly') END,
    'active',
    NOW(),
    v_period_end,
    CASE WHEN v_is_target_admin THEN NULL ELSE NOW() END,
    NULL,
    NULL,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    billing_cycle = EXCLUDED.billing_cycle,
    status = 'active',
    current_period_start = NOW(),
    current_period_end = EXCLUDED.current_period_end,
    trial_choice_made_at = CASE WHEN v_is_target_admin THEN NULL ELSE COALESCE(public.user_subscriptions.trial_choice_made_at, NOW()) END,
    renewal_reminder_3d_sent_at = NULL,
    subscription_expired_sent_at = NULL,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'plan_id', p_plan_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_saas_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email TEXT;
  v_total_users INTEGER := 0;
  v_total_budgets INTEGER := 0;
  v_total_transactions INTEGER := 0;
  v_total_savings INTEGER := 0;
  v_total_debts INTEGER := 0;
  v_total_revenue_xof BIGINT := 0;
  v_paid_subscribers INTEGER := 0;
  v_personal_count INTEGER := 0;
  v_business_count INTEGER := 0;
  v_trial_count INTEGER := 0;
  v_recent_users JSONB := '[]'::JSONB;
  v_recent_orders JSONB := '[]'::JSONB;
BEGIN
  v_caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  IF v_caller_email NOT IN ('degladux@gmail.com', 'fideleatchade@gmail.com') THEN
    RAISE EXCEPTION 'FORBIDDEN_ADMIN';
  END IF;

  SELECT COUNT(*) INTO v_total_users FROM auth.users;
  SELECT COUNT(*) INTO v_total_budgets FROM public.monthly_budgets;
  SELECT COUNT(*) INTO v_total_transactions FROM public.transactions;
  SELECT COUNT(*) INTO v_total_savings FROM public.savings_goals;
  SELECT COUNT(*) INTO v_total_debts FROM public.debts;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue_xof
  FROM public.subscription_orders
  WHERE status = 'paid';

  SELECT COUNT(*) INTO v_personal_count
  FROM public.user_subscriptions
  WHERE plan_id = 'personal' AND status = 'active'
    AND (current_period_end IS NULL OR current_period_end > NOW());

  SELECT COUNT(*) INTO v_business_count
  FROM public.user_subscriptions
  WHERE plan_id = 'business' AND status = 'active'
    AND (current_period_end IS NULL OR current_period_end > NOW());

  SELECT COUNT(*) INTO v_trial_count
  FROM public.user_subscriptions
  WHERE plan_id = 'free'
    AND status = 'active'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at > NOW()
    AND trial_choice_made_at IS NULL;

  v_paid_subscribers := v_personal_count + v_business_count;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
  INTO v_recent_users
  FROM (
    SELECT
      u.id,
      u.email,
      COALESCE(
        p.full_name,
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        split_part(u.email, '@', 1)
      ) AS full_name,
      COALESCE(p.currency, 'FCFA') AS currency,
      COALESCE(s.plan_id, CASE WHEN LOWER(u.email) IN ('degladux@gmail.com', 'fideleatchade@gmail.com') THEN 'business' ELSE 'free' END) AS plan_id,
      COALESCE(s.billing_cycle, 'none') AS billing_cycle,
      COALESCE(s.status, 'active') AS subscription_status,
      s.current_period_end,
      s.trial_ends_at,
      s.trial_choice_made_at,
      COALESCE(u.raw_app_meta_data ->> 'provider', 'email') AS auth_provider,
      u.created_at,
      u.last_sign_in_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id::text = u.id::text
    LEFT JOIN public.user_subscriptions s ON s.user_id = u.id
    ORDER BY u.created_at DESC
    LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(o)), '[]'::JSONB)
  INTO v_recent_orders
  FROM (
    SELECT
      so.id,
      so.reference,
      so.plan_id,
      so.billing_cycle,
      so.mode,
      so.amount,
      so.currency,
      so.status,
      so.paid_at,
      so.created_at,
      u.email AS user_email
    FROM public.subscription_orders so
    LEFT JOIN auth.users u ON u.id = so.user_id
    ORDER BY so.created_at DESC
    LIMIT 20
  ) o;

  RETURN jsonb_build_object(
    'totalUsers', v_total_users,
    'totalBudgets', v_total_budgets,
    'totalTransactions', v_total_transactions,
    'totalSavingsGoals', v_total_savings,
    'totalDebts', v_total_debts,
    'totalRevenueXof', v_total_revenue_xof,
    'paidSubscribers', v_paid_subscribers,
    'personalSubscribers', v_personal_count,
    'businessSubscribers', v_business_count,
    'trialUsers', v_trial_count,
    'recentUsers', v_recent_users,
    'recentOrders', v_recent_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_saas_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_saas_overview() TO authenticated, service_role;
