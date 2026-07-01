import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, Trash2, UserPlus, Crown } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useMyProjectAccess } from '@/hooks/useMyProjectAccess';
import type { ProjectMember, ProjectMemberWithProfile } from '@/types/domain';
import type { ProjectOutletContext } from './ProjectLayout';
import { confirmStore } from '@/components/ui/ConfirmModal';

export function ProjectMembersPage() {
  const { members, membersLoading, inviteMember, removeMember, transferOwnership } =
    useOutletContext<ProjectOutletContext>();
  const { canTransferOwnership } = useMyProjectAccess(members);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectMember['role']>('collaborator');
  const [transferTarget, setTransferTarget] = useState<ProjectMemberWithProfile | null>(null);

  const currentOwner = members.find((m) => m.role === 'owner') ?? null;

  function handleTransferConfirm() {
    if (!transferTarget?.user_id) return;
    transferOwnership.mutate(
      { newOwnerUserId: transferTarget.user_id },
      { onSuccess: () => setTransferTarget(null) }
    );
  }

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    inviteMember.mutate(
      { email: inviteEmail, role: inviteRole },
      {
        onSuccess: () => {
          setInviteOpen(false);
          setInviteEmail('');
          setInviteRole('collaborator');
        },
      }
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Membres du projet</CardTitle>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Inviter
          </Button>
        </CardHeader>
        {membersLoading ? (
          <FullPageSpinner />
        ) : members.length === 0 ? (
          <EmptyState icon={Users} title="Aucun membre" description="Invitez des collaborateurs sur ce projet." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={member.profile?.full_name ?? member.invited_email} size="sm" />
                  <div>
                    <p className="font-medium text-slate-800">
                      {member.profile?.full_name ?? member.invited_email ?? 'Invitation en attente'}
                    </p>
                    <p className="text-xs text-slate-400">{member.profile?.email ?? member.invited_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={member.role === 'owner' ? 'purple' : 'slate'}>
                    {member.role === 'owner' ? 'Propriétaire' : 'Collaborateur'}
                  </Badge>
                  {member.role !== 'owner' && canTransferOwnership && member.user_id && (
                    <button
                      onClick={() => setTransferTarget(member)}
                      title="Transférer la propriété du projet à ce membre"
                      aria-label="Transférer la propriété du projet à ce membre"
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-purple-50 hover:text-purple-600"
                    >
                      <Crown className="h-4 w-4" />
                    </button>
                  )}
                  {member.role !== 'owner' && (
                    <button
                      onClick={() => {
                        confirmStore.getState().show({ message: 'Retirer ce membre du projet ?' }).then((ok) => { if (ok) removeMember.mutate(member.id); });
                      }}
                      title="Retirer ce membre"
                      aria-label="Retirer ce membre"
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Inviter un collaborateur">
        <form onSubmit={handleInviteSubmit} className="flex flex-col gap-4">
          <Input id="inviteemail"
            label="Email"
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            hint="Si la personne possède déjà un compte BuildFlow, elle sera ajoutée immédiatement."
          />
          <Select id="inviterole" label="Rôle" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as ProjectMember['role'])}>
            <option value="collaborator">Collaborateur</option>
            <option value="owner">Propriétaire</option>
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={inviteMember.isPending}>
              Inviter
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(transferTarget)} onClose={() => setTransferTarget(null)} title="Transférer la propriété du projet">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Vous êtes sur le point de transférer la propriété de ce projet à{' '}
            <strong>{transferTarget?.profile?.full_name ?? transferTarget?.invited_email}</strong>.
            {currentOwner && currentOwner.id !== transferTarget?.id && (
              <>
                {' '}
                {currentOwner.profile?.full_name ?? currentOwner.invited_email ?? 'Le propriétaire actuel'} sera rétrogradé en
                collaborateur.
              </>
            )}{' '}
            Cette action donne à cette personne le contrôle complet du projet (suppression, gestion des membres, etc.).
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setTransferTarget(null)}>
              Annuler
            </Button>
            <Button type="button" onClick={handleTransferConfirm} loading={transferOwnership.isPending}>
              Confirmer le transfert
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
