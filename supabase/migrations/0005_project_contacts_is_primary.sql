-- =========================================================================
-- BuildFlow — 0005_project_contacts_is_primary.sql
-- Ajoute un flag "contact principal" sur project_contacts.
-- =========================================================================

alter table public.project_contacts
  add column if not exists is_primary boolean not null default false;
