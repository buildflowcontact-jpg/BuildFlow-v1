import { useParams } from 'react-router-dom';
import { DocumentsTab } from '@/modules/documents/DocumentsTab';

export default function ProjectDocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <DocumentsTab projectId={projectId} />;
}
