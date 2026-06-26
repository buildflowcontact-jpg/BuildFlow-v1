import { useParams } from 'react-router-dom';
import { BillingTab } from '@/modules/billing/BillingTab';

export default function ProjectBillingPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <BillingTab projectId={projectId} />;
}
