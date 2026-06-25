import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Organization, OrganizationMember, Profile } from '@/types/domain';

export const organizationsService = {
  async listMine(): Promise<Organization[]> {
    return unwrap(await supabase.from('organizations').select('*').order('created_at', { ascending: true }));
  },

  async getById(id: string): Promise<Organization> {
    return unwrap(await supabase.from('organizations').select('*').eq('id', id).single());
  },

  async update(id: string, updates: Partial<Organization>): Promise<Organization> {
    return unwrap(await supabase.from('organizations').update(updates).eq('id', id).select('*').single());
  },

  async listMembers(organizationId: string): Promise<(OrganizationMember & { profile: Profile | null })[]> {
    return unwrap(
      await supabase
        .from('organization_members')
        .select('*, profile:profiles(*)')
        .eq('organization_id', organizationId)
    ) as unknown as (OrganizationMember & { profile: Profile | null })[];
  },

  async updateMemberRole(memberId: string, role: OrganizationMember['role']): Promise<OrganizationMember> {
    return unwrap(
      await supabase.from('organization_members').update({ role }).eq('id', memberId).select('*').single()
    );
  },

  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase.from('organization_members').delete().eq('id', memberId);
    if (error) throw error;
  },

  async addMemberByEmail(
    organizationId: string,
    email: string,
    role: OrganizationMember['role'] = 'member'
  ): Promise<OrganizationMember> {
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!existingProfile) {
      throw new Error(
        "Aucun compte BuildFlow n'existe avec cet email. La personne doit d'abord créer un compte avant de pouvoir être ajoutée à l'organisation."
      );
    }

    const member = unwrap(
      await supabase
        .from('organization_members')
        .insert({ organization_id: organizationId, user_id: existingProfile.id, role })
        .select('*')
        .single()
    );

    await supabase.from('notifications').insert({
      user_id: existingProfile.id,
      type: 'org_invite',
      title: "Ajout à l'organisation",
      message: `Vous avez été ajouté à l'organisation en tant que ${role === 'admin' ? 'administrateur' : 'membre'}.`,
      link: '/settings',
    });

    return member;
  },
};
