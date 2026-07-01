import { useMemo, useState } from 'react';
import { Plus, Wallet, Pencil, Trash2, FolderPlus, FileCheck } from 'lucide-react';
import { useBudgetCategories, useExpenses } from '@/hooks/useBudget';
import { useQuotes } from '@/hooks/useQuotes';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { EXPENSE_KIND_LABELS } from '@/types/domain';
import type { BudgetCategory, BudgetCategoryWithChildren, Expense } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';
import { CategoryRow } from './CategoryRow';
import { confirmStore } from '@/components/ui/ConfirmModal';

type CategoryFormState = { name: string; planned_amount: string; parent_category_id: string };

/** Construit l'arbre des catégories (un seul niveau de profondeur supporté). */
function buildCategoryTree(categories: BudgetCategory[]): BudgetCategoryWithChildren[] {
  const byId = new Map<string, BudgetCategoryWithChildren>(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots: BudgetCategoryWithChildren[] = [];
  for (const category of categories) {
    const node = byId.get(category.id)!;
    const parent = category.parent_category_id ? byId.get(category.parent_category_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
type ExpenseFormState = {
  category_id: string;
  description: string;
  amount: string;
  kind: Expense['kind'];
  expense_date: string;
};

function emptyCategoryForm(parentId = ''): CategoryFormState {
  return { name: '', planned_amount: '', parent_category_id: parentId };
}

function emptyExpenseForm(): ExpenseFormState {
  return {
    category_id: '',
    description: '',
    amount: '',
    kind: 'actual',
    expense_date: new Date().toISOString().slice(0, 10),
  };
}

interface BudgetTabProps {
  projectId: string;
}

export function BudgetTab({ projectId }: BudgetTabProps) {
  const { categories, isLoading: categoriesLoading, create: createCategory, update: updateCategory, remove: removeCategory } =
    useBudgetCategories(projectId);
  const { expenses, isLoading: expensesLoading, create: createExpense, update: updateExpense, remove: removeExpense, createFromQuote } =
    useExpenses(projectId);
  const { quotes, isLoading: quotesLoading } = useQuotes(projectId);

const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(emptyExpenseForm());

  const totals = useMemo(() => {
    // Seules les catégories racines comptent dans le total prévu : les
    // sous-catégories détaillent le budget de leur parent, elles ne s'y ajoutent pas.
    const planned = categories
      .filter((c) => !c.parent_category_id)
      .reduce((sum, c) => sum + Number(c.planned_amount), 0);
    const committed = expenses.filter((e) => e.kind === 'committed').reduce((sum, e) => sum + Number(e.amount), 0);
    const actual = expenses.filter((e) => e.kind === 'actual').reduce((sum, e) => sum + Number(e.amount), 0);
    return { planned, committed, actual };
  }, [categories, expenses]);

  function descendantIds(categoryId: string): string[] {
    const direct = categories.filter((c) => c.parent_category_id === categoryId).map((c) => c.id);
    return [categoryId, ...direct.flatMap((id) => descendantIds(id))];
  }

  /** Dépenses de la catégorie, en incluant celles de ses sous-catégories. */
  function categorySpend(categoryId: string) {
    const ids = new Set(descendantIds(categoryId));
    const rows = expenses.filter((e) => e.category_id && ids.has(e.category_id));
    return {
      committed: rows.filter((e) => e.kind === 'committed').reduce((sum, e) => sum + Number(e.amount), 0),
      actual: rows.filter((e) => e.kind === 'actual').reduce((sum, e) => sum + Number(e.amount), 0),
    };
  }

  function openCreateCategory(parentId?: string) {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm(parentId ?? ''));
    setCategoryModalOpen(true);
  }

  function openEditCategory(category: BudgetCategory) {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      planned_amount: category.planned_amount.toString(),
      parent_category_id: category.parent_category_id ?? '',
    });
    setCategoryModalOpen(true);
  }

  function handleCategorySubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'budget_categories'>, 'project_id'> = {
      name: categoryForm.name,
      planned_amount: categoryForm.planned_amount ? Number(categoryForm.planned_amount) : 0,
      parent_category_id: categoryForm.parent_category_id || null,
    };
    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, payload }, { onSuccess: () => setCategoryModalOpen(false) });
    } else {
      createCategory.mutate(payload, { onSuccess: () => setCategoryModalOpen(false) });
    }
  }

  function openCreateExpense() {
    setEditingExpense(null);
    setExpenseForm(emptyExpenseForm());
    setExpenseModalOpen(true);
  }

  function openEditExpense(expense: Expense) {
    setEditingExpense(expense);
    setExpenseForm({
      category_id: expense.category_id ?? '',
      description: expense.description,
      amount: expense.amount.toString(),
      kind: expense.kind,
      expense_date: expense.expense_date,
    });
    setExpenseModalOpen(true);
  }

  function handleExpenseSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'expenses'>, 'project_id'> = {
      category_id: expenseForm.category_id || null,
      description: expenseForm.description,
      amount: Number(expenseForm.amount || 0),
      kind: expenseForm.kind,
      expense_date: expenseForm.expense_date,
    };
    if (editingExpense) {
      updateExpense.mutate({ id: editingExpense.id, payload }, { onSuccess: () => setExpenseModalOpen(false) });
    } else {
      createExpense.mutate(payload, { onSuccess: () => setExpenseModalOpen(false) });
    }
  }

  function categoryName(id: string | null) {
    if (!id) return 'Sans poste';
    return categories.find((c) => c.id === id)?.name ?? 'Poste supprimé';
  }

  // Devis acceptés pas encore liés à une ligne budgétaire
  const linkedQuoteIds = useMemo(() => new Set(expenses.map((e) => e.quote_id).filter(Boolean)), [expenses]);
  const acceptedUnlinkedQuotes = useMemo(
    () => quotes.filter((q) => q.status === 'accepted' && !linkedQuoteIds.has(q.id)),
    [quotes, linkedQuoteIds],
  );

  // Modal "Budgétiser ce devis"
  const [budgetizeQuote, setBudgetizeQuote] = useState<{ id: string; title: string; total: number } | null>(null);
  const [budgetizeCategoryId, setBudgetizeCategoryId] = useState('');

  function handleBudgetizeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!budgetizeQuote) return;
    createFromQuote.mutate(
      {
        projectId,
        quoteId: budgetizeQuote.id,
        title: budgetizeQuote.title,
        amount: budgetizeQuote.total,
        categoryId: budgetizeCategoryId || null,
        expenseDate: new Date().toISOString().slice(0, 10),
      },
      {
        onSuccess: () => {
          setBudgetizeQuote(null);
          setBudgetizeCategoryId('');
        },
      },
    );
  }

  if (categoriesLoading || expensesLoading || quotesLoading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Budget prévu</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(totals.planned)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Engagé</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{formatCurrency(totals.committed)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Dépensé</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(totals.actual)}</p>
        </Card>
      </div>

      {acceptedUnlinkedQuotes.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-emerald-500" />
            <h3 className="text-base font-semibold text-slate-900">Devis acceptés à budgétiser</h3>
            <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
              {acceptedUnlinkedQuotes.length}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {acceptedUnlinkedQuotes.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{q.title}</p>
                  <p className="text-xs text-slate-400">
                    N°{q.number} · {formatDate(q.created_at)}
                  </p>
                </div>
                <p className="w-28 text-right font-medium text-slate-700">{formatCurrency(q.total)}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBudgetizeQuote({ id: q.id, title: q.title, total: q.total });
                    setBudgetizeCategoryId('');
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Budgétiser
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Postes budgétaires</h3>
            <p className="text-sm text-slate-500">{categories.length} poste(s)</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => openCreateCategory()}>
            <FolderPlus className="h-4 w-4" />
            Nouveau poste
          </Button>
        </div>

        {categories.length === 0 ? (
          <EmptyState icon={Wallet} title="Aucun poste" description="Créez des postes pour structurer le budget." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {categoryTree.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                depth={0}
                collapsed={collapsed}
                onToggleCollapse={toggleCollapsed}
                categorySpend={categorySpend}
                onAddSubcategory={openCreateCategory}
                onEdit={openEditCategory}
                onRemove={(id) => {
                  confirmStore.getState().show({ message: 'Supprimer ce poste (et ses sous-postes) ?' }).then((ok) => { if (ok) removeCategory.mutate(id); });
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Dépenses</h3>
            <p className="text-sm text-slate-500">{expenses.length} ligne(s)</p>
          </div>
          <Button size="sm" onClick={openCreateExpense}>
            <Plus className="h-4 w-4" />
            Nouvelle dépense
          </Button>
        </div>

        {expenses.length === 0 ? (
          <EmptyState icon={Wallet} title="Aucune dépense" description="Enregistrez les montants engagés et réels." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{expense.description}</p>
                  <p className="text-xs text-slate-400">
                    {categoryName(expense.category_id)} · {formatDate(expense.expense_date)}
                  </p>
                </div>
                <Badge tone={expense.kind === 'committed' ? 'yellow' : 'green'}>
                  {EXPENSE_KIND_LABELS[expense.kind]}
                </Badge>
                <p className="w-28 text-right font-medium text-slate-800">{formatCurrency(expense.amount)}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditExpense(expense)}
                    aria-label="Modifier"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      confirmStore.getState().show({ message: 'Supprimer cette dépense ?' }).then((ok) => { if (ok) removeExpense.mutate(expense.id); });
                    }}
                    aria-label="Supprimer"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? 'Modifier le poste' : 'Nouveau poste'}
      >
        <form onSubmit={handleCategorySubmit} className="flex flex-col gap-4">
          <Input id="categoryform-name"
            label="Nom"
            required
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
          />
          <Input id="categoryform-planned-amount"
            type="number"
            step="0.01"
            min="0"
            label="Montant prévu"
            value={categoryForm.planned_amount}
            onChange={(e) => setCategoryForm({ ...categoryForm, planned_amount: e.target.value })}
          />
          <Select id="categoryform-parent-category-id"
            label="Poste parent"
            value={categoryForm.parent_category_id}
            onChange={(e) => setCategoryForm({ ...categoryForm, parent_category_id: e.target.value })}
          >
            <option value="">Aucun (poste racine)</option>
            {categories
              .filter((c) => c.id !== editingCategory?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={createCategory.isPending || updateCategory.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(budgetizeQuote)}
        onClose={() => setBudgetizeQuote(null)}
        title="Ajouter au budget"
      >
        {budgetizeQuote && (
          <form onSubmit={handleBudgetizeSubmit} className="flex flex-col gap-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-800">{budgetizeQuote.title}</p>
              <p className="text-slate-500">{formatCurrency(budgetizeQuote.total)}</p>
            </div>
            <Select
              id="budgetize-category-id"
              label="Affecter au poste"
              value={budgetizeCategoryId}
              onChange={(e) => setBudgetizeCategoryId(e.target.value)}
            >
              <option value="">Sans poste</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setBudgetizeQuote(null)}>
                Annuler
              </Button>
              <Button type="submit" loading={createFromQuote.isPending}>
                Ajouter au budget
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title={editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
      >
        <form onSubmit={handleExpenseSubmit} className="flex flex-col gap-4">
          <Select id="expenseform-category-id"
            label="Poste"
            value={expenseForm.category_id}
            onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
          >
            <option value="">Sans poste</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input id="expenseform-description"
            label="Description"
            required
            value={expenseForm.description}
            onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input id="expenseform-amount"
              type="number"
              step="0.01"
              min="0"
              label="Montant"
              required
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
            <Input id="expenseform-expense-date"
              type="date"
              label="Date"
              required
              value={expenseForm.expense_date}
              onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
            />
          </div>
          <Select id="expenseform-kind"
            label="Type"
            value={expenseForm.kind}
            onChange={(e) => setExpenseForm({ ...expenseForm, kind: e.target.value as Expense['kind'] })}
          >
            {Object.entries(EXPENSE_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setExpenseModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={createExpense.isPending || updateExpense.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
