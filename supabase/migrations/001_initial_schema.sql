-- Schema init for MonBudget
-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-------------------------------------------------------------------------------
-- 1. PROFILES
-------------------------------------------------------------------------------
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    currency TEXT DEFAULT 'EUR' NOT NULL,
    locale TEXT DEFAULT 'fr-FR' NOT NULL,
    alert_threshold_percent DECIMAL DEFAULT 80.0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile." ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Function to handle new user registration via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-------------------------------------------------------------------------------
-- 2. CATEGORIES
-------------------------------------------------------------------------------
CREATE TABLE categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own categories." ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories." ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories." ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories." ON categories FOR DELETE USING (auth.uid() = user_id);

-------------------------------------------------------------------------------
-- 3. MONTHLY BUDGETS
-------------------------------------------------------------------------------
CREATE TABLE monthly_budgets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, year, month)
);

ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own budgets." ON monthly_budgets FOR ALL USING (auth.uid() = user_id);

-------------------------------------------------------------------------------
-- 4. INCOME ENTRIES
-------------------------------------------------------------------------------
CREATE TABLE income_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    monthly_budget_id UUID REFERENCES monthly_budgets(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    received_date DATE
);

ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own incomes via budget." ON income_entries 
    FOR ALL USING (EXISTS (
        SELECT 1 FROM monthly_budgets WHERE id = income_entries.monthly_budget_id AND user_id = auth.uid()
    ));

-------------------------------------------------------------------------------
-- 5. BUDGET ALLOCATIONS
-------------------------------------------------------------------------------
CREATE TABLE budget_allocations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    monthly_budget_id UUID REFERENCES monthly_budgets(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    allocated_amount DECIMAL NOT NULL DEFAULT 0,
    notes TEXT,
    UNIQUE(monthly_budget_id, category_id)
);

ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own allocations via budget." ON budget_allocations 
    FOR ALL USING (EXISTS (
        SELECT 1 FROM monthly_budgets WHERE id = budget_allocations.monthly_budget_id AND user_id = auth.uid()
    ));

-------------------------------------------------------------------------------
-- 6. TRANSACTIONS
-------------------------------------------------------------------------------
CREATE TABLE transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    monthly_budget_id UUID REFERENCES monthly_budgets(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    amount DECIMAL NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    type TEXT DEFAULT 'expense' CHECK (type IN ('expense', 'income_adjustment'))
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own transactions via budget." ON transactions 
    FOR ALL USING (EXISTS (
        SELECT 1 FROM monthly_budgets WHERE id = transactions.monthly_budget_id AND user_id = auth.uid()
    ));

-------------------------------------------------------------------------------
-- 7. SAVINGS GOALS & CONTRIBUTIONS
-------------------------------------------------------------------------------
CREATE TABLE savings_goals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    target_amount DECIMAL NOT NULL,
    current_amount DECIMAL DEFAULT 0 NOT NULL,
    target_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    color TEXT,
    icon TEXT
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own savings goals." ON savings_goals FOR ALL USING (auth.uid() = user_id);

CREATE TABLE savings_contributions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    savings_goal_id UUID REFERENCES savings_goals(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL NOT NULL,
    contribution_date DATE NOT NULL,
    notes TEXT
);

ALTER TABLE savings_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own contributions via goal." ON savings_contributions 
    FOR ALL USING (EXISTS (
        SELECT 1 FROM savings_goals WHERE id = savings_contributions.savings_goal_id AND user_id = auth.uid()
    ));
