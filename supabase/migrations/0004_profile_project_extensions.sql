-- =========================================================================
-- BuildFlow — 0004_profile_project_extensions.sql
-- Champs profil enrichis (nom/prénom/profession/entreprise/téléphone)
-- + champs projet enrichis (adresse) + contacts de projet (table dédiée).
-- =========================================================================

-- -------------------------------------------------------------------------
-- PROFILES : nom / prénom / entreprise (profession et téléphone existent déjà)
-- -------------------------------------------------------------------------
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists company_name text;

-- Recalcule handle_new_user pour exploiter les nouvelles métadonnées d'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_name text := new.raw_user_meta_data->>'first_name';
  v_last_name text := new.raw_user_meta_data->>'last_name';
  v_full_name text;
begin
  v_full_name := coalesce(
    trim(concat(v_first_name, ' ', v_last_name)),
    new.raw_user_meta_data->>'full_name'
  );
  if v_full_name = '' then
    v_full_name := null;
  end if;

  insert into public.profiles (id, email, full_name, first_name, last_name, company_name, job_title, phone)
  values (
    new.id,
    new.email,
    v_full_name,
    v_first_name,
    v_last_name,
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'job_title',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- PROJECTS : adresse / localisation
-- -------------------------------------------------------------------------
alter table public.projects
  add column if not exists address text;

-- -------------------------------------------------------------------------
-- PROJECT CONTACTS : personnes à contacter sur un projet (plusieurs possibles)
-- -------------------------------------------------------------------------
create table if not exists public.project_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  job_title text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_contacts_project on public.project_contacts(project_id);

drop trigger if exists trg_project_contacts_updated_at on public.project_contacts;
create trigger trg_project_contacts_updated_at
  before update on public.project_contacts
  for each row execute function public.set_updated_at();

alter table public.project_contacts enable row level security;

drop policy if exists "project_contacts_select_member" on public.project_contacts;
create policy "project_contacts_select_member" on public.project_contacts
  for select using (public.is_project_member(project_id));

drop policy if exists "project_contacts_manage_member" on public.project_contacts;
create policy "project_contacts_manage_member" on public.project_contacts
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
