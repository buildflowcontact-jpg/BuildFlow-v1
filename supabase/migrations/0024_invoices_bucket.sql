-- =========================================================================
-- BuildFlow — 0024_invoices_bucket.sql
--
-- Bucket de stockage pour les factures générées au format Factur-X
-- (PDF/A-3 + XML CII embarqué). Réservé à l'équipe projet : les factures
-- sont une information financière sensible (cf. policy invoices_manage_team
-- de 0023_quotes_invoices.sql), le portail client n'y a pas accès direct
-- dans cette itération.
--
-- Convention de chemin : <project_id>/factures/<invoice_id>.pdf
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('invoices', 'invoices', false, 20971520)
on conflict (id) do nothing;

create policy "invoices_bucket_select_team" on storage.objects
  for select using (
    bucket_id = 'invoices'
    and public.is_project_team_member(((storage.foldername(name))[1])::uuid)
  );

create policy "invoices_bucket_insert_team" on storage.objects
  for insert with check (
    bucket_id = 'invoices'
    and public.is_project_team_member(((storage.foldername(name))[1])::uuid)
  );

create policy "invoices_bucket_update_team" on storage.objects
  for update using (
    bucket_id = 'invoices'
    and public.is_project_team_member(((storage.foldername(name))[1])::uuid)
  );

create policy "invoices_bucket_delete_team" on storage.objects
  for delete using (
    bucket_id = 'invoices'
    and public.is_project_team_member(((storage.foldername(name))[1])::uuid)
  );
