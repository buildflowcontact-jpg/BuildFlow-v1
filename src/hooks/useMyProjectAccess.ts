import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useOrganization } from './useOrganization';
import type { ProjectMember } from '@/types/domain';

/**
 * Dérive le niveau d'accès de l'utilisateur courant sur un projet.
 *
 * Important (cf. 0011_project_isolation_and_ownership_transfer.sql) : un
 * admin/owner d'organisation N'A PLUS d'accès implicite au contenu d'un
 * projet auquel il n'est pas invité -- un collègue ne voit/n'accède à un
 * projet que s'il y a été ajouté via project_members. canManage/canEdit
 * reflètent donc uniquement le rôle projet (owner/collaborator).
 *
 * Seule exception, volontairement isolée : canTransferOwnership, qui
 * reste vrai pour un admin/owner d'organisation. Elle ne sert qu'à
 * autoriser l'action transfer_project_ownership() (réaffecter le owner
 * d'un projet, p. ex. en cas d'absence) -- une action ciblée, auditée, qui
 * ne donne accès à rien d'autre dans le projet.
 *
 * Remarque : un partage fin via resource_permissions peut accorder 'manage' à un
 * simple collaborateur sur une ressource précise -- ce cas n'est pas couvert ici
 * (qui raisonne au niveau projet) ; le bouton resterait masqué côté UI mais reste
 * accessible via le modal de partage qui vérifie l'accès exact.
 */
export function useMyProjectAccess(members: ProjectMember[]) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { members: orgMembers } = useOrganization();

  return useMemo(() => {
    const myProjectMember = members.find((m) => m.user_id === userId);
    const myOrgMember = orgMembers.find((m) => m.user_id === userId);
    const isOrgAdminOrOwner = myOrgMember?.role === 'admin' || myOrgMember?.role === 'owner';
    const isProjectOwner = myProjectMember?.role === 'owner';

    const canManage = isProjectOwner;
    const canEdit = canManage || myProjectMember?.role === 'collaborator';
    const canTransferOwnership = isProjectOwner || isOrgAdminOrOwner;

    return {
      myProjectRole: myProjectMember?.role ?? null,
      isOrgAdminOrOwner,
      canEdit,
      canManage,
      canTransferOwnership,
    };
  }, [members, orgMembers, userId]);
}
