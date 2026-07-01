import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Rfi } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export const rfisService = {
  async list(projectId: string): Promise<Rfi[]> {
    return unwrap(
      await supabase.from('rfis').select('*').eq('project_id', projectId).order('number', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'rfis'>): Promise<Rfi> {
    const rfi = unwrap(await supabase.from('rfis').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: rfi.project_id,
      action: 'rfi.created',
      entity_type: 'rfi',
      entity_id: rfi.id,
      metadata: { number: rfi.number, title: rfi.title },
    });

    if (rfi.assigned_to) {
      await supabase.from('notifications').insert({
        user_id: rfi.assigned_to,
        type: 'rfi_assigned',
        title: 'RFI assignée',
        message: `La demande d'information RFI #${rfi.number} "${rfi.title}" vous a été assignée.`,
        link: `/projects/${rfi.project_id}?tab=rfis`,
      });
    }

    return rfi;
  },

  async respond(id: string, response: string): Promise<Rfi> {
    const { data: userData } = await supabase.auth.getUser();
    const responderId = userData.user?.id ?? null;
    const rfi = unwrap(
      await supabase
        .from('rfis')
        .update({
          response,
          status: 'answered',
          responded_by: responderId,
          responded_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single()
    );
    await activityLogsService.log({
      project_id: rfi.project_id,
      action: 'rfi.answered',
      entity_type: 'rfi',
      entity_id: rfi.id,
      metadata: { number: rfi.number },
    });
    // Notifie l'auteur de la RFI si différent du répondant
    if (rfi.raised_by && rfi.raised_by !== responderId) {
      await supabase.from('notifications').insert({
        user_id: rfi.raised_by,
        type: 'rfi.answered',
        title: `RFI #${rfi.number} — Réponse reçue`,
        message: rfi.title,
        link: `/projects/${rfi.project_id}/rfis`,
      });
    }
    return rfi;
  },

  async close(id: string): Promise<Rfi> {
    return unwrap(
      await supabase.from('rfis').update({ status: 'closed' }).eq('id', id).select('*').single()
    );
  },

  async update(id: string, payload: TablesUpdate<'rfis'>): Promise<Rfi> {
    return unwrap(await supabase.from('rfis').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('rfis').delete().eq('id', id);
    if (error) throw error;
  },
};
