import { useParams } from 'react-router-dom';
import { BudgetTab } from '@/modules/budget/BudgetTab';

export default function ProjectBudgetPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <BudgetTab projectId={projectId} />;
}
