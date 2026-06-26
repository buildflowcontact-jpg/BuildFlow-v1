import { useEffect, useState } from 'react';
import { MessageCircle, Users, UserPlus } from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import { useProject } from '@/hooks/useProject';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { MessageThread } from './MessageThread';
import type { ConversationWithMeta } from '@/types/domain';

interface MessagingTabProps {
  projectId: string;
}

export function MessagingTab({ projectId }: MessagingTabProps) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { conversations, isLoading, startDirect } = useConversations(projectId, userId);
  const { members } = useProject(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Sélectionne par défaut le fil "groupe" (toujours en première position une
  // fois trié par dernière activité, ou le seul fil disponible au départ).
  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0]!.id);
    }
  }, [activeId, conversations]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const otherMembers = members.filter((m) => m.profile?.id && m.profile.id !== userId);

  function handlePickMember(otherUserId: string) {
    startDirect.mutate(otherUserId, {
      onSuccess: (conversationId) => {
        setActiveId(conversationId);
        setPickerOpen(false);
      },
    });
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card className="p-0">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] md:divide-x md:divide-slate-100" style={{ minHeight: 520 }}>
        <div className="flex flex-col border-b border-slate-100 md:border-b-0">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Messagerie</h3>
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>

          {conversations.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState icon={MessageCircle} title="Aucune conversation" description="L'équipe n'a pas encore de fil de discussion." />
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {conversations.map((conv: ConversationWithMeta) => (
                <li key={conv.id}>
                  <button
                    onClick={() => setActiveId(conv.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${
                      conv.id === activeId ? 'bg-brand-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    {conv.type === 'group' ? (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand-soft">
                        <Users className="h-4 w-4 text-brand-700" />
                      </div>
                    ) : (
                      <Avatar name={conv.displayName} size="sm" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{conv.displayName}</p>
                      <p className="truncate text-xs text-slate-400">{conv.lastMessagePreview ?? 'Aucun message'}</p>
                    </div>
                    {conv.unreadCount > 0 && <Badge tone="blue">{conv.unreadCount}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-h-[420px]">
          {active ? (
            <MessageThread conversation={active} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState icon={MessageCircle} title="Sélectionnez une conversation" />
            </div>
          )}
        </div>
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Nouveau message direct" size="sm">
        {otherMembers.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun autre membre dans ce projet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {otherMembers.map((member) => (
              <li key={member.id}>
                <button
                  onClick={() => handlePickMember(member.profile!.id)}
                  disabled={startDirect.isPending}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Avatar name={member.profile?.full_name} src={member.profile?.avatar_url} size="sm" />
                  <span className="text-sm font-medium text-slate-800">{member.profile?.full_name ?? 'Membre'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </Card>
  );
}
