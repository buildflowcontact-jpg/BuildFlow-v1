-- Sous-catégories budgétaires : une catégorie peut désormais avoir un parent,
-- formant une hiérarchie à un niveau (catégorie -> sous-catégories).
alter table public.budget_categories
  add column if not exists parent_category_id uuid references public.budget_categories(id) on delete cascade;

create index if not exists idx_budget_categories_parent on public.budget_categories(parent_category_id);
