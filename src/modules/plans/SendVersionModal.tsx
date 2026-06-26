import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { usePlanVersions } from '@/hooks/usePlans';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime } from '@/utils/date';
import { cn } from '@/utils/cn';
import type { Plan, PlanVersion, ProjectMemberWithProfile } from '@/types/domain';

interface SendVersionModalProps {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  version: PlanVersion;
  members: ProjectMemberWithProfile[];
  userId: string | undefined;
}

export function SendVersionModal({ open, onClose, plan, version, members, userId }: SendVersionModalProps) {
  const { sendVersion } = usePlanVersions(plan.id);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  const candidates = members.filter((m) => m.profile);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSend() {
    if (!userId || selected.size === 0) return;
    const recipients = candidates
      .filter((m) => selected.has(m.profile!.id))
      .map((m) => ({ id: m.profile!.id, label: m.profile!.full_name ?? m.profile!.email ?? 'Utilisateur' }));
    sendVersion.mutate({ plan, version, sentBy: userId, recipients }, { onSuccess: () => onClose() });
  }

  return (
    <Modal open={open} onClose={onClose} title={`Envoyer — ${plan.name} (v${version.version})`}>
      <div className="flex flex-col gap-4">
        {candidates.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun membre disponible sur ce projet.</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {candidates.map((m) => {
              const id = m.profile!.id;
              const checked = selected.has(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150',
                      checked ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(id)} className="h-4 w-4 accent-brand-600" />
                    <span className="font-medium text-slate-800">{m.profile!.full_name ?? m.profile!.email}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {version.sent_at && (
          <p className="text-xs text-slate-400">
            Dernier envoi : {formatDateTime(version.sent_at)}
            {Array.isArray(version.sent_to) && version.sent_to.length > 0 && ` à ${(version.sent_to as string[]).join(', ')}`}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSend} loading={sendVersion.isPending} disabled={selected.size === 0}>
            <Send className="h-4 w-4" />
            Envoyer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
