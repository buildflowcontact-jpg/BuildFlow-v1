import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { QualityTemplate, QualityTemplateItem, QualityTemplateWithItems } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export type QualityTemplateItemInput = Pick<QualityTemplateItem, 'label'> & { position?: number };

export const qualityTemplatesService = {
  async list(projectId: string): Promise<QualityTemplate[]> {
    return unwrap(
      await supabase.from('quality_templates').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    );
  },

  async getWithItems(templateId: string): Promise<QualityTemplateWithItems> {
    const template = unwrap(await supabase.from('quality_templates').select('*').eq('id', templateId).single());
    const items = unwrap(
      await supabase.from('quality_template_items').select('*').eq('template_id', templateId).order('position', { ascending: true })
    );
    return { ...template, items };
  },

  async create(
    payload: Omit<TablesInsert<'quality_templates'>, 'project_id'> & { project_id: string },
    items: QualityTemplateItemInput[]
  ): Promise<QualityTemplateWithItems> {
    const template = unwrap(await supabase.from('quality_templates').insert(payload).select('*').single());

    let insertedItems: QualityTemplateItem[] = [];
    if (items.length > 0) {
      insertedItems = unwrap(
        await supabase
          .from('quality_template_items')
          .insert(
            items.map((item, index) => ({
              label: item.label,
              position: item.position ?? index,
              template_id: template.id,
              project_id: template.project_id,
            }))
          )
          .select('*')
      );
    }

    await activityLogsService.log({
      project_id: template.project_id,
      action: 'quality_template.created',
      entity_type: 'quality_template',
      entity_id: template.id,
      metadata: { name: template.name },
    });

    return { ...template, items: insertedItems };
  },

  /** Remplace l'en-tête et les points de contrôle d'un modèle (suppression + réinsertion). */
  async update(
    templateId: string,
    payload: Partial<Pick<QualityTemplate, 'name' | 'description'>>,
    items: QualityTemplateItemInput[]
  ): Promise<QualityTemplateWithItems> {
    const template = unwrap(
      await supabase.from('quality_templates').update(payload).eq('id', templateId).select('*').single()
    );

    await supabase.from('quality_template_items').delete().eq('template_id', templateId);
    let insertedItems: QualityTemplateItem[] = [];
    if (items.length > 0) {
      insertedItems = unwrap(
        await supabase
          .from('quality_template_items')
          .insert(
            items.map((item, index) => ({
              label: item.label,
              position: item.position ?? index,
              template_id: templateId,
              project_id: template.project_id,
            }))
          )
          .select('*')
      );
    }

    return { ...template, items: insertedItems };
  },

  async remove(templateId: string): Promise<void> {
    const { error } = await supabase.from('quality_templates').delete().eq('id', templateId);
    if (error) throw error;
  },
};
