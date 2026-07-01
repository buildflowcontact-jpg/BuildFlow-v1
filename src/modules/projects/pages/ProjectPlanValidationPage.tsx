import { useParams } from 'react-router-dom';
import { PlanValidationTab } from '@/modules/planValidation/PlanValidationTab';

export default function ProjectPlanValidationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <PlanValidationTab projectId={projectId} />;
}
