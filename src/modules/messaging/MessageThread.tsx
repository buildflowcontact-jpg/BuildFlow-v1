import { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useMessages } from '@/hooks/useMessages';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/utils/date';
import type { ConversationWithMeta } from '@/types/domain';

interface MessageThreadProps {
  conversation: ConversationWithMeta;
}

export function MessageThread({ conversation }: MessageThreadProps) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { messages, isLoading, send } = useMessages(conversation.id);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !userId) return;
    send.mutate(
      { senderId: userId, content },
      {
        onSuccess: () => setDraft(''),
      }
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{conversation.displayName}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Aucun message" description="Démarrez la conversation." />
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => {
              const isOwn = message.sender_id === userId;
              return (
                <li key={message.id} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <Avatar name={message.sender?.full_name} src={message.sender?.avatar_url} size="sm" />
                  <div className={`flex max-w-[75%] flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        isOwn ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {message.content}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {!isOwn && message.sender?.full_name ? `${message.sender.full_name} · ` : ''}
                      {formatDateTime(message.created_at)}
                    </span>
                  </div>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Écrire un message…"
          className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-brand-400"
        />
        <Button type="submit" size="sm" disabled={!draft.trim()} loading={send.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
