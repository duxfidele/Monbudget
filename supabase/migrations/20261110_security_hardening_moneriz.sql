-- =============================================================================
-- Migration de durcissement sécurité (Étape 1 — Failles 🔴 bloquantes Moneriz)
-- Date : 2026-11-10
-- Objectifs :
--   1. Bloquer tout appel public/client à la RPC SECURITY DEFINER
--      public.process_moneriz_webhook_event(...) (réservée exclusivement à service_role)
--   2. Restreindre les RPC admin_* aux utilisateurs authentifiés (et non anon/PUBLIC)
--   3. Empêcher toute modification ou insertion directe sur public.subscription_orders
--      et public.user_subscriptions depuis le navigateur (clé anon / utilisateur connecté)
--   4. Garantir l'activation de Row Level Security sur user_subscriptions,
--      subscription_orders et moneriz_webhook_inbox même si 20261109 a été jouée seule
-- =============================================================================

-- 1. Garantir la présence des tables et l'activation stricte du RLS
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

-- Aucune écriture client directe sur user_subscriptions
REVOKE INSERT, UPDATE, DELETE ON public.user_subscriptions FROM PUBLIC, anon, authenticated;

-- 2. Verrouiller public.subscription_orders en lecture seule côté client
--    Toutes les créations/mises à jour passent désormais exclusivement par le serveur (service_role)
ALTER TABLE IF EXISTS public.subscription_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own pending orders" ON public.subscription_orders;
DROP POLICY IF EXISTS "Users can update their own pending orders" ON public.subscription_orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.subscription_orders;
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.subscription_orders;

DROP POLICY IF EXISTS "Users can view their own orders" ON public.subscription_orders;
CREATE POLICY "Users can view their own orders"
  ON public.subscription_orders
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.subscription_orders FROM PUBLIC, anon, authenticated;

-- 3. Verrouiller totalement public.moneriz_webhook_inbox côté client
ALTER TABLE IF EXISTS public.moneriz_webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moneriz_webhook_inbox FROM PUBLIC, anon, authenticated;

-- 4. Blinder public.process_moneriz_webhook_event : contrôle explicite du rôle + REVOKE/GRANT
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

REVOKE ALL ON FUNCTION public.process_moneriz_webhook_event(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.process_moneriz_webhook_event(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TIMESTAMPTZ, JSONB
) TO service_role;

-- 5. Retirer les droits d'exécution anonymes/PUBLIC sur les RPC d'administration
DO $$
BEGIN
  IF to_regprocedure('public.admin_get_saas_overview()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.admin_get_saas_overview() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.admin_get_saas_overview() TO authenticated, service_role;
  END IF;

  IF to_regprocedure('public.admin_set_user_subscription(uuid,text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, TEXT) TO authenticated, service_role;
  END IF;
END $$;
