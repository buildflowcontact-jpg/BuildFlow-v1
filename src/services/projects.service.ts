import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Project, ProjectMember, Profile } from '@/types/domain';
import type { Json, TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

const DEFAULT_PHASES: Array<{ name: string; type: TablesInsert<'phases'>['type']; order_index: number }> = [
  { name: 'Commercial', type: 'commercial', order_index: 0 },
  { name: 'Études', type: 'etudes', order_index: 1 },
  { name: 'Préparation', type: 'preparation', order_index: 2 },
  { name: 'Approvisionnement', type: 'approvisionnement', order_index: 3 },
  { name: 'Chantier', type: 'chantier', order_index: 4 },
  { name: 'Réception', type: 'reception', order_index: 5 },
];

export const projectsService = {
  async list(organizationId: string): Promise<Project[]> {
    return unwrap(
      await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
    );
  },

  async getById(id: string): Promise<Project> {
    return unwrap(await supabase.from('projects').select('*').eq('id', id).single());
  },

  async create(payload: TablesInsert<'projects'>): Promise<Project> {
    const project = unwrap(await supabase.from('projects').insert(payload).select('*').single());

    // Initialise les phases standard du cycle de vie BTP
    const phasesPayload = DEFAULT_PHASES.map((phase) => ({ ...phase, project_id: project.id }));
    await supabase.from('phases').insert(phasesPayload);

    await activityLogsService.log({
      project_id: project.id,
      action: 'project.created',
      entity_type: 'project',
      entity_id: project.id,
      metadata: { name: project.name },
    });

    return project;
  },

  async update(id: string, payload: TablesUpdate<'projects'>): Promise<Project> {
    const project = unwrap(await supabase.from('projects').update(payload).eq('id', id).select('*').single());
    await activityLogsService.log({
      project_id: id,
      action: 'project.updated',
      entity_type: 'project',
      entity_id: id,
      metadata: payload as unknown as Json,
    });
    return project;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },

  async listMembers(projectId: string): Promise<(ProjectMember & { profile: Profile | null })[]> {
    return unwrap(
      await supabase.from('project_members').select('*, profile:profiles(*)').eq('project_id', projectId)
    ) as unknown as (ProjectMember & { profile: Profile | null })[];
  },

  async inviteMember(projectId: string, email: string, role: ProjectMember['role'] = 'collaborator'): Promise<ProjectMember> {
    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();

    const member = unwrap(
      await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: existingProfile?.id ?? null,
          role,
          invited_email: email,
          invited_at: new Date().toISOString(),
          accepted_at: existingProfile ? new Date().toISOString() : null,
        })
        .select('*')
        .single()
    );

    if (existingProfile) {
      await supabase.from('notifications').insert({
        user_id: existingProfile.id,
        type: 'project_invite',
        title: 'Invitation à un projet',
        message: `Vous avez été ajouté au projet en tant que ${role === 'owner' ? 'propriétaire' : 'collaborateur'}.`,
        link: `/projects/${projectId}`,
      });
    }

    return member;
  },

  async updateMemberRole(memberId: string, role: ProjectMember['role']): Promise<ProjectMember> {
    return unwrap(await supabase.from('project_members').update({ role }).eq('id', memberId).select('*').single());
  },

  /**
   * Transfere la propriete d'un projet a un autre membre de l'organisation, de facon
   * atomique cote base (fonction RPC SECURITY DEFINER transfer_project_ownership,
   * cf. 0011_project_isolation_and_ownership_transfer.sql) : project_members ET
   * projects.owner_id sont mis a jour ensemble, plus le log d'activite et la
   * notification. Autorise pour le proprietaire actuel du projet OU un admin/owner
   * d'organisation (cas chef de projet absent/malade) -- la fonction verifie elle-meme
   * ces droits, independamment des policies RLS generales sur project_members.
   */
  async transferOwnership(projectId: string, newOwnerUserId: string): Promise<void> {
    const { error } = await supabase.rpc('transfer_project_ownership', {
      p_project_id: projectId,
      p_new_owner_user_id: newOwnerUserId,
    });
    if (error) throw error;
  },

  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase.from('project_members').delete().eq('id', memberId);
    if (error) throw error;
  },
};
