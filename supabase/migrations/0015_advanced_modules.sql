-- =========================================================================
-- BuildFlow — 0015_advanced_modules.sql
--
-- Ajoute les modules identifiés lors de l'analyse concurrentielle (Procore,
-- Buildertrend, CoConstruct) comme écarts à fort ou moyen impact :
--   1. Journal de chantier (rapports journaliers)
--   2. Suivi budgétaire (catégories + dépenses engagées/réelles)
--   3. Demandes d'information (RFI)
--   4. Avenants (change orders) avec signature électronique
--   5. Pointage horaire (time tracking)
--   6. Sélections de matériaux/finitions soumises au client
--   7. Portail client : nouveau rôle "client" sur project_members
--   8. Signatures électroniques génériques (avenants + sélections)
--   9. Pièces jointes polymorphes (journal / RFI / avenant -> documents)
--
-- Principe de sécurité retenu : les tables "internes" (journal de chantier,
-- budget, RFI, pointage) ne sont visibles/modifiables que par les membres
-- "équipe" (owner/collaborator), jamais par le rôle "client". Les avenants
-- et sélections sont visibles par tous les membres du projet (équipe +
-- client) mais leur décision finale (signature/validation) ne peut être
-- prise que via une fonction SECURITY DEFINER dédiée (decide_change_order,
-- decide_selection), qui contourne RLS comme transfer_project_ownership
-- (cf. 0011) — l'UPDATE direct ne permet jamais de passer le statut à
-- "approved"/"rejected".
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. Nouveau rôle "client" sur project_members
-- -------------------------------------------------------------------------
do $$
declare
  v_name text;
begin
  select conname into v_name from pg_constraint
  where conrelid = 'public.project_members'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';
  if v_name is not null then
    execute format('alter table public.project_members drop constraint %I', v_name);
  end if;
end $$;

alter table public.project_members
  add constraint project_members_role_check check (role in ('owner', 'collaborator', 'client'));

-- Fonction utilitaire : membre "équipe" (exclut le rôle client), utilisée
-- pour restreindre les modules internes (journal, budget, RFI, pointage).
create or replace function public.is_project_team_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid() and role in ('owner', 'collaborator')
  );
$$;

-- -------------------------------------------------------------------------
-- 1. JOURNAL DE CHANTIER (rapports journaliers)
-- -------------------------------------------------------------------------
create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  log_date date not null default current_date,
  weather text,
  temperature_c numeric(4,1),
  workers_count int,
  manpower_notes text,
  progress_summary text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_daily_logs_project on public.daily_logs(project_id, log_date desc);

create trigger trg_daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 2. BUDGET / SUIVI DES COÛTS
-- -------------------------------------------------------------------------
create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  planned_amount numeric(14,2) not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_budget_categories_project on public.budget_categories(project_id);

create trigger trg_budget_categories_updated_at
  before update on public.budget_categories
  for each row execute function public.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category_id uuid references public.budget_categories(id) on delete set null,
  description text not null,
  amount numeric(14,2) not null,
  kind text not null default 'actual' check (kind in ('committed', 'actual')),
  expense_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expenses_project on public.expenses(project_id);
create index idx_expenses_category on public.expenses(category_id);

create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 3. RFI (DEMANDES D'INFORMATION)
-- -------------------------------------------------------------------------
create table public.rfis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  number int not null,
  title text not null,
  question text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  raised_by uuid references public.profiles(id) on delete set null,
  due_date date,
  response text,
  responded_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);

create index idx_rfis_project on public.rfis(project_id, status);

create trigger trg_rfis_updated_at
  before update on public.rfis
  for each row execute function public.set_updated_at();

create or replace function public.assign_rfi_number()
returns trigger
language plpgsql
as $$
begin
  if new.number is null then
    select coalesce(max(number), 0) + 1 into new.number
    from public.rfis
    where project_id = new.project_id;
  end if;
  return new;
end;
$$;

create trigger trg_rfis_assign_number
  before insert on public.rfis
  for each row execute function public.assign_rfi_number();

-- -------------------------------------------------------------------------
-- 4. SIGNATURES ÉLECTRONIQUES (génériques : avenants + sélections)
-- -------------------------------------------------------------------------
create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('change_order', 'selection')),
  resource_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  signer_user_id uuid references public.profiles(id) on delete set null,
  signer_name text not null,
  signature_data text not null,
  signed_at timestamptz not null default now()
);

create index idx_signatures_resource on public.signatures(resource_type, resource_id);
create index idx_signatures_project on public.signatures(project_id);

-- -------------------------------------------------------------------------
-- 5. AVENANTS (CHANGE ORDERS)
-- -------------------------------------------------------------------------
create table public.change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  number int not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'rejected')),
  cost_impact numeric(14,2) not null default 0,
  delay_impact_days int not null default 0,
  requested_by uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  signature_id uuid references public.signatures(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);

create index idx_change_orders_project on public.change_orders(project_id, status);

create trigger trg_change_orders_updated_at
  before update on public.change_orders
  for each row execute function public.set_updated_at();

create or replace function public.assign_change_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.number is null then
    select coalesce(max(number), 0) + 1 into new.number
    from public.change_orders
    where project_id = new.project_id;
  end if;
  return new;
end;
$$;

create trigger trg_change_orders_assign_number
  before insert on public.change_orders
  for each row execute function public.assign_change_order_number();

-- -------------------------------------------------------------------------
-- 6. POINTAGE HORAIRE (TIME TRACKING)
-- -------------------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default current_date,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_time_entries_project on public.time_entries(project_id, work_date desc);
create index idx_time_entries_user on public.time_entries(user_id, work_date desc);

create trigger trg_time_entries_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 7. SÉLECTIONS (matériaux / finitions soumis au client)
-- -------------------------------------------------------------------------
create table public.selections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text,
  title text not null,
  description text,
  options jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  selected_option_index int,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_selections_project on public.selections(project_id, status);

create trigger trg_selections_updated_at
  before update on public.selections
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 8. PIÈCES JOINTES POLYMORPHES (journal / RFI / avenant -> documents)
-- -------------------------------------------------------------------------
create table public.resource_attachments (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('daily_log', 'rfi', 'change_order')),
  resource_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (resource_type, resource_id, document_id)
);

create index idx_resource_attachments_resource on public.resource_attachments(resource_type, resource_id);
create index idx_resource_attachments_project on public.resource_attachments(project_id);

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.daily_logs enable row level security;
alter table public.budget_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.rfis enable row level security;
alter table public.signatures enable row level security;
alter table public.change_orders enable row level security;
alter table public.time_entries enable row level security;
alter table public.selections enable row level security;
alter table public.resource_attachments enable row level security;

-- Journal de chantier : équipe uniquement
create policy "daily_logs_select_team" on public.daily_logs
  for select using (public.is_project_team_member(project_id));

create policy "daily_logs_manage_team" on public.daily_logs
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

-- Budget : équipe uniquement (information financière sensible)
create policy "budget_categories_manage_team" on public.budget_categories
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

create policy "expenses_manage_team" on public.expenses
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

-- RFI : équipe uniquement (coordination interne / sous-traitants)
create policy "rfis_select_team" on public.rfis
  for select using (public.is_project_team_member(project_id));

create policy "rfis_manage_team" on public.rfis
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

-- Signatures : lecture si membre du projet concerné, écriture réservée aux
-- fonctions SECURITY DEFINER (decide_change_order / decide_selection).
create policy "signatures_select_member" on public.signatures
  for select using (public.is_project_member(project_id));

-- Avenants : visibles par toute l'équipe + le client (il doit pouvoir les
-- consulter et les signer). Modification directe interdite une fois
-- approuvé/rejeté : seule decide_change_order() peut finaliser.
create policy "change_orders_select_member" on public.change_orders
  for select using (public.is_project_member(project_id));

create policy "change_orders_insert_team" on public.change_orders
  for insert with check (public.is_project_team_member(project_id));

create policy "change_orders_update_team" on public.change_orders
  for update using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id) and status in ('draft', 'pending_approval'));

create policy "change_orders_delete_team" on public.change_orders
  for delete using (public.is_project_team_member(project_id));

-- Pointage horaire : équipe uniquement, chacun gère ses propres saisies
-- (le owner du projet peut tout corriger).
create policy "time_entries_select_team" on public.time_entries
  for select using (public.is_project_team_member(project_id));

create policy "time_entries_insert_own" on public.time_entries
  for insert with check (public.is_project_team_member(project_id) and user_id = (select auth.uid()));

create policy "time_entries_update_own_or_owner" on public.time_entries
  for update using (user_id = (select auth.uid()) or public.is_project_owner(project_id));

create policy "time_entries_delete_own_or_owner" on public.time_entries
  for delete using (user_id = (select auth.uid()) or public.is_project_owner(project_id));

-- Sélections : visibles par toute l'équipe + le client. La définition
-- (titre/options) reste modifiable par l'équipe tant que la sélection est
-- "pending" ; la décision finale passe uniquement par decide_selection().
create policy "selections_select_member" on public.selections
  for select using (public.is_project_member(project_id));

create policy "selections_insert_team" on public.selections
  for insert with check (public.is_project_team_member(project_id));

create policy "selections_update_team" on public.selections
  for update using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id) and status = 'pending');

create policy "selections_delete_team" on public.selections
  for delete using (public.is_project_team_member(project_id));

-- Pièces jointes : lecture pour tout membre du projet (le document lié
-- reste de toute façon protégé par sa propre policy), écriture équipe.
create policy "resource_attachments_select_member" on public.resource_attachments
  for select using (public.is_project_member(project_id));

create policy "resource_attachments_manage_team" on public.resource_attachments
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

-- =========================================================================
-- Fonctions SECURITY DEFINER : décisions finales (signature / validation)
-- =========================================================================

-- Approuve (avec signature) ou rejette un avenant en attente d'approbation.
create or replace function public.decide_change_order(
  p_change_order_id uuid,
  p_approve boolean,
  p_signature_data text default null,
  p_signer_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_status text;
  v_requested_by uuid;
  v_signature_id uuid;
begin
  select project_id, status, requested_by into v_project_id, v_status, v_requested_by
  from public.change_orders
  where id = p_change_order_id;

  if v_project_id is null then
    raise exception 'Avenant introuvable';
  end if;

  if not public.is_project_member(v_project_id) then
    raise exception 'Action non autorisée';
  end if;

  if v_status <> 'pending_approval' then
    raise exception 'Cet avenant n''est pas en attente d''approbation';
  end if;

  if p_approve then
    if p_signature_data is null or p_signer_name is null then
      raise exception 'Une signature est requise pour approuver un avenant';
    end if;

    insert into public.signatures (resource_type, resource_id, project_id, signer_user_id, signer_name, signature_data)
    values ('change_order', p_change_order_id, v_project_id, auth.uid(), p_signer_name, p_signature_data)
    returning id into v_signature_id;

    update public.change_orders
    set status = 'approved', decided_by = auth.uid(), decided_at = now(), signature_id = v_signature_id, updated_at = now()
    where id = p_change_order_id;
  else
    update public.change_orders
    set status = 'rejected', decided_by = auth.uid(), decided_at = now(), updated_at = now()
    where id = p_change_order_id;
  end if;

  insert into public.activity_logs (project_id, user_id, action, entity_type, entity_id, metadata)
  values (
    v_project_id, auth.uid(),
    case when p_approve then 'change_order.approved' else 'change_order.rejected' end,
    'change_order', p_change_order_id, '{}'::jsonb
  );

  if v_requested_by is not null then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      v_requested_by,
      'change_order_decision',
      case when p_approve then 'Avenant approuvé' else 'Avenant rejeté' end,
      case when p_approve then 'Votre avenant a été signé et approuvé.' else 'Votre avenant a été rejeté.' end,
      '/projects/' || v_project_id || '/change-orders'
    );
  end if;
end;
$$;

revoke all on function public.decide_change_order(uuid, boolean, text, text) from public;
grant execute on function public.decide_change_order(uuid, boolean, text, text) to authenticated;

-- Valide (avec signature optionnelle) une sélection en attente.
create or replace function public.decide_selection(
  p_selection_id uuid,
  p_selected_option_index int,
  p_signature_data text default null,
  p_signer_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_status text;
  v_options_count int;
  v_created_by uuid;
  v_signature_id uuid;
begin
  select project_id, status, jsonb_array_length(options), created_by
    into v_project_id, v_status, v_options_count, v_created_by
  from public.selections
  where id = p_selection_id;

  if v_project_id is null then
    raise exception 'Sélection introuvable';
  end if;

  if not public.is_project_member(v_project_id) then
    raise exception 'Action non autorisée';
  end if;

  if v_status <> 'pending' then
    raise exception 'Cette sélection a déjà été décidée';
  end if;

  if p_selected_option_index < 0 or p_selected_option_index >= v_options_count then
    raise exception 'Option sélectionnée invalide';
  end if;

  if p_signature_data is not null and p_signer_name is not null then
    insert into public.signatures (resource_type, resource_id, project_id, signer_user_id, signer_name, signature_data)
    values ('selection', p_selection_id, v_project_id, auth.uid(), p_signer_name, p_signature_data)
    returning id into v_signature_id;
  end if;

  update public.selections
  set status = 'approved', selected_option_index = p_selected_option_index,
      decided_by = auth.uid(), decided_at = now(), updated_at = now()
  where id = p_selection_id;

  insert into public.activity_logs (project_id, user_id, action, entity_type, entity_id, metadata)
  values (v_project_id, auth.uid(), 'selection.decided', 'selection', p_selection_id,
          jsonb_build_object('selected_option_index', p_selected_option_index));

  if v_created_by is not null then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      v_created_by, 'selection_decided', 'Sélection validée',
      'Le client a validé une option pour une sélection.',
      '/projects/' || v_project_id || '/selections'
    );
  end if;
end;
$$;

revoke all on function public.decide_selection(uuid, int, text, text) from public;
grant execute on function public.decide_selection(uuid, int, text, text) to authenticated;
