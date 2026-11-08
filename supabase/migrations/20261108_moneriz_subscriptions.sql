-- =============================================================================
-- Migration : Intégration Moneriz SaaS (Abonnements, Commandes & Webhook Inbox)
-- Date      : 2026-11-08
-- =============================================================================

-- 1. Table des abonnements actifs par utilisateur
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

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Table des commandes d'abonnement Moneriz
CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('personal', 'business')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  reference TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 100),
  currency TEXT NOT NULL DEFAULT 'XOF' CHECK (currency = 'XOF'),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'reversed')),
  idempotency_key TEXT,
  request_snapshot JSONB,
  checkout_session JSONB,
  last_payment_id TEXT,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_subscription_orders_mode_reference UNIQUE (mode, reference)
);

CREATE INDEX IF NOT EXISTS idx_subscription_orders_user_status
  ON public.subscription_orders(user_id, status);

CREATE INDEX IF NOT EXISTS idx_subscription_orders_reference
  ON public.subscription_orders(reference);

ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own orders" ON public.subscription_orders;
CREATE POLICY "Users can view their own orders"
  ON public.subscription_orders
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own pending orders" ON public.subscription_orders;
CREATE POLICY "Users can insert their own pending orders"
  ON public.subscription_orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Users can update their own pending orders" ON public.subscription_orders;
CREATE POLICY "Users can update their own pending orders"
  ON public.subscription_orders
  FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('pending', 'failed', 'expired'));

-- 3. Table d'inbox durable des webhooks Moneriz (Idempotence sur event_id)
CREATE TABLE IF NOT EXISTS public.moneriz_webhook_inbox (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  payment_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.moneriz_webhook_inbox ENABLE ROW LEVEL SECURITY;
-- Aucune politique publique : accessible uniquement via le serveur (service_role ou fonction RPC SECURITY DEFINER)

-- 4. Fonction RPC transactionnelle SECURITY DEFINER pour traiter un webhook Moneriz de manière atomique
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
        user_id, plan_id, billing_cycle, status, current_period_start, current_period_end, last_order_id, updated_at
      ) VALUES (
        v_order.user_id, v_order.plan_id, v_order.billing_cycle, 'active', NOW(), v_period_end, v_order.id, NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        billing_cycle = EXCLUDED.billing_cycle,
        status = 'active',
        current_period_start = NOW(),
        current_period_end = EXCLUDED.current_period_end,
        last_order_id = EXCLUDED.last_order_id,
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

-- 5. Trigger automatique à l'inscription (Email ou Google OAuth) pour créer profiles + user_subscriptions
CREATE OR REPLACE FUNCTION public.handle_new_user_profile_and_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_is_admin BOOLEAN;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(COALESCE(NEW.email, 'Membre'), '@', 1)
  );

  v_is_admin := LOWER(COALESCE(NEW.email, '')) IN ('degladux@gmail.com', 'fideleatchade@gmail.com');

  INSERT INTO public.profiles (id, full_name, currency, alert_threshold_percent, pay_day)
  VALUES (NEW.id, v_full_name, 'FCFA', 80, 28)
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name);

  INSERT INTO public.user_subscriptions (user_id, plan_id, billing_cycle, status, updated_at)
  VALUES (
    NEW.id,
    CASE WHEN v_is_admin THEN 'business' ELSE 'free' END,
    CASE WHEN v_is_admin THEN 'yearly' ELSE 'none' END,
    'active',
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_monbudget ON auth.users;
CREATE TRIGGER on_auth_user_created_monbudget
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile_and_subscription();

-- 6. Fonction RPC SECURITY DEFINER pour le tableau de bord Super-Administrateur (contourne le RLS en toute sécurité)
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
  WHERE plan_id = 'personal' AND status = 'active';

  SELECT COUNT(*) INTO v_business_count
  FROM public.user_subscriptions
  WHERE plan_id = 'business' AND status = 'active';

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
      COALESCE(u.raw_app_meta_data ->> 'provider', 'email') AS auth_provider,
      u.created_at,
      u.last_sign_in_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
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
    'recentUsers', v_recent_users,
    'recentOrders', v_recent_orders
  );
END;
$$;

-- 7. Fonction RPC SECURITY DEFINER permettant au Super-Admin de modifier manuellement le plan d'un membre
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
BEGIN
  v_caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  IF v_caller_email NOT IN ('degladux@gmail.com', 'fideleatchade@gmail.com') THEN
    RAISE EXCEPTION 'FORBIDDEN_ADMIN';
  END IF;

  IF p_plan_id NOT IN ('free', 'personal', 'business') THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  IF p_plan_id = 'free' THEN
    v_period_end := NULL;
  ELSIF p_billing_cycle = 'yearly' THEN
    v_period_end := NOW() + INTERVAL '1 year';
  ELSE
    v_period_end := NOW() + INTERVAL '1 month';
  END IF;

  INSERT INTO public.user_subscriptions (
    user_id, plan_id, billing_cycle, status, current_period_start, current_period_end, updated_at
  ) VALUES (
    p_target_user_id,
    p_plan_id,
    CASE WHEN p_plan_id = 'free' THEN 'none' ELSE COALESCE(p_billing_cycle, 'monthly') END,
    'active',
    NOW(),
    v_period_end,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    billing_cycle = EXCLUDED.billing_cycle,
    status = 'active',
    current_period_start = NOW(),
    current_period_end = EXCLUDED.current_period_end,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'plan_id', p_plan_id
  );
END;
$$;


