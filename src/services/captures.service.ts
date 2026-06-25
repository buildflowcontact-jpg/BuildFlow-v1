import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { AnnotatedCapture, CaptureAnnotationShape, CaptureReport, CaptureSourceType, Project } from '@/types/domain';
import { storageService } from './storage.service';
import { activityLogsService } from './activityLogs.service';

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header = '', base64 = ''] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const capturesService = {
  /**
   * Brouillons de captures annotées de l'utilisateur courant sur ce projet.
   * Tant qu'une capture n'a pas été envoyée dans un rapport, elle n'est
   * visible que de son auteur (voir policy RLS annotated_captures_select_member).
   */
  async listDrafts(projectId: string, userId: string): Promise<AnnotatedCapture[]> {
    return unwrap(
      await supabase
        .from('annotated_captures')
        .select('*')
        .eq('project_id', projectId)
        .eq('created_by', userId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
    );
  },

  async create(params: {
    projectId: string;
    sourceType: CaptureSourceType;
    sourceId: string;
    sourceLabel: string;
    dataUrl: string;
    annotations: CaptureAnnotationShape[];
    createdBy: string;
  }): Promise<AnnotatedCapture> {
    const file = dataUrlToFile(params.dataUrl, 'capture.png');
    const path = storageService.buildPath(params.projectId, 'capture.png');
    await storageService.upload('captures', path, file);

    const capture = unwrap(
      await supabase
        .from('annotated_captures')
        .insert({
          project_id: params.projectId,
          source_type: params.sourceType,
          source_id: params.sourceId,
          source_label: params.sourceLabel,
          image_storage_path: path,
          annotations: params.annotations,
          created_by: params.createdBy,
        })
        .select('*')
        .single()
    );

    await activityLogsService.log({
      project_id: params.projectId,
      action: 'capture.created',
      entity_type: 'annotated_capture',
      entity_id: capture.id,
      metadata: { source_type: params.sourceType, source_label: params.sourceLabel },
    });

    return capture;
  },

  /** Remplace l'image et les annotations d'un brouillon existant (réédition). */
  async update(params: {
    capture: AnnotatedCapture;
    dataUrl: string;
    annotations: CaptureAnnotationShape[];
  }): Promise<AnnotatedCapture> {
    const file = dataUrlToFile(params.dataUrl, 'capture.png');
    const path = storageService.buildPath(params.capture.project_id, 'capture.png');
    await storageService.upload('captures', path, file);
    await storageService.remove('captures', params.capture.image_storage_path).catch(() => {});

    return unwrap(
      await supabase
        .from('annotated_captures')
        .update({
          image_storage_path: path,
          annotations: params.annotations,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.capture.id)
        .select('*')
        .single()
    );
  },

  async getImageUrl(capture: AnnotatedCapture): Promise<string> {
    return storageService.getSignedUrl('captures', capture.image_storage_path);
  },

  async remove(capture: AnnotatedCapture): Promise<void> {
    await storageService.remove('captures', capture.image_storage_path);
    const { error } = await supabase.from('annotated_captures').delete().eq('id', capture.id);
    if (error) throw error;
  },

  /**
   * Compile les captures sélectionnées en un rapport PDF unique, l'envoie aux
   * destinataires choisis (notification BuildFlow) et marque les captures
   * comme "sent" (elles restent visibles dans l'historique, mais l'auteur
   * peut désormais supprimer ses brouillons sans perdre le rapport).
   */
  async sendReport(params: {
    project: Project;
    title: string;
    captures: AnnotatedCapture[];
    createdBy: string;
    recipients: { id: string; label: string }[];
  }): Promise<CaptureReport> {
    if (params.captures.length === 0) throw new Error('Sélectionnez au moins une capture.');

    const report = unwrap(
      await supabase
        .from('capture_reports')
        .insert({ project_id: params.project.id, title: params.title, created_by: params.createdBy })
        .select('*')
        .single()
    );

    const pages = await Promise.all(
      params.captures.map(async (capture) => {
        const url = await storageService.getSignedUrl('captures', capture.image_storage_path);
        const blob = await (await fetch(url)).blob();
        const dataUrl = await blobToDataUrl(blob);
        return { label: capture.source_label, dataUrl, createdAt: capture.created_at };
      })
    );

    // Import jsPDF dynamiquement : la génération de rapport est une action
    // secondaire, pas un chemin de chargement initial (cf. vite.config.ts).
    const { buildCaptureReportPdf, pdfToFile } = await import('./pdfExport.service');
    const doc = buildCaptureReportPdf(params.project, params.title, pages);
    const pdfFile = pdfToFile(doc, `rapport-captures-${report.id}.pdf`);
    const pdfPath = storageService.buildPath(params.project.id, pdfFile.name);
    await storageService.upload('captures', pdfPath, pdfFile);

    const sentTo = params.recipients.map((r) => r.label);
    const updatedReport = unwrap(
      await supabase
        .from('capture_reports')
        .update({ pdf_storage_path: pdfPath, sent_at: new Date().toISOString(), sent_to: sentTo })
        .eq('id', report.id)
        .select('*')
        .single()
    );

    const captureIds = params.captures.map((c) => c.id);
    const { error: updateError } = await supabase
      .from('annotated_captures')
      .update({ status: 'sent', report_id: report.id })
      .in('id', captureIds);
    if (updateError) throw updateError;

    await activityLogsService.log({
      project_id: params.project.id,
      action: 'capture_report.sent',
      entity_type: 'capture_report',
      entity_id: report.id,
      metadata: { title: params.title, count: captureIds.length, recipients: sentTo },
    });

    if (params.recipients.length > 0) {
      const { error: notifError } = await supabase.from('notifications').insert(
        params.recipients.map((r) => ({
          user_id: r.id,
          type: 'capture_report_sent',
          title: 'Rapport de captures reçu',
          message: `"${params.title}" (${captureIds.length} capture${captureIds.length > 1 ? 's' : ''}) vous a été envoyé.`,
          link: `/projects/${params.project.id}/plans`,
        }))
      );
      if (notifError) throw notifError;
    }

    return updatedReport;
  },

  async listReports(projectId: string): Promise<CaptureReport[]> {
    return unwrap(
      await supabase
        .from('capture_reports')
        .select('*')
        .eq('project_id', projectId)
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: false })
    );
  },

  async getReportPdfUrl(report: CaptureReport): Promise<string> {
    if (!report.pdf_storage_path) throw new Error('Ce rapport ne contient pas de PDF.');
    return storageService.getSignedUrl('captures', report.pdf_storage_path);
  },
};
