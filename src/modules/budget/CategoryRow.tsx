import { Pencil, Trash2, FolderPlus, ChevronRight, ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import type { BudgetCategory, BudgetCategoryWithChildren } from '@/types/domain';

export interface CategoryRowProps {
  category: BudgetCategoryWithChildren;
  depth: number;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  categorySpend: (categoryId: string) => { committed: number; actual: number };
  onAddSubcategory: (parentId: string) => void;
  onEdit: (category: BudgetCategory) => void;
  onRemove: (id: string) => void;
}

export function CategoryRow({
  category,
  depth,
  collapsed,
  onToggleCollapse,
  categorySpend,
  onAddSubcategory,
  onEdit,
  onRemove,
}: CategoryRowProps) {
  const spend = categorySpend(category.id);
  const used = spend.committed + spend.actual;
  const planned = Number(category.planned_amount);
  const pct = planned > 0 ? Math.min(100, Math.round((used / planned) * 100)) : 0;
  const hasChildren = category.children.length > 0;
  const isCollapsed = collapsed.has(category.id);

  return (
    <>
      <li className="py-3 text-sm" style={{ paddingLeft: depth * 24 }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 items-start gap-1.5">
            {hasChildren ? (
              <button
                onClick={() => onToggleCollapse(category.id)}
                className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={isCollapsed ? 'Déplier' : 'Replier'}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-slate-800">{category.name}</p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
                <div
                  className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-brand-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {formatCurrency(used)} / {formatCurrency(planned)} ({pct}%)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAddSubcategory(category.id)}
              title="Ajouter une sous-catégorie"
              aria-label="Ajouter une sous-catégorie"
              className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
            <button
              onClick={() => onEdit(category)}
              aria-label="Modifier"
              className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => onRemove(category.id)}
              aria-label="Supprimer"
              className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </li>
      {hasChildren &&
        !isCollapsed &&
        category.children.map((child) => (
          <CategoryRow
            key={child.id}
            category={child}
            depth={depth + 1}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            categorySpend={categorySpend}
            onAddSubcategory={onAddSubcategory}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
    </>
  );
}
