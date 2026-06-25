import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Model3D } from '@/types/domain';
import { storageService } from './storage.service';
import { activityLogsService } from './activityLogs.service';
import { notificationsService } from './notifications.service';

export const models3dService = {
  async list(projectId: string): Promise<Model3D[]> {
    return unwrap(
      await supabase.from('models3d').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    );
  },

  async upload(params: { projectId: string; file: File; uploadedBy: string }): Promise<Model3D> {
    const path = storageService.buildPath(params.projectId, params.file.name);
    await storageService.upload('models3d', path, params.file);
    const ext = params.file.name.split('.').pop() ?? null;

    const model = unwrap(
      await supabase
        .from('models3d')
        .insert({
          project_id: params.projectId,
          name: params.file.name,
          storage_path: path,
          format: ext,
          uploaded_by: params.uploadedBy,
        })
        .select('*')
        .single()
    );

    await activityLogsService.log({
      project_id: params.projectId,
      action: 'model3d.uploaded',
      entity_type: 'model3d',
      entity_id: model.id,
      metadata: { name: model.name },
    });

    await notificationsService.notifyResourceChange({
      resourceType: 'model3d',
      resourceId: model.id,
      projectId: params.projectId,
      actorId: params.uploadedBy,
      type: 'model3d_uploaded',
      title: 'Nouvelle maquette 3D',
      message: `"${model.name}" a été ajoutée au projet.`,
      link: `/projects/${params.projectId}/models3d`,
    });

    return model;
  },

  async getDownloadUrl(model: Model3D): Promise<string> {
    return storageService.getSignedUrl('models3d', model.storage_path);
  },

  async remove(model: Model3D): Promise<void> {
    await storageService.remove('models3d', model.storage_path);
    const { error } = await supabase.from('models3d').delete().eq('id', model.id);
    if (error) throw error;
  },
};
