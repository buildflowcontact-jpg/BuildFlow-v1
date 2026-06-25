import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dailyReportsService, DAILY_REPORTS_FOLDER } from '@/services/dailyReports.service';
import { documentsService } from '@/services/documents.service';
import type { DailyReport, DailyReportTimeEntry, DailyReportWeatherDay, Project } from '@/types/domain';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useDailyReports(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['daily_reports', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => dailyReportsService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('daily_reports', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  /** Génère le PDF du rapport (pointage + météo) et l'archive dans Documents > Rapports quotidien. */
  const archive = useMutation({
    mutationFn: async ({ report, project, uploadedBy }: { report: DailyReport; project: Project; uploadedBy: string }) => {
      const { buildDailyReportPdf, pdfToFile } = await import('@/services/pdfExport.service');
      const doc = buildDailyReportPdf(
        project,
        report.report_date,
        (report.time_summary as unknown as DailyReportTimeEntry[]) ?? [],
        report.weather_forecast as unknown as DailyReportWeatherDay | null
      );
      const filename = `rapport-quotidien-${report.report_date}.pdf`;
      const file = pdfToFile(doc, filename);
      const document = await documentsService.upload({
        projectId: project.id,
        file,
        type: 'compte_rendu',
        uploadedBy,
        folder: DAILY_REPORTS_FOLDER,
        silent: true,
      });
      await dailyReportsService.linkDocument(report.id, document.id);
      return document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
    },
  });

  return { ...query, reports: query.data ?? [], archive };
}
