import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { MeetingReport, MeetingActionItem, MeetingReportWithItems } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export const meetingReportsService = {
  async list(projectId: string): Promise<MeetingReportWithItems[]> {
    const reports = unwrap(
      await supabase
        .from('meeting_reports')
        .select('*')
        .eq('project_id', projectId)
        .order('meeting_date', { ascending: false })
    );
    if (reports.length === 0) return [];

    const items = unwrap(
      await supabase
        .from('meeting_action_items')
        .select('*')
        .in('meeting_report_id', reports.map((r) => r.id))
    );

    return reports.map((report) => ({
      ...report,
      actionItems: items.filter((item) => item.meeting_report_id === report.id),
    }));
  },

  async create(payload: TablesInsert<'meeting_reports'>): Promise<MeetingReport> {
    const report = unwrap(await supabase.from('meeting_reports').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: report.project_id,
      action: 'meeting_report.created',
      entity_type: 'meeting_report',
      entity_id: report.id,
      metadata: { title: report.title },
    });
    return report;
  },

  async update(id: string, payload: TablesUpdate<'meeting_reports'>): Promise<MeetingReport> {
    return unwrap(await supabase.from('meeting_reports').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('meeting_reports').delete().eq('id', id);
    if (error) throw error;
  },

  async createActionItem(payload: TablesInsert<'meeting_action_items'>): Promise<MeetingActionItem> {
    return unwrap(await supabase.from('meeting_action_items').insert(payload).select('*').single());
  },

  async updateActionItem(id: string, payload: TablesUpdate<'meeting_action_items'>): Promise<MeetingActionItem> {
    return unwrap(await supabase.from('meeting_action_items').update(payload).eq('id', id).select('*').single());
  },

  async removeActionItem(id: string): Promise<void> {
    const { error } = await supabase.from('meeting_action_items').delete().eq('id', id);
    if (error) throw error;
  },
};
