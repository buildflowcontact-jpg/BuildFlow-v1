import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Document } from '@/types/domain';
import type { DocumentType } from '@/types/database.types';
import { storageService } from './storage.service';
import { activityLogsService } from './activityLogs.service';
import { notificationsService } from './notifications.service';

export const documentsService = {
  async list(projectId: string): Promise<Document[]> {
    return unwrap(
      await supabase.from('documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    );
  },

  async upload(params: {
    projectId: string;
    file: File;
    type: DocumentType;
    uploadedBy: string;
    folder?: string | null;
    /** Désactive l'activité + la notification : utile pour les archivages automatiques (ex. rapports quotidiens). */
    silent?: boolean;
  }): Promise<Document> {
    const path = storageService.buildPath(params.projectId, params.file.name);
    await storageService.upload('documents', path, params.file);

    const doc = unwrap(
      await supabase
        .from('documents')
        .insert({
          project_id: params.projectId,
          name: params.file.name,
          type: params.type,
          storage_path: path,
          size_bytes: params.file.size,
          mime_type: params.file.type,
          uploaded_by: params.uploadedBy,
          folder: params.folder ?? null,
        })
        .select('*')
        .single()
    );

    if (params.silent) return doc;

    await activityLogsService.log({
      project_id: params.projectId,
      action: 'document.uploaded',
      entity_type: 'document',
      entity_id: doc.id,
      metadata: { name: doc.name, type: doc.type },
    });

    await notificationsService.notifyResourceChange({
      resourceType: 'document',
      resourceId: doc.id,
      projectId: params.projectId,
      actorId: params.uploadedBy,
      type: 'document_uploaded',
      title: 'Nouveau document',
      message: `"${doc.name}" a été ajouté au projet.`,
      link: `/projects/${params.projectId}/documents`,
    });

    return doc;
  },

  async getDownloadUrl(doc: Document): Promise<string> {
    return storageService.getSignedUrl('documents', doc.storage_path);
  },

  async remove(doc: Document): Promise<void> {
    await storageService.remove('documents', doc.storage_path);
    const { error } = await supabase.from('documents').delete().eq('id', doc.id);
    if (error) throw error;
  },
};
