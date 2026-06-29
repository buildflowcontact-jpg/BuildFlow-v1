-- =========================================================================
-- BuildFlow — Tests pgTAP : devis/factures (statuts légaux + isolation
-- multi-tenant) et accès du rôle "client" au portail.
--
-- Couvre 0015_advanced_modules.sql (rôle client, is_project_team_member) et
-- 0023_quotes_invoices.sql (RLS quotes/invoices, decide_quote, numérotation
-- séquentielle sans trou). Exécution locale : `supabase test db` (nécessite
-- Docker).
-- =========================================================================

begin;
create extension if not exists pgtap;

select plan(20);

-- ---------------------------------------------------------------------
-- Fixtures : organisation A avec un chef de projet (team) et un client
-- (project_members.role = 'client') invité sur le projet, plus un
-- utilisateur d'une organisation B totalement étrangère (isolation
-- multi-tenant).
-- ---------------------------------------------------------------------
select tests.create_user('pm.billing@buildflow.test') as pm_id \gset
select tests.create_user('client.billing@buildflow.test') as client_id \gset
select tests.create_user('outsider.billing@buildflow.test') as outsider_id \gset

select id as org_id from public.organizations where owner_id = :'pm_id' \gset

select tests.authenticate_as(:'pm_id');

insert into public.projects (id, organization_id, name, owner_id)
values ('33333333-3333-3333-3333-333333333333', :'org_id', 'Chantier facturation', :'pm_id');

insert into public.project_members (project_id, user_id, role)
values ('33333333-3333-3333-3333-333333333333', :'client_id', 'client');

insert into public.quotes (id, project_id, title, status)
values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Devis gros œuvre', 'draft');

insert into public.invoices (id, project_id, title)
values ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Facture acompte');

-- ---------------------------------------------------------------------
-- 1. Devis brouillon : visible par l'équipe, jamais par le client.
-- ---------------------------------------------------------------------
select is(
  (select count(*) from public.quotes where id = '44444444-4444-4444-4444-444444444444'),
  1::bigint,
  'le chef de projet (équipe) voit le devis brouillon'
);

select tests.authenticate_as(:'client_id');

select is(
  (select count(*) from public.quotes where id = '44444444-4444-4444-4444-444444444444'),
  0::bigint,
  'le client ne voit jamais un devis encore au statut brouillon'
);

-- ---------------------------------------------------------------------
-- 2. Une fois envoyé, le client le voit mais ne peut pas le modifier
-- directement (seules les fonctions SECURITY DEFINER comme decide_quote
-- peuvent faire évoluer son statut).
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'pm_id');

update public.quotes set status = 'sent' where id = '44444444-4444-4444-4444-444444444444';

select tests.authenticate_as(:'client_id');

select is(
  (select count(*) from public.quotes where id = '44444444-4444-4444-4444-444444444444'),
  1::bigint,
  'le client voit le devis une fois envoyé'
);

-- Pas de policy UPDATE pour le rôle client sur quotes : la clause USING
-- exclut simplement la ligne (0 ligne affectée, pas d'exception — c'est le
-- comportement RLS normal d'un UPDATE dont aucune ligne ne passe USING).
update public.quotes set notes = 'modifié par le client' where id = '44444444-4444-4444-4444-444444444444';

select is(
  (select notes from public.quotes where id = '44444444-4444-4444-4444-444444444444'),
  null,
  'la tentative de modification directe du devis par le client n''affecte aucune ligne (RLS)'
);

-- ---------------------------------------------------------------------
-- 3. Même l'équipe ne peut pas faire passer un devis à "accepted"/
-- "declined" par un UPDATE direct : la policy with check restreint les
-- statuts atteignables à draft/sent, le reste doit passer par
-- decide_quote() pour rester audité et signé.
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'pm_id');

select throws_ok(
  $$ update public.quotes set status = 'accepted' where id = '44444444-4444-4444-4444-444444444444' $$,
  'même l''équipe ne peut pas forcer le statut "accepted" par UPDATE direct (contournement de decide_quote interdit)'
);

-- ---------------------------------------------------------------------
-- 4. decide_quote() : le client accepte le devis envoyé avec signature.
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'outsider_id');

select throws_like(
  format('select public.decide_quote(%L::uuid, true, %L, %L)', '44444444-4444-4444-4444-444444444444', 'data:image/png;base64,xx', 'Intrus'),
  '%non autorisée%',
  'un utilisateur non membre du projet ne peut pas décider du devis'
);

select tests.authenticate_as(:'client_id');

select lives_ok(
  format('select public.decide_quote(%L::uuid, true, %L, %L)', '44444444-4444-4444-4444-444444444444', 'data:image/png;base64,xx', 'Client Test'),
  'le client peut accepter le devis envoyé via decide_quote (signature électronique)'
);

select is(
  (select status from public.quotes where id = '44444444-4444-4444-4444-444444444444'),
  'accepted',
  'le devis passe au statut "accepted" après acceptation par le client'
);

select is(
  (select count(*) from public.signatures where resource_type = 'quote' and resource_id = '44444444-4444-4444-4444-444444444444'),
  1::bigint,
  'une signature électronique est enregistrée pour le devis accepté'
);

select throws_like(
  format('select public.decide_quote(%L::uuid, false, null, null)', '44444444-4444-4444-4444-444444444444'),
  '%n''est pas en attente%',
  'un devis déjà décidé ne peut plus être redécidé (statut figé)'
);

-- ---------------------------------------------------------------------
-- 5. Factures : information financière sensible, jamais accessible au
-- rôle client, même pour une facture envoyée.
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'pm_id');

update public.invoices set status = 'sent' where id = '55555555-5555-5555-5555-555555555555';

select is(
  (select count(*) from public.invoices where id = '55555555-5555-5555-5555-555555555555'),
  1::bigint,
  'le chef de projet (équipe) voit la facture envoyée'
);

select tests.authenticate_as(:'client_id');

select is(
  (select count(*) from public.invoices where id = '55555555-5555-5555-5555-555555555555'),
  0::bigint,
  'le client n''a jamais accès direct aux factures, même envoyées'
);

select throws_ok(
  $$ insert into public.invoice_payments (invoice_id, amount) values ('55555555-5555-5555-5555-555555555555', 100) $$,
  'le client ne peut pas enregistrer de paiement sur une facture'
);

-- ---------------------------------------------------------------------
-- 6. Isolation multi-tenant : un utilisateur d'une organisation tierce
-- ne voit ni le devis ni la facture, même après acceptation/envoi.
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'outsider_id');

select is(
  (select count(*) from public.quotes where id = '44444444-4444-4444-4444-444444444444'),
  0::bigint,
  'un utilisateur d''une autre organisation ne voit jamais le devis'
);

select is(
  (select count(*) from public.invoices where id = '55555555-5555-5555-5555-555555555555'),
  0::bigint,
  'un utilisateur d''une autre organisation ne voit jamais la facture'
);

-- ---------------------------------------------------------------------
-- 7. Numérotation séquentielle sans trou des factures par organisation
-- (obligation légale de continuité).
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'pm_id');

insert into public.invoices (id, project_id, title)
values ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'Facture solde');

select is(
  (select number from public.invoices where id = '66666666-6666-6666-6666-666666666666'),
  (select number from public.invoices where id = '55555555-5555-5555-5555-555555555555') + 1,
  'le numéro de facture s''incrémente sans trou au sein de la même organisation'
);

-- ---------------------------------------------------------------------
-- 8. Portail client : modules "équipe" (journal de chantier, RFI)
-- totalement invisibles au client ; modules partagés (avenants) visibles
-- en lecture, mais jamais modifiables par lui.
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'pm_id');

insert into public.daily_logs (id, project_id, log_date, progress_summary, created_by)
values ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', current_date, 'Avancement test', :'pm_id');

insert into public.rfis (id, project_id, title, question, created_by)
values ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'RFI portail', 'Question test', :'pm_id');

insert into public.change_orders (id, project_id, title)
values ('99999999-9999-9999-9999-999999999999', '33333333-3333-3333-3333-333333333333', 'Avenant portail');

select tests.authenticate_as(:'client_id');

select is(
  (select count(*) from public.daily_logs where project_id = '33333333-3333-3333-3333-333333333333'),
  0::bigint,
  'le client n''a aucun accès au journal de chantier (module équipe uniquement)'
);

select is(
  (select count(*) from public.rfis where id = '88888888-8888-8888-8888-888888888888'),
  0::bigint,
  'le client n''a aucun accès aux RFI (coordination interne équipe uniquement)'
);

select is(
  (select count(*) from public.change_orders where id = '99999999-9999-9999-9999-999999999999'),
  1::bigint,
  'le client peut consulter les avenants du projet (module partagé du portail)'
);

-- Même chose ici : la policy UPDATE est équipe uniquement, le client est
-- juste exclu de la clause USING (0 ligne affectée, pas d'exception).
update public.change_orders set title = 'modifié par le client' where id = '99999999-9999-9999-9999-999999999999';

select is(
  (select title from public.change_orders where id = '99999999-9999-9999-9999-999999999999'),
  'Avenant portail',
  'le client peut lire un avenant mais ne peut pas le modifier (équipe uniquement en écriture)'
);

select * from finish();
rollback;
