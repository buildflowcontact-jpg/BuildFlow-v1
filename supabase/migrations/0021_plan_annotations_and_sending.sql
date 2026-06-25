-- =========================================================================
-- BuildFlow — 0021_plan_annotations_and_sending.sql
-- Annotations de plans enrichies (page + statut résolu) et traçabilité du
-- workflow d'envoi d'une version de plan (qui, quand, à qui).
-- =========================================================================

alter table public.plan_annotations
  add column if not exists page_number int not null default 1,
  add column if not exists resolved boolean not null default false;

comment on column public.plan_annotations.page_number is
  'Page du PDF sur laquelle l''annotation a été posée (1-indexée).';
comment on column public.plan_annotations.resolved is
  'Annotation marquée comme traitée/résolue par un membre du projet.';

alter table public.plan_versions
  add column if not exists sent_at timestamptz,
  add column if not exists sent_by uuid references public.profiles(id) on delete set null,
  add column if not exists sent_to jsonb;

comment on column public.plan_versions.sent_at is
  'Horodatage du dernier envoi explicite de cette version aux destinataires concernés.';
comment on column public.plan_versions.sent_by is
  'Auteur du dernier envoi explicite.';
comment on column public.plan_versions.sent_to is
  'Liste des destinataires du dernier envoi (tableau jsonb de noms/emails affichables).';
