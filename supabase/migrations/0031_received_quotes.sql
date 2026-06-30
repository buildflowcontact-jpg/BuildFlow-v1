-- =========================================================================
-- BuildFlow — 0031_received_quotes.sql
--
-- Devis reçus de fournisseurs/sous-traitants : à distinguer des devis
-- (quotes) que l'équipe envoie à ses clients (module Devis & Facturation,
-- migration 0023). Un devis reçu est un fichier (PDF la plupart du temps)
-- déposé en pièce jointe, rattaché à une entreprise (fournisseur ou
-- sous-traitant) ; il doit aussi apparaître dans l'onglet Documents, classé
-- dans le dossier "Devis".
--
-- Choix d'implémentation : on étend directement la table documents avec
-- company_id + amount plutôt que de créer une table séparée, pour que le
-- même enregistrement serve à la fois la liste "Devis reçus" du module
-- Devis & Facturation et le classement par dossier dans Documents.
-- =========================================================================

alter table public.documents
  add column company_id uuid references public.companies(id) on delete set null,
  add column amount numeric(14,2);

create index idx_documents_company on public.documents(company_id);

comment on column public.documents.company_id is
  'Renseigné pour les devis reçus de fournisseurs/sous-traitants (folder = ''Devis''). Null pour les autres documents.';
comment on column public.documents.amount is
  'Montant du devis reçu, le cas échéant.';
