import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Plan, PlanVersion, PlanAnnotation } from '@/types/domain';
import { storageService } from './storage.service';
import { activityLogsService } from './activityLogs.service';
import { notificationsService } from './notifications.service';

export const plansService = {
  async list(projectId: string): Promise<Plan[]> {
    return unwrap(
      await supabase.from('plans').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    );
  },

  async listVersions(planId: string): Promise<PlanVersion[]> {
    return unwrap(
      await supabase.from('plan_versions').select('*').eq('plan_id', planId).order('version', { ascending: false })
    );
  },

  async create(params: { projectId: string; name: string; file: File; createdBy: string }): Promise<Plan> {
    const plan = unwrap(
      await supabase
        .from('plans')
        .insert({ project_id: params.projectId, name: params.name, created_by: params.createdBy, current_version: 1 })
        .select('*')
        .single()
    );

    const path = storageService.buildPath(params.projectId, params.file.name);
    await storageService.upload('plans', path, params.file);

    await supabase.from('plan_versions').insert({
      plan_id: plan.id,
      version: 1,
      storage_path: path,
      uploaded_by: params.createdBy,
    });

    await activityLogsService.log({
      project_id: params.projectId,
      action: 'plan.created',
      entity_type: 'plan',
      entity_id: plan.id,
      metadata: { name: plan.name },
    });

    await notificationsService.notifyResourceChange({
      resourceType: 'plan',
      resourceId: plan.id,
      projectId: params.projectId,
      actorId: params.createdBy,
      type: 'plan_created',
      title: 'Nouveau plan',
      message: `Le plan "${plan.name}" a été ajouté au projet.`,
      link: `/projects/${params.projectId}/plans`,
    });

    return plan;
  },

  async addVersion(params: { plan: Plan; file: File; notes?: string; uploadedBy: string }): Promise<PlanVersion> {
    const newVersion = params.plan.current_version + 1;
    const path = storageService.buildPath(params.plan.project_id, params.file.name);
    await storageService.upload('plans', path, params.file);

    const version = unwrap(
      await supabase
        .from('plan_versions')
        .insert({
          plan_id: params.plan.id,
          version: newVersion,
          storage_path: path,
          notes: params.notes,
          uploaded_by: params.uploadedBy,
        })
        .select('*')
        .single()
    );

    await supabase.from('plans').update({ current_version: newVersion }).eq('id', params.plan.id);

    await activityLogsService.log({
      project_id: params.plan.project_id,
      action: 'plan.new_version',
      entity_type: 'plan',
      entity_id: params.plan.id,
      metadata: { version: newVersion },
    });

    await notificationsService.notifyResourceChange({
      resourceType: 'plan',
      resourceId: params.plan.id,
      projectId: params.plan.project_id,
      actorId: params.uploadedBy,
      type: 'plan_versioned',
      title: 'Nouvelle version de plan',
      message: `"${params.plan.name}" a été mis à jour (version ${newVersion}).`,
      link: `/projects/${params.plan.project_id}/plans`,
    });

    return version;
  },

  async getVersionUrl(version: PlanVersion): Promise<string> {
    return storageService.getSignedUrl('plans', version.storage_path);
  },

  async listAnnotations(planVersionId: string): Promise<PlanAnnotation[]> {
    return unwrap(
      await supabase.from('plan_annotations').select('*').eq('plan_version_id', planVersionId).order('created_at')
    );
  },

  async addAnnotation(payload: {
    plan_version_id: string;
    author_id: string;
    x: number;
    y: number;
    content: string;
    page_number: number;
  }): Promise<PlanAnnotation> {
    return unwrap(await supabase.from('plan_annotations').insert(payload).select('*').single());
  },

  async setAnnotationResolved(id: string, resolved: boolean): Promise<PlanAnnotation> {
    return unwrap(await supabase.from('plan_annotations').update({ resolved }).eq('id', id).select('*').single());
  },

  /**
   * Marque explicitement une version de plan comme envoyée à un ensemble de
   * destinataires, en plus de la notification interne déjà déclenchée à la
   * création/au dépôt d'une nouvelle version. Distinct du partage silencieux
   * (resource_permissions) : c'est une action volontaire et traçable.
   */
  async sendVersion(params: {
    plan: Plan;
    version: PlanVersion;
    sentBy: string;
    recipients: { id: string; label: string }[];
  }): Promise<PlanVersion> {
    const sentTo = params.recipients.map((r) => r.label);
    const updated = unwrap(
      await supabase
        .from('plan_versions')
        .update({ sent_at: new Date().toISOString(), sent_by: params.sentBy, sent_to: sentTo })
        .eq('id', params.version.id)
        .select('*')
        .single()
    );

    await activityLogsService.log({
      project_id: params.plan.project_id,
      action: 'plan.sent',
      entity_type: 'plan',
      entity_id: params.plan.id,
      metadata: { version: params.version.version, recipients: sentTo },
    });

    const { error } = await supabase.from('notifications').insert(
      params.recipients.map((r) => ({
        user_id: r.id,
        type: 'plan_sent',
        title: 'Plan envoyé',
        message: `"${params.plan.name}" (version ${params.version.version}) vous a été envoyé.`,
        link: `/projects/${params.plan.project_id}/plans`,
      }))
    );
    if (error) throw error;

    return updated;
  },

  async remove(plan: Plan): Promise<void> {
    const { error } = await supabase.from('plans').delete().eq('id', plan.id);
    if (error) throw error;
  },
};
