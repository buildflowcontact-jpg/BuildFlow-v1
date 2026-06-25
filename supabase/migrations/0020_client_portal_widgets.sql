-- =========================================================================
-- BuildFlow — 0020_client_portal_widgets.sql
-- Widgets configurables sur le portail client : le chef de projet choisit
-- quelles sections sont visibles par le client (avancement, journal de
-- chantier, RFI, avenants, documents).
-- =========================================================================

alter table public.projects
  add column if not exists portal_widgets jsonb not null default '{
    "progress": true,
    "daily_logs": true,
    "rfis": true,
    "change_orders": true,
    "documents": true
  }'::jsonb;

comment on column public.projects.portal_widgets is
  'Widgets affichés sur le portail client, configurables par le chef de projet. Clés : progress, daily_logs, rfis, change_orders, documents.';
