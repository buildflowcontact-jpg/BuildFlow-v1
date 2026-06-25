import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { BudgetCategory, Expense } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export const budgetService = {
  async listCategories(projectId: string): Promise<BudgetCategory[]> {
    return unwrap(
      await supabase.from('budget_categories').select('*').eq('project_id', projectId).order('position', { ascending: true })
    );
  },

  async createCategory(payload: TablesInsert<'budget_categories'>): Promise<BudgetCategory> {
    return unwrap(await supabase.from('budget_categories').insert(payload).select('*').single());
  },

  async updateCategory(id: string, payload: TablesUpdate<'budget_categories'>): Promise<BudgetCategory> {
    return unwrap(await supabase.from('budget_categories').update(payload).eq('id', id).select('*').single());
  },

  async removeCategory(id: string): Promise<void> {
    const { error } = await supabase.from('budget_categories').delete().eq('id', id);
    if (error) throw error;
  },

  async listExpenses(projectId: string): Promise<Expense[]> {
    return unwrap(
      await supabase.from('expenses').select('*').eq('project_id', projectId).order('expense_date', { ascending: false })
    );
  },

  async createExpense(payload: TablesInsert<'expenses'>): Promise<Expense> {
    const expense = unwrap(await supabase.from('expenses').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: expense.project_id,
      action: 'expense.created',
      entity_type: 'expense',
      entity_id: expense.id,
      metadata: { amount: expense.amount, kind: expense.kind },
    });
    return expense;
  },

  async updateExpense(id: string, payload: TablesUpdate<'expenses'>): Promise<Expense> {
    return unwrap(await supabase.from('expenses').update(payload).eq('id', id).select('*').single());
  },

  async removeExpense(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  },
};
