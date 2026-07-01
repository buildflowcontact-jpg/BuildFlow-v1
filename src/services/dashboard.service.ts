import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Task, ActivityLog, Profile, Project, WarrantyClaim, PlanRevision } from '@/types/domain';

export type WarrantyWithProject = WarrantyClaim & { project: Pick<Project, 'id' | 'name'> | null };
export type PlanWithProject = PlanRevision & { project: Pick<Project, 'id' | 'name'> | null };

export interface DashboardSummary {
  projects: Project[];
  overdueTasks: Task[];
  openIncidentsCount: number;
  lateSuppliesCount: number;
  recentActivity: (ActivityLog & { user: Profile | null })[];
  progressByProject: Record<string, number>;
  overallProgress: number;
  openWarrantyClaimsCount: number;
  urgentWarrantyClaimsCount: number;
  plansPendingReviewCount: number;
  activeProspectsCount: number;
  urgentWarrantyClaims: WarrantyWithProject[];
  plansPendingReview: PlanWithProject[];
}

export const dashboardService = {
  async getSummary(organizationId: string): Promise<DashboardSummary> {
    const [projectsRes, prospectsRes] = await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('prospects')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .not('status', 'in', '(gagne,perdu,sans_suite)'),
    ]);

    const projects = unwrap(projectsRes);
    const activeProspectsCount = prospectsRes.count ?? 0;

    const activeProjectIds = projects
      .filter((p) => p.status !== 'annule' && p.status !== 'livre')
      .map((p) => p.id);

    if (activeProjectIds.length === 0) {
      return {
        projects,
        overdueTasks: [],
        openIncidentsCount: 0,
        lateSuppliesCount: 0,
        recentActivity: [],
        progressByProject: {},
        overallProgress: 0,
        openWarrantyClaimsCount: 0,
        urgentWarrantyClaimsCount: 0,
        plansPendingReviewCount: 0,
        activeProspectsCount,
        urgentWarrantyClaims: [],
        plansPendingReview: [],
      };
    }

    const today = new Date().toISOString().slice(0, 10);

    const [
      tasksRes,
      overdueRes,
      incidentsRes,
      suppliesRes,
      activityRes,
      warrantyOpenCountRes,
      warrantyUrgentCountRes,
      plansCountRes,
      warrantyClaimsRes,
      plansPendingRes,
    ] = await Promise.all([
      supabase.from('tasks').select('*').in('project_id', activeProjectIds),
      supabase
        .from('tasks')
        .select('*')
        .in('project_id', activeProjectIds)
        .lt('end_date', today)
        .neq('status', 'done')
        .order('end_date', { ascending: true })
        .limit(20),
      supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .in('project_id', activeProjectIds)
        .in('status', ['open', 'in_progress']),
      supabase
        .from('supplies')
        .select('*', { count: 'exact', head: true })
        .in('project_id', activeProjectIds)
        .lt('expected_delivery_date', today)
        .not('status', 'in', '(delivered,cancelled)'),
      supabase
        .from('activity_logs')
        .select('*, user:profiles(*)')
        .in('project_id', activeProjectIds)
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('warranty_claims')
        .select('*', { count: 'exact', head: true })
        .in('project_id', activeProjectIds)
        .in('status', ['ouvert', 'en_cours']),
      supabase
        .from('warranty_claims')
        .select('*', { count: 'exact', head: true })
        .in('project_id', activeProjectIds)
        .eq('priority', 'urgente')
        .not('status', 'in', '(resolu,clos)'),
      supabase
        .from('plan_revisions')
        .select('*', { count: 'exact', head: true })
        .in('project_id', activeProjectIds)
        .eq('status', 'soumis'),
      supabase
        .from('warranty_claims')
        .select('*, project:projects(id, name)')
        .in('project_id', activeProjectIds)
        .in('status', ['ouvert', 'en_cours'])
        .order('reported_date', { ascending: true })
        .limit(5),
      supabase
        .from('plan_revisions')
        .select('*, project:projects(id, name)')
        .in('project_id', activeProjectIds)
        .eq('status', 'soumis')
        .order('submitted_at', { ascending: true })
        .limit(5),
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (overdueRes.error) throw overdueRes.error;
    if (incidentsRes.error) throw incidentsRes.error;
    if (suppliesRes.error) throw suppliesRes.error;
    if (activityRes.error) throw activityRes.error;

    const tasksList = (tasksRes.data ?? []) as Task[];

    const progressByProject: Record<string, number> = {};
    for (const projectId of activeProjectIds) {
      const projectTasks = tasksList.filter((t) => t.project_id === projectId);
      progressByProject[projectId] = projectTasks.length
        ? Math.round(projectTasks.reduce((sum, t) => sum + t.progress, 0) / projectTasks.length)
        : 0;
    }

    const overallProgress = tasksList.length
      ? Math.round(tasksList.reduce((sum, t) => sum + t.progress, 0) / tasksList.length)
      : 0;

    return {
      projects,
      overdueTasks: (overdueRes.data ?? []) as Task[],
      openIncidentsCount: incidentsRes.count ?? 0,
      lateSuppliesCount: suppliesRes.count ?? 0,
      recentActivity: (activityRes.data ?? []) as unknown as (ActivityLog & { user: Profile | null })[],
      progressByProject,
      overallProgress,
      openWarrantyClaimsCount: warrantyOpenCountRes.count ?? 0,
      urgentWarrantyClaimsCount: warrantyUrgentCountRes.count ?? 0,
      plansPendingReviewCount: plansCountRes.count ?? 0,
      activeProspectsCount,
      urgentWarrantyClaims: (warrantyClaimsRes.data ?? []) as unknown as WarrantyWithProject[],
      plansPendingReview: (plansPendingRes.data ?? []) as unknown as PlanWithProject[],
    };
  },
};
