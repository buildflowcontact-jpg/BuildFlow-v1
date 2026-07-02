import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plansService } from '@/services/plans.service';
import { toast } from '@/stores/toastStore';
import type { Plan, PlanVersion } from '@/types/domain';

type AddAnnotationParams = { author_id: string; x: number; y: number; content: string; page_number: number };

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Plan ajouté'); },
    onError: () => toast.error("Erreur lors de l'ajout du plan"),
  });

  const addVersion = useMutation({
    mutationFn: (params: { plan: Plan; file: File; notes?: string; uploadedBy: string }) => plansService.addVersion(params),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Nouvelle version ajoutée'); },
    onError: () => toast.error("Erreur lors de l'ajout de la version"),
  });

  const remove = useMutation({
    mutationFn: (plan: Plan) => plansService.remove(plan),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Plan supprimé'); },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  return { ...query, plans: query.data ?? [], create, addVersion, remove };
}

export function usePlanVersions(planId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['plan-versions', planId];

  const query = useQuery({
    queryKey,
    queryFn: () => plansService.listVersions(planId!),
    enabled: Boolean(planId),
  });

  const sendVersion = useMutation({
    mutationFn: (params: { plan: Plan; version: PlanVersion; sentBy: string; recipients: { id: string; label: string }[] }) =>
      plansService.sendVersion(params),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Plan envoyé aux destinataires'); },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  return { ...query, sendVersion };
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Annotation ajoutée'); },
    onError: () => toast.error("Erreur lors de l'ajout de l'annotation"),
  });

  const setResolved = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) => plansService.setAnnotationResolved(id, resolved),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, annotations: query.data ?? [], addAnnotation, setResolved };
}
