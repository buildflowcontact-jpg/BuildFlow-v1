import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { DailyReport } from '@/types/domain';

export const DAILY_REPORTS_FOLDER = 'Rapports quotidien';

export const dailyReportsService = {
  /** Tous les rapports d'un projet, du plus récent au plus ancien. */
  async list(projectId: string): Promise<DailyReport[]> {
    return unwrap(
      await supabase
        .from('daily_reports')
        .select('*')
        .eq('project_id', projectId)
        .order('report_date', { ascending: false })
    );
  },

  /** Rapports générés par le cron mais pas encore archivés en PDF (document_id manquant). */
  async listPending(projectId: string): Promise<DailyReport[]> {
    return unwrap(
      await supabase
        .from('daily_reports')
        .select('*')
        .eq('project_id', projectId)
        .is('document_id', null)
        .order('report_date', { ascending: false })
    );
  },

  async linkDocument(reportId: string, documentId: string): Promise<void> {
    const { error } = await supabase.from('daily_reports').update({ document_id: documentId }).eq('id', reportId);
    if (error) throw error;
  },
};
