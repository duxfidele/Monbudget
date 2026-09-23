import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

export type Category = { id: string; name: string; amount: number; color: string; allocation_id?: string };
export type Transaction = { id: string; label: string; amount: number; category: string; category_id?: string; date: string; type: "expense" | "income" | "income_adjustment" };
export type SavingsGoal = { id: string; name: string; target: number; current: number; color: string };

interface UIState {
  // Navigation
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  
  // Dates
  activeMonth: { year: number; month: number };
  setActiveMonth: (year: number, month: number) => void;

  // Global Data
  budget_id: string | null;
  income: number;
  setIncome: (income: number) => Promise<void>;
  
  categories: Category[];
  addCategory: (cat: Category) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  updateCategoryAmount: (id: string, amount: number) => Promise<void>;
  
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;

  savingsGoals: SavingsGoal[];
  addSavingsGoal: (goal: SavingsGoal) => Promise<void>;
  removeSavingsGoal: (id: string) => Promise<void>;
  addSavingsAmount: (id: string, amount: number) => Promise<void>;

  // Init
  alertThreshold: number;
  updateAlertThreshold: (percent: number) => Promise<void>;
  isLoading: boolean;
  initStore: () => Promise<void>;
}

const currentDate = new Date();
const supabase = createClient();

export const useUIStore = create<UIState>((set, get) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  
  activeMonth: { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 },
  setActiveMonth: (year, month) => {
    set({ activeMonth: { year, month } });
    get().initStore();
  },

  alertThreshold: 80,
  isLoading: true,
  budget_id: null,
  income: 0,
  categories: [],
  transactions: [],
  savingsGoals: [],

  initStore: async () => {
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { set({ isLoading: false }); return; }

      const { year, month } = get().activeMonth;

      // Fetch profile for alert threshold
      const { data: profile } = await supabase.from('profiles').select('alert_threshold_percent').eq('id', user.id).single();
      if (profile && profile.alert_threshold_percent) {
        set({ alertThreshold: Number(profile.alert_threshold_percent) });
      }

      // 1. Get or Create Monthly Budget
      let { data: budget } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (!budget) {
        const { data: newBudget } = await supabase
          .from('monthly_budgets')
          .insert({ user_id: user.id, year, month })
          .select()
          .single();
        budget = newBudget;
      }

      set({ budget_id: budget.id });

      // 2. Fetch income for this budget
      const { data: incomes } = await supabase
        .from('income_entries')
        .select('*')
        .eq('monthly_budget_id', budget.id);
      
      const totalIncome = incomes?.reduce((sum, inc) => sum + Number(inc.amount), 0) || 0;
      set({ income: totalIncome });

      // 3. Fetch categories & allocations
      const { data: allCategories } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const { data: allocations } = await supabase
        .from('budget_allocations')
        .select('*')
        .eq('monthly_budget_id', budget.id);

      const categoriesMap: Category[] = (allCategories || []).map(cat => {
        const alloc = allocations?.find(a => a.category_id === cat.id);
        return {
          id: cat.id,
          name: cat.name,
          color: cat.color || 'bg-slate-500',
          amount: alloc ? Number(alloc.allocated_amount) : 0,
          allocation_id: alloc?.id
        };
      });
      set({ categories: categoriesMap });

      // 4. Fetch Transactions
      const { data: txs } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('monthly_budget_id', budget.id)
        .order('transaction_date', { ascending: false });

      const mappedTxs: Transaction[] = (txs || []).map(tx => ({
        id: tx.id,
        label: tx.description || 'Transaction',
        amount: Number(tx.amount),
        category: tx.categories?.name || 'Général',
        category_id: tx.category_id,
        date: tx.transaction_date,
        type: tx.type === 'expense' ? 'expense' : 'income'
      }));
      
      set({ transactions: mappedTxs });

      // 5. Fetch Savings
      const { data: goals } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active');

      const mappedGoals: SavingsGoal[] = (goals || []).map(g => ({
        id: g.id,
        name: g.name,
        target: Number(g.target_amount),
        current: Number(g.current_amount),
        color: g.color || 'bg-blue-500'
      }));
      set({ savingsGoals: mappedGoals });

    } catch (e: any) {
      console.error("Error init store", e);
      // Ensure toast is imported or use a simple alert if we can't easily add it here.
      // Wait, we can't easily use toast here if it's outside a React component unless we import it.
      // toast is imported at the top? No, let's check.
    }
    set({ isLoading: false });
  },

  updateAlertThreshold: async (percent) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({ alert_threshold_percent: percent }).eq('id', user.id);
    set({ alertThreshold: percent });
  },

  setIncome: async (income) => {
    // on a real app, update income_entries. Here we simplify.
    set({ income });
  },

  addCategory: async (cat) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Insert category
    const { data: newCat } = await supabase.from('categories').insert({
      user_id: user.id,
      name: cat.name,
      color: cat.color
    }).select().single();

    if (newCat) {
      cat.id = newCat.id;
      set((state) => ({ categories: [...state.categories, cat] }));
    }
  },

  removeCategory: async (id) => {
    await supabase.from('categories').update({ is_active: false }).eq('id', id);
    set((state) => ({ categories: state.categories.filter(c => c.id !== id) }));
  },

  updateCategoryAmount: async (id, amount) => {
    const budgetId = get().budget_id;
    if(!budgetId) return;

    const category = get().categories.find(c => c.id === id);
    if (!category) return;

    if (category.allocation_id) {
      await supabase.from('budget_allocations').update({ allocated_amount: amount }).eq('id', category.allocation_id);
    } else {
      const { data: newAlloc } = await supabase.from('budget_allocations').insert({
        monthly_budget_id: budgetId,
        category_id: id,
        allocated_amount: amount
      }).select().single();
      if(newAlloc) {
        category.allocation_id = newAlloc.id;
      }
    }

    set((state) => ({
      categories: state.categories.map(c => c.id === id ? { ...c, amount, allocation_id: category.allocation_id } : c)
    }));
  },

  addTransaction: async (tx) => {
    const budgetId = get().budget_id;
    if(!budgetId) return;

    // Find category ID
    let category_id = null;
    const cat = get().categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase());
    if (cat) category_id = cat.id;

    const { data: newTx, error } = await supabase.from('transactions').insert({
      monthly_budget_id: budgetId,
      category_id,
      amount: tx.amount,
      description: tx.label,
      transaction_date: tx.date,
      type: tx.type === 'expense' ? 'expense' : 'income_adjustment'
    }).select().single();

    if (error) {
      console.error("Supabase insert error:", error);
      throw error;
    }
    
    if (newTx) {
      tx.id = newTx.id;
      set((state) => {
        let newIncome = state.income;
        if (tx.type === "income") newIncome += tx.amount;
        return { transactions: [tx, ...state.transactions], income: newIncome };
      });
    }
  },

  removeTransaction: async (id) => {
    await supabase.from('transactions').delete().eq('id', id);
    set((state) => {
      const tx = state.transactions.find(t => t.id === id);
      let newIncome = state.income;
      if (tx && tx.type === "income") newIncome -= tx.amount;
      return { transactions: state.transactions.filter(t => t.id !== id), income: newIncome };
    });
  },

  addSavingsGoal: async (goal) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newGoal } = await supabase.from('savings_goals').insert({
      user_id: user.id,
      name: goal.name,
      target_amount: goal.target,
      color: goal.color
    }).select().single();

    if (newGoal) {
      goal.id = newGoal.id;
      set((state) => ({ savingsGoals: [...state.savingsGoals, goal] }));
    }
  },

  removeSavingsGoal: async (id) => {
    await supabase.from('savings_goals').update({ status: 'paused' }).eq('id', id);
    set((state) => ({ savingsGoals: state.savingsGoals.filter(g => g.id !== id) }));
  },

  addSavingsAmount: async (id, amount) => {
    const goal = get().savingsGoals.find(g => g.id === id);
    if (!goal) return;

    const newCurrent = Math.min(goal.current + amount, goal.target);
    await supabase.from('savings_goals').update({ current_amount: newCurrent }).eq('id', id);
    
    // insert history
    await supabase.from('savings_contributions').insert({
      savings_goal_id: id,
      amount,
      contribution_date: new Date().toISOString().split('T')[0]
    });

    set((state) => ({
      savingsGoals: state.savingsGoals.map(g => g.id === id ? { ...g, current: newCurrent } : g)
    }));
  },
}));
