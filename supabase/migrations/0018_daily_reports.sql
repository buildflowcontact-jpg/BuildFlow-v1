-- Rapport quotidien automatique : pointage de la veille + prévisions météo
-- (J + 6 jours suivants), envoyé chaque matin au chef de projet et archivé
-- dans l'onglet Documents (dossier "Rapports quotidien").

-- 1. Coordonnées GPS du projet (nécessaires pour interroger l'API météo Open-Meteo,
--    qui ne requiert pas de clé API). Renseignées manuellement ou via géocodage
--    de l'adresse côté front (Nominatim).
alter table public.projects add column if not exists latitude numeric(9,6);
alter table public.projects add column if not exists longitude numeric(9,6);

-- 2. Dossier libre sur les documents, pour ranger les rapports quotidiens
--    sans devoir étendre l'enum `type` existant.
alter table public.documents add column if not exists folder text;
create index if not exists idx_documents_folder on public.documents(project_id, folder);

-- 3. Table des rapports générés (une ligne par projet et par jour).
create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_date date not null,
  time_summary jsonb not null default '[]'::jsonb,
  weather_forecast jsonb,
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, report_date)
);

create index idx_daily_reports_project on public.daily_reports(project_id, report_date desc);

alter table public.daily_reports enable row level security;

create policy "daily_reports_select_team" on public.daily_reports
  for select using (public.is_project_team_member(project_id));

-- Pas d'insert/update/delete client : uniquement via la fonction
-- security definer ci-dessous (appelée par pg_cron) ou par le frontend
-- pour relier le document archivé (document_id) une fois le PDF généré.
create policy "daily_reports_update_link_document" on public.daily_reports
  for update using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

-- 4. Extensions nécessaires : pg_cron (planification) + http (appel synchrone
--    à l'API météo depuis une fonction SQL, plus simple que pg_net pour un
--    usage ponctuel et bloquant dans une fonction appelée par cron).
create extension if not exists pg_cron;
create extension if not exists http;

-- 5. Fonction génératrice : calcule et insère le rapport du jour pour chaque
--    projet actif, puis notifie le(s) chef(s) de projet.
create or replace function public.generate_daily_reports()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project record;
  v_yesterday date := current_date - 1;
  v_time_summary jsonb;
  v_weather jsonb;
  v_report_id uuid;
  v_http_response http_response;
  v_recipient record;
  v_has_recipient boolean;
begin
  for v_project in
    select id, name, owner_id, latitude, longitude
    from public.projects
    where status in ('preparation', 'approvisionnement', 'chantier', 'reception')
  loop
    -- Pointage de la veille, groupé par personne.
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', t.user_id,
             'full_name', coalesce(p.full_name, p.email),
             'hours', t.total_hours
           ) order by p.full_name), '[]'::jsonb)
      into v_time_summary
    from (
      select user_id, sum(hours) as total_hours
      from public.time_entries
      where project_id = v_project.id and work_date = v_yesterday
      group by user_id
    ) t
    join public.profiles p on p.id = t.user_id;

    -- Prévisions météo (J à J+6) si le projet a des coordonnées GPS.
    v_weather := null;
    if v_project.latitude is not null and v_project.longitude is not null then
      begin
        select * into v_http_response
        from http_get(
          format(
            'https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7',
            v_project.latitude, v_project.longitude
          )
        );
        if v_http_response.status = 200 then
          v_weather := v_http_response.content::jsonb -> 'daily';
        end if;
      exception when others then
        v_weather := null; -- la météo est un complément, pas bloquant si l'API échoue
      end;
    end if;

    insert into public.daily_reports (project_id, report_date, time_summary, weather_forecast)
    values (v_project.id, current_date, v_time_summary, v_weather)
    on conflict (project_id, report_date)
    do update set time_summary = excluded.time_summary, weather_forecast = excluded.weather_forecast
    returning id into v_report_id;

    -- Destinataires : membres dont le métier est "Chef de projet", sinon le propriétaire du projet.
    v_has_recipient := false;
    for v_recipient in
      select pm.user_id
      from public.project_members pm
      join public.profiles p on p.id = pm.user_id
      where pm.project_id = v_project.id and p.job_title = 'Chef de projet'
    loop
      v_has_recipient := true;
      insert into public.notifications (user_id, type, title, message, link)
      values (
        v_recipient.user_id,
        'daily_report',
        'Rapport quotidien de chantier',
        format('Le rapport quotidien du %s pour "%s" est disponible.', to_char(current_date, 'DD/MM/YYYY'), v_project.name),
        format('/projects/%s/documents', v_project.id)
      );
    end loop;

    if not v_has_recipient then
      insert into public.notifications (user_id, type, title, message, link)
      values (
        v_project.owner_id,
        'daily_report',
        'Rapport quotidien de chantier',
        format('Le rapport quotidien du %s pour "%s" est disponible.', to_char(current_date, 'DD/MM/YYYY'), v_project.name),
        format('/projects/%s/documents', v_project.id)
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.generate_daily_reports() from public, anon, authenticated;

-- 6. Planification : chaque matin à 6h00 (heure du serveur).
select cron.schedule(
  'daily-project-reports',
  '0 6 * * *',
  $$select public.generate_daily_reports();$$
);
