import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Company, ProjectCompany } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const companiesService = {
  async list(organizationId: string): Promise<Company[]> {
    return unwrap(
      await supabase
        .from('companies')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })
    );
  },

  async create(payload: TablesInsert<'companies'>): Promise<Company> {
    return unwrap(await supabase.from('companies').insert(payload).select('*').single());
  },

  async update(id: string, payload: TablesUpdate<'companies'>): Promise<Company> {
    return unwrap(await supabase.from('companies').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) throw error;
  },

  async listForProject(projectId: string): Promise<(ProjectCompany & { company: Company })[]> {
    return unwrap(
      await supabase.from('project_companies').select('*, company:companies(*)').eq('project_id', projectId)
    ) as unknown as (ProjectCompany & { company: Company })[];
  },

  async attachToProject(projectId: string, companyId: string, role?: string): Promise<ProjectCompany> {
    return unwrap(
      await supabase
        .from('project_companies')
        .insert({ project_id: projectId, company_id: companyId, role })
        .select('*')
        .single()
    );
  },

  async detachFromProject(projectCompanyId: string): Promise<void> {
    const { error } = await supabase.from('project_companies').delete().eq('id', projectCompanyId);
    if (error) throw error;
  },
};
