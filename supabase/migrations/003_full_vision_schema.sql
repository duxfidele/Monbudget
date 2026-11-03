-- =============================================================================
-- Migration 003 (100% Adaptative, Autonome & Sans Conflit de Types UUID/TEXT)
-- Exécutez ce script dans l'éditeur SQL de Supabase (SQL Editor)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE
    v_profile_id_type TEXT := 'UUID';
    v_category_id_type TEXT := 'UUID';
    v_budget_id_type TEXT := 'UUID';
    v_goal_id_type TEXT := 'UUID';
    v_debt_id_type TEXT := 'UUID';
BEGIN
    -- -------------------------------------------------------------------------
    -- 1. TABLE PROFILES
    -- -------------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
        full_name TEXT,
        currency TEXT DEFAULT 'FCFA' NOT NULL,
        locale TEXT DEFAULT 'fr-FR' NOT NULL,
        alert_threshold_percent DECIMAL DEFAULT 80.0 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'FCFA' NOT NULL;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'fr-FR' NOT NULL;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alert_threshold_percent DECIMAL DEFAULT 80.0 NOT NULL;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_day INTEGER DEFAULT 28;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications JSONB DEFAULT '{"budgetAlert": true, "budgetAlertThreshold": 80, "payDayReminder": true, "payDayReminderDays": 7, "weeklySummary": false}'::jsonb;

    ALTER TABLE public.profiles ALTER COLUMN currency SET DEFAULT 'FCFA';
    UPDATE public.profiles SET currency = 'FCFA' WHERE currency IS NULL;

    -- Détecter le type réel de profiles.id (UUID ou TEXT)
    SELECT CASE WHEN data_type = 'uuid' THEN 'UUID' ELSE 'TEXT' END
    INTO v_profile_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id';
    v_profile_id_type := COALESCE(v_profile_id_type, 'UUID');

    -- -------------------------------------------------------------------------
    -- 2. TABLE CATEGORIES
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
        EXECUTE format('
            CREATE TABLE public.categories (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_id %s REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
                name TEXT NOT NULL,
                icon TEXT,
                color TEXT,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true
            )', v_profile_id_type);
    END IF;

    EXECUTE format('ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS user_id %s REFERENCES public.profiles(id) ON DELETE CASCADE', v_profile_id_type);
    ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT;
    ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color TEXT;
    ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
    ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

    -- Détecter le type réel de categories.id (UUID ou TEXT)
    SELECT CASE WHEN data_type = 'uuid' THEN 'UUID' ELSE 'TEXT' END
    INTO v_category_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'id';
    v_category_id_type := COALESCE(v_category_id_type, 'UUID');

    -- -------------------------------------------------------------------------
    -- 3. TABLE MONTHLY_BUDGETS
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monthly_budgets') THEN
        EXECUTE format('
            CREATE TABLE public.monthly_budgets (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_id %s REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                status TEXT DEFAULT ''draft'',
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL,
                UNIQUE(user_id, year, month)
            )', v_profile_id_type);
    END IF;

    EXECUTE format('ALTER TABLE public.monthly_budgets ADD COLUMN IF NOT EXISTS user_id %s REFERENCES public.profiles(id) ON DELETE CASCADE', v_profile_id_type);
    ALTER TABLE public.monthly_budgets ADD COLUMN IF NOT EXISTS year INTEGER;
    ALTER TABLE public.monthly_budgets ADD COLUMN IF NOT EXISTS month INTEGER;
    ALTER TABLE public.monthly_budgets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
    ALTER TABLE public.monthly_budgets ADD COLUMN IF NOT EXISTS notes TEXT;

    -- Détecter le type réel de monthly_budgets.id (UUID ou TEXT)
    SELECT CASE WHEN data_type = 'uuid' THEN 'UUID' ELSE 'TEXT' END
    INTO v_budget_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'monthly_budgets' AND column_name = 'id';
    v_budget_id_type := COALESCE(v_budget_id_type, 'UUID');

    -- -------------------------------------------------------------------------
    -- 4. TABLE INCOME_ENTRIES (Revenus multi-sources)
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'income_entries') THEN
        EXECUTE format('
            CREATE TABLE public.income_entries (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                monthly_budget_id %s REFERENCES public.monthly_budgets(id) ON DELETE CASCADE NOT NULL,
                label TEXT NOT NULL,
                amount DECIMAL NOT NULL,
                received_date DATE,
                source_type TEXT DEFAULT ''Salaire''
            )', v_budget_id_type);
    END IF;

    EXECUTE format('ALTER TABLE public.income_entries ADD COLUMN IF NOT EXISTS monthly_budget_id %s REFERENCES public.monthly_budgets(id) ON DELETE CASCADE', v_budget_id_type);
    ALTER TABLE public.income_entries ADD COLUMN IF NOT EXISTS label TEXT;
    ALTER TABLE public.income_entries ADD COLUMN IF NOT EXISTS amount DECIMAL DEFAULT 0;
    ALTER TABLE public.income_entries ADD COLUMN IF NOT EXISTS received_date DATE;
    ALTER TABLE public.income_entries ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'Salaire';

    -- -------------------------------------------------------------------------
    -- 5. TABLE BUDGET_ALLOCATIONS
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budget_allocations') THEN
        EXECUTE format('
            CREATE TABLE public.budget_allocations (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                monthly_budget_id %s REFERENCES public.monthly_budgets(id) ON DELETE CASCADE NOT NULL,
                category_id %s REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
                allocated_amount DECIMAL NOT NULL DEFAULT 0,
                notes TEXT,
                UNIQUE(monthly_budget_id, category_id)
            )', v_budget_id_type, v_category_id_type);
    END IF;

    EXECUTE format('ALTER TABLE public.budget_allocations ADD COLUMN IF NOT EXISTS monthly_budget_id %s REFERENCES public.monthly_budgets(id) ON DELETE CASCADE', v_budget_id_type);
    EXECUTE format('ALTER TABLE public.budget_allocations ADD COLUMN IF NOT EXISTS category_id %s REFERENCES public.categories(id) ON DELETE CASCADE', v_category_id_type);
    ALTER TABLE public.budget_allocations ADD COLUMN IF NOT EXISTS allocated_amount DECIMAL DEFAULT 0;
    ALTER TABLE public.budget_allocations ADD COLUMN IF NOT EXISTS notes TEXT;

    -- -------------------------------------------------------------------------
    -- 6. TABLE TRANSACTIONS
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
        EXECUTE format('
            CREATE TABLE public.transactions (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                monthly_budget_id %s REFERENCES public.monthly_budgets(id) ON DELETE CASCADE NOT NULL,
                category_id %s REFERENCES public.categories(id) ON DELETE SET NULL,
                amount DECIMAL NOT NULL,
                description TEXT,
                transaction_date DATE NOT NULL,
                type TEXT DEFAULT ''expense'',
                income_source TEXT
            )', v_budget_id_type, v_category_id_type);
    END IF;

    EXECUTE format('ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS monthly_budget_id %s REFERENCES public.monthly_budgets(id) ON DELETE CASCADE', v_budget_id_type);
    EXECUTE format('ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category_id %s REFERENCES public.categories(id) ON DELETE SET NULL', v_category_id_type);
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount DECIMAL DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS income_source TEXT;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'expense';

    -- -------------------------------------------------------------------------
    -- 7. TABLES SAVINGS_GOALS & SAVINGS_CONTRIBUTIONS
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'savings_goals') THEN
        EXECUTE format('
            CREATE TABLE public.savings_goals (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_id %s REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
                name TEXT NOT NULL,
                target_amount DECIMAL NOT NULL,
                current_amount DECIMAL DEFAULT 0 NOT NULL,
                target_date DATE,
                status TEXT DEFAULT ''active'',
                color TEXT,
                icon TEXT
            )', v_profile_id_type);
    END IF;

    SELECT CASE WHEN data_type = 'uuid' THEN 'UUID' ELSE 'TEXT' END
    INTO v_goal_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'savings_goals' AND column_name = 'id';
    v_goal_id_type := COALESCE(v_goal_id_type, 'UUID');

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'savings_contributions') THEN
        EXECUTE format('
            CREATE TABLE public.savings_contributions (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                savings_goal_id %s REFERENCES public.savings_goals(id) ON DELETE CASCADE NOT NULL,
                amount DECIMAL NOT NULL,
                contribution_date DATE NOT NULL,
                notes TEXT
            )', v_goal_id_type);
    END IF;

    -- -------------------------------------------------------------------------
    -- 8. TABLE DEBTS (Dettes à rembourser & Créances à récupérer)
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'debts') THEN
        EXECUTE format('
            CREATE TABLE public.debts (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_id %s REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
                type TEXT NOT NULL CHECK (type IN (''payable'', ''receivable'')),
                person_name TEXT NOT NULL,
                phone TEXT,
                total_amount DECIMAL NOT NULL CHECK (total_amount > 0),
                remaining_amount DECIMAL NOT NULL DEFAULT 0 CHECK (remaining_amount >= 0),
                due_date DATE,
                status TEXT DEFAULT ''pending'' CHECK (status IN (''pending'', ''partial'', ''paid'')),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL
            )', v_profile_id_type);
    END IF;

    SELECT CASE WHEN data_type = 'uuid' THEN 'UUID' ELSE 'TEXT' END
    INTO v_debt_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'id';
    v_debt_id_type := COALESCE(v_debt_id_type, 'UUID');

    -- -------------------------------------------------------------------------
    -- 9. TABLE DEBT_PAYMENTS (Historique des remboursements)
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'debt_payments') THEN
        EXECUTE format('
            CREATE TABLE public.debt_payments (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                debt_id %s REFERENCES public.debts(id) ON DELETE CASCADE NOT NULL,
                amount DECIMAL NOT NULL CHECK (amount > 0),
                payment_date DATE NOT NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL
            )', v_debt_id_type);
    END IF;
END $$;

-- =============================================================================
-- 10. POLITIQUES DE SÉCURITÉ (ROW LEVEL SECURITY) COMPATIBLES UUID & TEXT
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile." ON public.profiles;
CREATE POLICY "Users can view own profile." ON public.profiles FOR SELECT USING (auth.uid()::text = id::text);
DROP POLICY IF EXISTS "Users can insert own profile." ON public.profiles;
CREATE POLICY "Users can insert own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id::text);
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid()::text = id::text);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own categories." ON public.categories;
CREATE POLICY "Users can view own categories." ON public.categories FOR SELECT USING (auth.uid()::text = user_id::text);
DROP POLICY IF EXISTS "Users can insert own categories." ON public.categories;
CREATE POLICY "Users can insert own categories." ON public.categories FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
DROP POLICY IF EXISTS "Users can update own categories." ON public.categories;
CREATE POLICY "Users can update own categories." ON public.categories FOR UPDATE USING (auth.uid()::text = user_id::text);
DROP POLICY IF EXISTS "Users can delete own categories." ON public.categories;
CREATE POLICY "Users can delete own categories." ON public.categories FOR DELETE USING (auth.uid()::text = user_id::text);

ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own budgets." ON public.monthly_budgets;
CREATE POLICY "Users can CRUD own budgets." ON public.monthly_budgets FOR ALL USING (auth.uid()::text = user_id::text);

ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own incomes via budget." ON public.income_entries;
CREATE POLICY "Users can CRUD own incomes via budget." ON public.income_entries 
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.monthly_budgets WHERE id::text = income_entries.monthly_budget_id::text AND user_id::text = auth.uid()::text
    ));

ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own allocations via budget." ON public.budget_allocations;
CREATE POLICY "Users can CRUD own allocations via budget." ON public.budget_allocations 
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.monthly_budgets WHERE id::text = budget_allocations.monthly_budget_id::text AND user_id::text = auth.uid()::text
    ));

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own transactions via budget." ON public.transactions;
CREATE POLICY "Users can CRUD own transactions via budget." ON public.transactions 
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.monthly_budgets WHERE id::text = transactions.monthly_budget_id::text AND user_id::text = auth.uid()::text
    ));

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own savings goals." ON public.savings_goals;
CREATE POLICY "Users can CRUD own savings goals." ON public.savings_goals FOR ALL USING (auth.uid()::text = user_id::text);

ALTER TABLE public.savings_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own contributions via goal." ON public.savings_contributions;
CREATE POLICY "Users can CRUD own contributions via goal." ON public.savings_contributions 
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.savings_goals WHERE id::text = savings_contributions.savings_goal_id::text AND user_id::text = auth.uid()::text
    ));

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own debts." ON public.debts;
CREATE POLICY "Users can CRUD own debts." ON public.debts FOR ALL USING (auth.uid()::text = user_id::text);

ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own debt payments via debt." ON public.debt_payments;
CREATE POLICY "Users can CRUD own debt payments via debt." ON public.debt_payments
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.debts WHERE id::text = debt_payments.debt_id::text AND user_id::text = auth.uid()::text
    ));
