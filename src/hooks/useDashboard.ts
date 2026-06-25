import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { useAuthStore } from '@/stores/authStore';

export function useDashboard() {
  const organization = useAuthStore((s) => s.organization);

  return useQuery({
    queryKey: ['dashboard', organization?.id],
    queryFn: () => dashboardService.getSummary(organization!.id),
    enabled: Boolean(organization?.id),
    refetchInterval: 60_000,
  });
}
