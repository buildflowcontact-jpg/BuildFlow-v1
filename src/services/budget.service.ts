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

  /**
   * Crée une dépense liée à un devis accepté (migration 0044).
   * quote_id n'est pas encore dans les types Supabase générés → insertion via rpc raw.
   */
  async createFromQuote(params: {
    projectId: string;
    quoteId: string;
    title: string;
    amount: number;
    categoryId: string | null;
    expenseDate: string;
  }): Promise<Expense> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('expenses') as any)
      .insert({
        project_id: params.projectId,
        description: params.title,
        amount: params.amount,
        kind: 'committed',
        expense_date: params.expenseDate,
        category_id: params.categoryId ?? null,
        quote_id: params.quoteId,
      })
      .select('*')
      .single();
    if (error) throw error;
    const expense = data as Expense;

    await activityLogsService.log({
      project_id: params.projectId,
      action: 'expense.created',
      entity_type: 'expense',
      entity_id: expense.id,
      metadata: { amount: expense.amount, kind: 'committed', from_quote: params.quoteId },
    });
    return expense;
  },
};
