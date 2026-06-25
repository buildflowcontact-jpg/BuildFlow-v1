import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Incident } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export const incidentsService = {
  async list(projectId: string): Promise<Incident[]> {
    return unwrap(
      await supabase.from('incidents').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'incidents'>): Promise<Incident> {
    const incident = unwrap(await supabase.from('incidents').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: incident.project_id,
      action: 'incident.created',
      entity_type: 'incident',
      entity_id: incident.id,
      metadata: { title: incident.title, severity: incident.severity },
    });

    if (incident.assigned_to) {
      await supabase.from('notifications').insert({
        user_id: incident.assigned_to,
        type: 'incident_assigned',
        title: 'Incident assigné',
        message: `Incident "${incident.title}" vous a été assigné.`,
        link: `/projects/${incident.project_id}?tab=incidents`,
      });
    }

    return incident;
  },

  async update(id: string, payload: TablesUpdate<'incidents'>): Promise<Incident> {
    const finalPayload = { ...payload };
    if (payload.status === 'resolved' || payload.status === 'closed') {
      finalPayload.resolved_at = new Date().toISOString();
    }
    return unwrap(await supabase.from('incidents').update(finalPayload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('incidents').delete().eq('id', id);
    if (error) throw error;
  },
};
