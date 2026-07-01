import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { budgetService } from '@/services/budget.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

export function useBudgetCategories(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['budget_categories', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => budgetService.listCategories(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('budget_categories', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'budget_categories'>, 'project_id'>) =>
      budgetService.createCategory({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Poste créé'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'budget_categories'> }) =>
      budgetService.updateCategory(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => budgetService.removeCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, categories: query.data ?? [], create, update, remove };
}

export function useExpenses(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['expenses', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => budgetService.listExpenses(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('expenses', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'expenses'>, 'project_id'>) =>
      budgetService.createExpense({ ...payload, project_id: projectId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'expenses'> }) =>
      budgetService.updateExpense(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => budgetService.removeExpense(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Poste supprimé'); },
  });

  return { ...query, expenses: query.data ?? [], create, update, remove };
}
