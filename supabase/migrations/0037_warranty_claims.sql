-- Migration 0037 : réclamations garantie / SAV post-réception
CREATE TABLE IF NOT EXISTS public.warranty_claims (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  company_id      uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  warranty_type   text NOT NULL DEFAULT 'parfait_achevement'
                  CHECK (warranty_type IN ('parfait_achevement','biennale','decennale','hors_garantie')),
  priority        text NOT NULL DEFAULT 'normale'
                  CHECK (priority IN ('basse','normale','haute','urgente')),
  status          text NOT NULL DEFAULT 'ouvert'
                  CHECK (status IN ('ouvert','en_cours','resolu','clos')),
  reported_date   date NOT NULL DEFAULT CURRENT_DATE,
  due_date        date,
  resolved_date   date,
  lot             text,
  location        text,
  document_id     uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_warranty_claims_updated_at
  BEFORE UPDATE ON public.warranty_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_warranty_claims_project_id ON public.warranty_claims(project_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_company_id  ON public.warranty_claims(company_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status      ON public.warranty_claims(project_id, status);

ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warranty_claims_select" ON public.warranty_claims
  FOR SELECT USING (public.is_project_member(project_id));

CREATE POLICY "warranty_claims_insert" ON public.warranty_claims
  FOR INSERT WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "warranty_claims_update" ON public.warranty_claims
  FOR UPDATE USING (public.is_project_member(project_id));

CREATE POLICY "warranty_claims_delete" ON public.warranty_claims
  FOR DELETE USING (public.is_project_member(project_id));
