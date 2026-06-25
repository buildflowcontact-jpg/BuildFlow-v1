import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plansService } from '@/services/plans.service';
import type { Plan } from '@/types/domain';

type AddAnnotationParams = { author_id: string; x: number; y: number; content: string };

export function usePlans(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['plans', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => plansService.list(projectId!),
    enabled: Boolean(projectId),
  });

  const create = useMutation({
    mutationFn: (params: { name: string; file: File; createdBy: string }) =>
      plansService.create({ projectId: projectId!, ...params }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const addVersion = useMutation({
    mutationFn: (params: { plan: Plan; file: File; notes?: string; uploadedBy: string }) => plansService.addVersion(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (plan: Plan) => plansService.remove(plan),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, plans: query.data ?? [], create, addVersion, remove };
}

export function usePlanVersions(planId: string | undefined) {
  return useQuery({
    queryKey: ['plan-versions', planId],
    queryFn: () => plansService.listVersions(planId!),
    enabled: Boolean(planId),
  });
}

export function usePlanAnnotations(planVersionId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['plan-annotations', planVersionId];

  const query = useQuery({
    queryKey,
    queryFn: () => plansService.listAnnotations(planVersionId!),
    enabled: Boolean(planVersionId),
  });

  const addAnnotation = useMutation({
    mutationFn: (params: AddAnnotationParams) =>
      plansService.addAnnotation({ plan_version_id: planVersionId!, ...params }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, annotations: query.data ?? [], addAnnotation };
}
