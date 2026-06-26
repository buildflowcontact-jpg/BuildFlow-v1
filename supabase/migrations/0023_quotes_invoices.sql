-- =========================================================================
-- BuildFlow — 0023_quotes_invoices.sql
--
-- Module Devis & Facturation (écart identifié face à Vertuoza/Obat/Graneet).
-- Portée de cette première itération :
--   1. Informations légales facturation sur organizations + clients (SIRET,
--      TVA, IBAN, mentions de pénalités de retard...).
--   2. Devis (quotes) avec lignes (quote_items), numérotation par
--      organisation, acceptation par le client via signature électronique
--      (réutilise le pattern decide_change_order/decide_selection).
--   3. Factures (invoices) avec lignes (invoice_items) et paiements
--      (invoice_payments), numérotation séquentielle SANS TROU par
--      organisation (obligation légale), catégorie d'opération
--      (biens/services/mixte — nouvelle mention 2026).
--
-- Hors-périmètre volontaire de cette itération : la transmission réelle des
-- factures via une Plateforme de Dématérialisation Partenaire (PDP) agréée
-- (obligatoire au 1er sept. 2026 pour grandes entreprises/ETI, 1er sept. 2027
-- pour PME/TPE). BuildFlow génère ici des factures au format Factur-X
-- (PDF/A-3 + XML CII), prêtes à être déposées sur la PDP choisie par
-- l'utilisateur — l'intégration d'une PDP spécifique est un chantier à part
-- (cf. tâche de suivi).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. Informations légales de facturation
-- -------------------------------------------------------------------------
alter table public.organizations
  add column siret text,
  add column vat_number text,
  add column legal_address text,
  add column iban text,
  add column bic text,
  add column default_payment_terms_days int not null default 30,
  add column default_late_penalty_rate numeric(5,2),
  add column default_recovery_indemnity numeric(10,2) not null default 40;

alter table public.clients
  add column siret text,
  add column vat_number text,
  add column billing_address text;

-- -------------------------------------------------------------------------
-- 1. DEVIS (QUOTES)
-- -------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  number int,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),
  issue_date date not null default current_date,
  validity_until date,
  notes text,
  subtotal numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency text not null default 'EUR',
  accepted_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  signature_id uuid references public.signatures(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);

create index idx_quotes_project on public.quotes(project_id, status);
create index idx_quotes_client on public.quotes(client_id);

create trigger trg_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- L'organisation est toujours dérivée du projet (jamais fournie par le
-- client de l'API) pour que la numérotation légale reste cohérente.
create or replace function public.set_quote_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select organization_id into new.organization_id from public.projects where id = new.project_id;
  if new.organization_id is null then
    raise exception 'Projet introuvable';
  end if;
  return new;
end;
$$;

create trigger trg_quotes_set_organization
  before insert on public.quotes
  for each row execute function public.set_quote_organization();

create or replace function public.assign_quote_number()
returns trigger
language plpgsql
as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtext('quote_number:' || new.organization_id::text));
    select coalesce(max(number), 0) + 1 into new.number
    from public.quotes
    where organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

create trigger trg_quotes_assign_number
  before insert on public.quotes
  for each row execute function public.assign_quote_number();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  position int not null default 0,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit text not null default 'u',
  unit_price numeric(14,2) not null default 0,
  vat_rate numeric(5,2) not null default 20,
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create index idx_quote_items_quote on public.quote_items(quote_id, position);

-- -------------------------------------------------------------------------
-- 2. FACTURES (INVOICES)
-- -------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  number int,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  operation_category text not null default 'services' check (operation_category in ('biens', 'services', 'mixte')),
  issue_date date not null default current_date,
  due_date date,
  payment_terms_days int,
  late_penalty_rate numeric(5,2),
  recovery_indemnity_amount numeric(10,2),
  notes text,
  subtotal numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  currency text not null default 'EUR',
  facturx_storage_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);

create index idx_invoices_project on public.invoices(project_id, status);
create index idx_invoices_client on public.invoices(client_id);
create index idx_invoices_quote on public.invoices(quote_id);

create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create or replace function public.set_invoice_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
begin
  select * into v_org from public.organizations where id = (
    select organization_id from public.projects where id = new.project_id
  );
  if v_org.id is null then
    raise exception 'Projet introuvable';
  end if;
  new.organization_id := v_org.id;
  if new.payment_terms_days is null then
    new.payment_terms_days := v_org.default_payment_terms_days;
  end if;
  if new.late_penalty_rate is null then
    new.late_penalty_rate := v_org.default_late_penalty_rate;
  end if;
  if new.recovery_indemnity_amount is null then
    new.recovery_indemnity_amount := v_org.default_recovery_indemnity;
  end if;
  if new.due_date is null then
    new.due_date := new.issue_date + (coalesce(new.payment_terms_days, 30) || ' days')::interval;
  end if;
  return new;
end;
$$;

create trigger trg_invoices_set_defaults
  before insert on public.invoices
  for each row execute function public.set_invoice_defaults();

-- Numérotation séquentielle SANS TROU par organisation (obligation légale
-- de continuité des factures) : verrou consultatif pour sérialiser les
-- insertions concurrentes au sein d'une même organisation.
create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtext('invoice_number:' || new.organization_id::text));
    select coalesce(max(number), 0) + 1 into new.number
    from public.invoices
    where organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

create trigger trg_invoices_assign_number
  before insert on public.invoices
  for each row execute function public.assign_invoice_number();

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position int not null default 0,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit text not null default 'u',
  unit_price numeric(14,2) not null default 0,
  vat_rate numeric(5,2) not null default 20,
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create index idx_invoice_items_invoice on public.invoice_items(invoice_id, position);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_at date not null default current_date,
  method text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_invoice_payments_invoice on public.invoice_payments(invoice_id);

-- Maintient invoices.amount_paid et le statut (paid / partially_paid / overdue)
-- à jour à chaque mouvement sur invoice_payments.
create or replace function public.recompute_invoice_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_total numeric(14,2);
  v_paid numeric(14,2);
  v_due_date date;
  v_status text;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select total, due_date, status into v_total, v_due_date, v_status
  from public.invoices where id = v_invoice_id;

  select coalesce(sum(amount), 0) into v_paid
  from public.invoice_payments where invoice_id = v_invoice_id;

  if v_status not in ('draft', 'cancelled') then
    if v_paid >= v_total and v_total > 0 then
      v_status := 'paid';
    elsif v_paid > 0 then
      v_status := 'partially_paid';
    elsif v_due_date is not null and v_due_date < current_date then
      v_status := 'overdue';
    else
      v_status := 'sent';
    end if;
  end if;

  update public.invoices
  set amount_paid = v_paid, status = v_status, updated_at = now()
  where id = v_invoice_id;

  return null;
end;
$$;

create trigger trg_invoice_payments_recompute
  after insert or update or delete on public.invoice_payments
  for each row execute function public.recompute_invoice_payment_status();

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_payments enable row level security;

-- Devis : l'équipe gère tout ; le client voit les devis qui lui ont été
-- envoyés (jamais les brouillons) et ne peut les faire évoluer que via
-- decide_quote() (acceptation/refus signé).
create policy "quotes_select_team_or_sent_member" on public.quotes
  for select using (
    public.is_project_team_member(project_id)
    or (status <> 'draft' and public.is_project_member(project_id))
  );

create policy "quotes_insert_team" on public.quotes
  for insert with check (public.is_project_team_member(project_id));

create policy "quotes_update_team" on public.quotes
  for update using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id) and status in ('draft', 'sent'));

create policy "quotes_delete_team" on public.quotes
  for delete using (public.is_project_team_member(project_id) and status = 'draft');

create policy "quote_items_select" on public.quote_items
  for select using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and (public.is_project_team_member(q.project_id) or (q.status <> 'draft' and public.is_project_member(q.project_id)))
    )
  );

create policy "quote_items_manage_team" on public.quote_items
  for all using (
    exists (select 1 from public.quotes q where q.id = quote_items.quote_id and public.is_project_team_member(q.project_id))
  )
  with check (
    exists (select 1 from public.quotes q where q.id = quote_items.quote_id and public.is_project_team_member(q.project_id))
  );

-- Factures : information financière sensible, réservée à l'équipe. Le
-- portail client affiche un résumé via le widget dédié (pas d'accès direct
-- à cette table pour le rôle "client" dans cette itération).
create policy "invoices_manage_team" on public.invoices
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

create policy "invoice_items_manage_team" on public.invoice_items
  for all using (
    exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.is_project_team_member(i.project_id))
  )
  with check (
    exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.is_project_team_member(i.project_id))
  );

create policy "invoice_payments_manage_team" on public.invoice_payments
  for all using (
    exists (select 1 from public.invoices i where i.id = invoice_payments.invoice_id and public.is_project_team_member(i.project_id))
  )
  with check (
    exists (select 1 from public.invoices i where i.id = invoice_payments.invoice_id and public.is_project_team_member(i.project_id))
  );

-- =========================================================================
-- decide_quote : acceptation/refus d'un devis par le client, avec signature
-- électronique à l'acceptation (même pattern que decide_change_order).
-- =========================================================================
create or replace function public.decide_quote(
  p_quote_id uuid,
  p_accept boolean,
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
  v_created_by uuid;
  v_signature_id uuid;
begin
  select project_id, status, created_by into v_project_id, v_status, v_created_by
  from public.quotes
  where id = p_quote_id;

  if v_project_id is null then
    raise exception 'Devis introuvable';
  end if;

  if not public.is_project_member(v_project_id) then
    raise exception 'Action non autorisée';
  end if;

  if v_status <> 'sent' then
    raise exception 'Ce devis n''est pas en attente de décision';
  end if;

  if p_accept then
    if p_signature_data is null or p_signer_name is null then
      raise exception 'Une signature est requise pour accepter un devis';
    end if;

    insert into public.signatures (resource_type, resource_id, project_id, signer_user_id, signer_name, signature_data)
    values ('quote', p_quote_id, v_project_id, auth.uid(), p_signer_name, p_signature_data)
    returning id into v_signature_id;

    update public.quotes
    set status = 'accepted', decided_by = auth.uid(), accepted_at = now(), signature_id = v_signature_id, updated_at = now()
    where id = p_quote_id;
  else
    update public.quotes
    set status = 'declined', decided_by = auth.uid(), updated_at = now()
    where id = p_quote_id;
  end if;

  insert into public.activity_logs (project_id, user_id, action, entity_type, entity_id, metadata)
  values (
    v_project_id, auth.uid(),
    case when p_accept then 'quote.accepted' else 'quote.declined' end,
    'quote', p_quote_id, '{}'::jsonb
  );

  if v_created_by is not null then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      v_created_by,
      'quote_decision',
      case when p_accept then 'Devis accepté' else 'Devis refusé' end,
      case when p_accept then 'Votre devis a été signé et accepté par le client.' else 'Votre devis a été refusé par le client.' end,
      '/projects/' || v_project_id || '/quotes'
    );
  end if;
end;
$$;

revoke all on function public.decide_quote(uuid, boolean, text, text) from public;
grant execute on function public.decide_quote(uuid, boolean, text, text) to authenticated;

-- "quote" est désormais un resource_type valide pour les signatures.
alter table public.signatures drop constraint if exists signatures_resource_type_check;
alter table public.signatures
  add constraint signatures_resource_type_check check (resource_type in ('change_order', 'selection', 'quote'));
