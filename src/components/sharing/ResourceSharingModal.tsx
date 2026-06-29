import { useState } from 'react';
import { Share2, Trash2 } from 'lucide-react';
import { useResourcePermissions } from '@/hooks/usePermissions';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { PERMISSION_LEVEL_LABELS } from '@/types/domain';
import type { PermissionLevel, ResourceType } from '@/types/database.types';
import type { ProjectMemberWithProfile } from '@/types/domain';

interface ResourceSharingModalProps {
  open: boolean;
  onClose: () => void;
  resourceType: ResourceType;
  resourceId: string | undefined;
  resourceLabel: string;
  projectId: string;
  members: ProjectMemberWithProfile[];
}

export function ResourceSharingModal({
  open,
  onClose,
  resourceType,
  resourceId,
  resourceLabel,
  projectId,
  members,
}: ResourceSharingModalProps) {
  const { permissions, isLoading, grant, revoke } = useResourcePermissions(resourceType, resourceId, projectId);
  const [granteeId, setGranteeId] = useState('');
  const [permission, setPermission] = useState<PermissionLevel>('view');

  const availableMembers = members.filter(
    (m) => m.profile && !permissions.some((p) => p.grantee_user_id === m.profile!.id)
  );

  function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!granteeId) return;
    grant.mutate(
      { granteeUserId: granteeId, permission },
      {
        onSuccess: () => {
          setGranteeId('');
          setPermission('view');
        },
      }
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Partager — ${resourceLabel}`} size="md">
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : permissions.length === 0 ? (
          <p className="text-sm text-slate-400">Non partagé explicitement. Accès hérité du projet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {permissions.map((perm) => (
              <li key={perm.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Avatar name={perm.grantee?.full_name ?? perm.grantee?.email} size="sm" />
                  <div>
                    <p className="font-medium text-slate-800">{perm.grantee?.full_name ?? perm.grantee?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="blue">{PERMISSION_LEVEL_LABELS[perm.permission as PermissionLevel]}</Badge>
                  <button
                    onClick={() => revoke.mutate(perm.id)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleGrant} className="flex items-end gap-2 border-t border-slate-100 pt-4">
          <Select id="granteeid" label="Membre" value={granteeId} onChange={(e) => setGranteeId(e.target.value)} className="flex-1">
            <option value="">Sélectionner…</option>
            {availableMembers.map((m) => (
              <option key={m.profile!.id} value={m.profile!.id}>
                {m.profile!.full_name ?? m.profile!.email}
              </option>
            ))}
          </Select>
          <Select id="permission" label="Niveau" value={permission} onChange={(e) => setPermission(e.target.value as PermissionLevel)} className="w-40">
            {Object.entries(PERMISSION_LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm" loading={grant.isPending} disabled={!granteeId}>
            <Share2 className="h-4 w-4" />
            Partager
          </Button>
        </form>
      </div>
    </Modal>
  );
}
