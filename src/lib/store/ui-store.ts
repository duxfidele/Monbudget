import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

export type Category = { id: string; name: string; amount: number; color: string; allocation_id?: string };
export type Transaction = { id: string; label: string; amount: number; category: string; category_id?: string; date: string; type: "expense" | "income" | "income_adjustment" };
export type SavingsContribution = {
  id: string;
  amount: number;
  date: string;
  notes?: string;
};

export type SavingsGoal = {
  id: string;
  name: string;
  target: number;
  current: number;
  color: string;
  target_date?: string;
  status: "active" | "completed" | "paused";
  contributions: SavingsContribution[];
};

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
  addSavingsGoal: (goal: { name: string; target: number; color?: string; target_date?: string }) => Promise<void>;
  removeSavingsGoal: (id: string) => Promise<void>;
  updateSavingsGoalStatus: (id: string, status: "active" | "completed" | "paused") => Promise<void>;
  addSavingsContribution: (goalId: string, amount: number, notes?: string, date?: string) => Promise<void>;
  removeSavingsContribution: (contributionId: string, goalId: string) => Promise<void>;
  addSavingsAmount: (id: string, amount: number) => Promise<void>;

  // Preferences & Init
  alertThreshold: number;
  currency: string;
  payDay: number;
  updatePreferences: (prefs: { alertThreshold?: number; currency?: string; payDay?: number; fullName?: string }) => Promise<void>;
  updateAlertThreshold: (percent: number) => Promise<void>;
  duplicatePreviousMonth: () => Promise<{ prevMonthName: string; allocationsCount: number; income: number }>;
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
  currency: "FCFA",
  payDay: 28,
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

      // Fetch profile for preferences & alert threshold
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      
      if (!profile) {
        // Attempt to create missing profile (fixes issues where trigger failed or user existed before trigger)
        await supabase.from('profiles').insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || 'Utilisateur',
          currency: 'FCFA',
          alert_threshold_percent: 80,
        });
      } else {
        if (profile.alert_threshold_percent) set({ alertThreshold: Number(profile.alert_threshold_percent) });
        if (profile.currency) set({ currency: profile.currency });
        if (profile.pay_day) set({ payDay: Number(profile.pay_day) });
      }

      // 1. Get or Create Monthly Budget
      let { data: budget } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (!budget) {
        const { data: newBudget, error: budgetError } = await supabase
          .from('monthly_budgets')
          .insert({ user_id: user.id, year, month })
          .select()
          .maybeSingle();
          
        if (budgetError) {
          console.error("Erreur lors de la création du budget:", budgetError);
          throw new Error("Impossible de créer le budget mensuel. " + budgetError.message);
        }
        budget = newBudget;
      }

      if (!budget) {
         throw new Error("Budget est toujours null après l'insertion.");
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
      let { data: allCategories } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      // --- DEDUPLICATION AUTOMATIQUE ---
      if (allCategories) {
        const seen = new Set();
        const duplicates = [];
        for (const cat of allCategories) {
          if (seen.has(cat.name.toLowerCase())) {
            duplicates.push(cat.id);
          } else {
            seen.add(cat.name.toLowerCase());
          }
        }
        if (duplicates.length > 0) {
          for (const id of duplicates) {
            await supabase.from('categories').delete().eq('id', id);
          }
          // Refetch after deletion
          const { data: newCats } = await supabase.from('categories').select('*').eq('user_id', user.id).eq('is_active', true);
          allCategories = newCats;
        }
      }
      // ---------------------------------

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
        category: tx.categories?.name || 'Autre (Hors Budget)',
        category_id: tx.category_id,
        date: tx.transaction_date,
        type: tx.type === 'expense' ? 'expense' : 'income_adjustment'
      }));
      
      set({ transactions: mappedTxs });

      // 5. Fetch Savings & Contributions
      const { data: goals } = await supabase
        .from('savings_goals')
        .select('*, savings_contributions(*)')
        .eq('user_id', user.id);

      const mappedGoals: SavingsGoal[] = (goals || []).map(g => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contributions: SavingsContribution[] = (g.savings_contributions || []).map((c: any) => ({
          id: c.id,
          amount: Number(c.amount),
          date: c.contribution_date,
          notes: c.notes || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const sumContribs = contributions.reduce((s, c) => s + c.amount, 0);
        const current = contributions.length > 0 ? sumContribs : Number(g.current_amount || 0);

        return {
          id: g.id,
          name: g.name,
          target: Number(g.target_amount),
          current,
          target_date: g.target_date || undefined,
          status: (g.status as "active" | "completed" | "paused") || "active",
          color: g.color || "bg-blue-500",
          contributions,
        };
      });
      set({ savingsGoals: mappedGoals });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error("Error init store", e);
      if (typeof window !== "undefined") {
        alert("ERREUR CRITIQUE (Envoyez ceci au développeur) : " + (e.message || JSON.stringify(e)));
      }
    }
    set({ isLoading: false });
  },

  updatePreferences: async (prefs) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updates: Record<string, any> = {};
    if (prefs.alertThreshold !== undefined) updates.alert_threshold_percent = prefs.alertThreshold;
    if (prefs.currency !== undefined) updates.currency = prefs.currency;
    if (prefs.payDay !== undefined) updates.pay_day = prefs.payDay;
    if (prefs.fullName !== undefined) {
      updates.full_name = prefs.fullName;
      try {
        await supabase.auth.updateUser({ data: { full_name: prefs.fullName } });
      } catch (err) {
        console.warn("Could not update auth metadata", err);
      }
    }
    await supabase.from('profiles').update(updates).eq('id', user.id);
    set((state) => ({
      alertThreshold: prefs.alertThreshold ?? state.alertThreshold,
      currency: prefs.currency ?? state.currency,
      payDay: prefs.payDay ?? state.payDay,
    }));
  },

  updateAlertThreshold: async (percent) => {
    await get().updatePreferences({ alertThreshold: percent });
  },

  duplicatePreviousMonth: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Utilisateur non connecté");

    const { year, month } = get().activeMonth;
    const currentBudgetId = get().budget_id;
    if (!currentBudgetId) throw new Error("Le budget du mois actuel n'est pas initialisé");

    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevMonthName = new Date(prevYear, prevMonth - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

    // 1. Fetch previous monthly budget
    const { data: prevBudget } = await supabase
      .from('monthly_budgets')
      .select('id')
      .eq('user_id', user.id)
      .eq('year', prevYear)
      .eq('month', prevMonth)
      .maybeSingle();

    if (!prevBudget) {
      throw new Error("Aucun budget trouvé pour le mois précédent (" + prevMonthName + ").");
    }

    // 2. Fetch previous allocations & incomes
    const { data: prevAllocations } = await supabase
      .from('budget_allocations')
      .select('category_id, allocated_amount, notes')
      .eq('monthly_budget_id', prevBudget.id);

    const { data: prevIncomes } = await supabase
      .from('income_entries')
      .select('label, amount')
      .eq('monthly_budget_id', prevBudget.id);

    if ((!prevAllocations || prevAllocations.length === 0) && (!prevIncomes || prevIncomes.length === 0)) {
      throw new Error("Le budget de " + prevMonthName + " ne contient aucune enveloppe ni revenu à dupliquer.");
    }

    // 3. Duplicate Income
    let copiedIncome = 0;
    if (prevIncomes && prevIncomes.length > 0) {
      copiedIncome = prevIncomes.reduce((sum, item) => sum + Number(item.amount), 0);
      await get().setIncome(copiedIncome);
    }

    // 4. Duplicate Allocations
    if (prevAllocations && prevAllocations.length > 0) {
      for (const alloc of prevAllocations) {
        const { data: existingAlloc } = await supabase
          .from('budget_allocations')
          .select('id')
          .eq('monthly_budget_id', currentBudgetId)
          .eq('category_id', alloc.category_id)
          .maybeSingle();

        if (existingAlloc) {
          await supabase
            .from('budget_allocations')
            .update({ allocated_amount: alloc.allocated_amount, notes: alloc.notes })
            .eq('id', existingAlloc.id);
        } else {
          await supabase
            .from('budget_allocations')
            .insert({
              monthly_budget_id: currentBudgetId,
              category_id: alloc.category_id,
              allocated_amount: alloc.allocated_amount,
              notes: alloc.notes
            });
        }
      }
    }

    // 5. Refresh active month state in store
    await get().initStore();
    return {
      prevMonthName,
      allocationsCount: prevAllocations ? prevAllocations.length : 0,
      income: copiedIncome
    };
  },

  setIncome: async (income) => {
    const budgetId = get().budget_id;
    if (budgetId) {
      const { data: existing } = await supabase
        .from('income_entries')
        .select('id')
        .eq('monthly_budget_id', budgetId);

      if (existing && existing.length > 0) {
        await supabase
          .from('income_entries')
          .update({ amount: income, label: 'Salaire principal' })
          .eq('id', existing[0].id);
      } else {
        await supabase
          .from('income_entries')
          .insert({
            monthly_budget_id: budgetId,
            label: 'Salaire principal',
            amount: income,
            received_date: new Date().toISOString().split('T')[0]
          });
      }
    }
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
    // 1. Mise à jour optimiste instantanée en mémoire
    set((state) => ({
      categories: state.categories.map(c => c.id === id ? { ...c, amount } : c)
    }));

    const budgetId = get().budget_id;
    if (!budgetId) return;

    const category = get().categories.find(c => c.id === id);
    if (!category) return;

    try {
      if (category.allocation_id) {
        await supabase.from('budget_allocations').update({ allocated_amount: amount }).eq('id', category.allocation_id);
      } else {
        const { data: newAlloc } = await supabase.from('budget_allocations').insert({
          monthly_budget_id: budgetId,
          category_id: id,
          allocated_amount: amount
        }).select().single();
        if (newAlloc) {
          set((state) => ({
            categories: state.categories.map(c => c.id === id ? { ...c, allocation_id: newAlloc.id } : c)
          }));
        }
      }
    } catch (err) {
      console.warn("Could not sync allocation to Supabase:", err);
    }
  },

  addTransaction: async (tx) => {
    const budgetId = get().budget_id;
    if(!budgetId) {
      alert("Le budget n'est pas chargé. Veuillez patienter ou recharger la page.");
      throw new Error("Le budget n'a pas pu être chargé. Assurez-vous que votre profil est bien configuré (erreur de base de données).");
    }

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
      color: goal.color || "bg-blue-500",
      target_date: goal.target_date || null,
      status: "active",
      current_amount: 0,
    }).select().single();

    if (newGoal) {
      const createdGoal: SavingsGoal = {
        id: newGoal.id,
        name: newGoal.name,
        target: Number(newGoal.target_amount),
        current: 0,
        color: newGoal.color || "bg-blue-500",
        target_date: newGoal.target_date || undefined,
        status: "active",
        contributions: [],
      };
      set((state) => ({ savingsGoals: [createdGoal, ...state.savingsGoals] }));
    }
  },

  removeSavingsGoal: async (id) => {
    await supabase.from('savings_goals').delete().eq('id', id);
    set((state) => ({ savingsGoals: state.savingsGoals.filter(g => g.id !== id) }));
  },

  updateSavingsGoalStatus: async (id, status) => {
    await supabase.from('savings_goals').update({ status }).eq('id', id);
    set((state) => ({
      savingsGoals: state.savingsGoals.map(g => g.id === id ? { ...g, status } : g)
    }));
  },

  addSavingsContribution: async (goalId, amount, notes, date) => {
    const goal = get().savingsGoals.find(g => g.id === goalId);
    if (!goal) return;

    const contributionDate = date || new Date().toISOString().split('T')[0];
    const { data: newContrib, error } = await supabase
      .from('savings_contributions')
      .insert({
        savings_goal_id: goalId,
        amount,
        contribution_date: contributionDate,
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;

    const contribItem: SavingsContribution = {
      id: newContrib ? newContrib.id : Date.now().toString(),
      amount,
      date: contributionDate,
      notes: notes || undefined,
    };

    const newCurrent = goal.current + amount;
    await supabase.from('savings_goals').update({ current_amount: newCurrent }).eq('id', goalId);

    set((state) => ({
      savingsGoals: state.savingsGoals.map(g => {
        if (g.id !== goalId) return g;
        const updatedContributions = [contribItem, ...(g.contributions || [])];
        return {
          ...g,
          current: newCurrent,
          status: newCurrent >= g.target ? "completed" : g.status,
          contributions: updatedContributions,
        };
      })
    }));
  },

  removeSavingsContribution: async (contributionId, goalId) => {
    await supabase.from('savings_contributions').delete().eq('id', contributionId);
    
    set((state) => ({
      savingsGoals: state.savingsGoals.map(g => {
        if (g.id !== goalId) return g;
        const filtered = (g.contributions || []).filter(c => c.id !== contributionId);
        const newCurrent = filtered.reduce((s, c) => s + c.amount, 0);
        return {
          ...g,
          current: newCurrent,
          status: newCurrent >= g.target ? "completed" : "active",
          contributions: filtered,
        };
      })
    }));
  },

  addSavingsAmount: async (id, amount) => {
    await get().addSavingsContribution(id, amount);
  },
}));
