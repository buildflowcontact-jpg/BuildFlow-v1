-- Migration 0038 : révisions de plans avec workflow de validation
CREATE TABLE IF NOT EXISTS public.plan_revisions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id      uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  title            text NOT NULL,
  revision_index   text NOT NULL DEFAULT 'A',
  discipline       text NOT NULL DEFAULT 'architecture'
                   CHECK (discipline IN ('architecture','structure','fluides','electricite','vrd','autre')),
  lot              text,
  status           text NOT NULL DEFAULT 'en_attente'
                   CHECK (status IN ('en_attente','soumis','en_revision','approuve','refuse')),
  submitted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at     timestamptz,
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  reviewer_comment text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_plan_revisions_updated_at
  BEFORE UPDATE ON public.plan_revisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_plan_revisions_project_id ON public.plan_revisions(project_id);
CREATE INDEX IF NOT EXISTS idx_plan_revisions_status     ON public.plan_revisions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_plan_revisions_discipline ON public.plan_revisions(project_id, discipline);

ALTER TABLE public.plan_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_revisions_select" ON public.plan_revisions
  FOR SELECT USING (public.is_project_member(project_id));

CREATE POLICY "plan_revisions_insert" ON public.plan_revisions
  FOR INSERT WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "plan_revisions_update" ON public.plan_revisions
  FOR UPDATE USING (public.is_project_member(project_id));

CREATE POLICY "plan_revisions_delete" ON public.plan_revisions
  FOR DELETE USING (public.is_project_member(project_id));
