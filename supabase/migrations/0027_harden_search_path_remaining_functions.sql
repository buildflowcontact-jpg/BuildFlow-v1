-- =========================================================================
-- BuildFlow — 0027_harden_search_path_remaining_functions.sql
--
-- Suite de 0010/0016 : fixe `search_path` sur les 3 dernières fonctions
-- trigger qui en étaient dépourvues (relevé lors de l'audit complet du
-- 26/06/2026, section 7 "Sécurité"). Sans `set search_path`, une fonction
-- plpgsql résout les objets non qualifiés via le search_path de l'appelant
-- — risque théorique de "schéma squatting". Comportement fonctionnel
-- inchangé, corps des fonctions repris à l'identique.
-- =========================================================================

create or replace function public.assign_quote_number()
returns trigger
language plpgsql
set search_path = public
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

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
set search_path = public
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

create or replace function public.create_non_conformity_from_result()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_location text;
begin
  if new.result = 'non_conforme' then
    select location into v_location from public.quality_inspections where id = new.inspection_id;

    insert into public.non_conformities (project_id, inspection_id, inspection_result_id, title, location)
    values (new.project_id, new.inspection_id, new.id, new.label, v_location)
    on conflict (inspection_result_id) do nothing;
  end if;
  return new;
end;
$$;
