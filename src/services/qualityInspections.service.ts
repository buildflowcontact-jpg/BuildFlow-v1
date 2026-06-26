import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { QualityInspection, QualityInspectionResultRow, QualityInspectionWithResults } from '@/types/domain';
import type { QualityInspectionResult, TablesInsert } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';
import { qualityTemplatesService } from './qualityTemplates.service';

export type AdHocChecklistItem = { label: string; position?: number };

export const qualityInspectionsService = {
  async list(projectId: string): Promise<QualityInspection[]> {
    return unwrap(
      await supabase.from('quality_inspections').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    );
  },

  async getWithResults(inspectionId: string): Promise<QualityInspectionWithResults> {
    const inspection = unwrap(await supabase.from('quality_inspections').select('*').eq('id', inspectionId).single());
    const results = unwrap(
      await supabase
        .from('quality_inspection_results')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('position', { ascending: true })
    );
    return { ...inspection, results };
  },

  /**
   * Démarre une inspection. Si `templateId` est fourni, les points de
   * contrôle du modèle sont copiés en résultats vierges (result = null) ;
   * sinon `adHocItems` sert de checklist libre.
   */
  async create(
    payload: Omit<TablesInsert<'quality_inspections'>, 'project_id'> & { project_id: string },
    adHocItems: AdHocChecklistItem[] = []
  ): Promise<QualityInspectionWithResults> {
    const inspection = unwrap(await supabase.from('quality_inspections').insert(payload).select('*').single());

    let sourceItems: AdHocChecklistItem[] = adHocItems;
    let templateItemIds: (string | null)[] = adHocItems.map(() => null);
    if (inspection.template_id) {
      const template = await qualityTemplatesService.getWithItems(inspection.template_id);
      sourceItems = template.items.map((item) => ({ label: item.label, position: item.position }));
      templateItemIds = template.items.map((item) => item.id);
    }

    let results: QualityInspectionResultRow[] = [];
    if (sourceItems.length > 0) {
      results = unwrap(
        await supabase
          .from('quality_inspection_results')
          .insert(
            sourceItems.map((item, index) => ({
              inspection_id: inspection.id,
              project_id: inspection.project_id,
              template_item_id: templateItemIds[index] ?? null,
              label: item.label,
              position: item.position ?? index,
            }))
          )
          .select('*')
      );
    }

    await activityLogsService.log({
      project_id: inspection.project_id,
      action: 'quality_inspection.created',
      entity_type: 'quality_inspection',
      entity_id: inspection.id,
      metadata: { title: inspection.title },
    });

    return { ...inspection, results };
  },

  async setResult(
    resultId: string,
    result: QualityInspectionResult | null,
    comment?: string | null
  ): Promise<QualityInspectionResultRow> {
    return unwrap(
      await supabase
        .from('quality_inspection_results')
        .update({ result, comment: comment ?? null })
        .eq('id', resultId)
        .select('*')
        .single()
    );
  },

  async complete(inspectionId: string, inspectedBy: string | null): Promise<QualityInspection> {
    const inspection = unwrap(
      await supabase
        .from('quality_inspections')
        .update({ status: 'completed', inspected_by: inspectedBy, inspected_at: new Date().toISOString() })
        .eq('id', inspectionId)
        .select('*')
        .single()
    );
    await activityLogsService.log({
      project_id: inspection.project_id,
      action: 'quality_inspection.completed',
      entity_type: 'quality_inspection',
      entity_id: inspection.id,
      metadata: { title: inspection.title },
    });
    return inspection;
  },

  async remove(inspectionId: string): Promise<void> {
    const { error } = await supabase.from('quality_inspections').delete().eq('id', inspectionId);
    if (error) throw error;
  },
};
