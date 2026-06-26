import { useParams } from 'react-router-dom';
import { MessagingTab } from '@/modules/messaging/MessagingTab';

export default function ProjectMessagingPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <MessagingTab projectId={projectId} />;
}
