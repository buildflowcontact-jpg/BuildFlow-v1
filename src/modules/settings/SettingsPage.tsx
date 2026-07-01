import { useEffect, useRef, useMemo, useState } from 'react';
import { Building, User, Users, Trash2, Camera, UserPlus, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useOrganization } from '@/hooks/useOrganization';
import { authService } from '@/services/auth.service';
import { supabase } from '@/lib/supabaseClient';
import { Tabs } from '@/components/ui/Tabs';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import type { OrgRole } from '@/types/database.types';
import { JOB_TITLE_OPTIONS } from '@/types/domain';

const TABS = [
  { key: 'organization', label: 'Organisation', icon: Building },
  { key: 'profile', label: 'Profil', icon: User },
  { key: 'members', label: 'Membres', icon: Users },
];

const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
};

export function SettingsPage() {
  const [tab, setTab] = useState('organization');
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const { organization, members, membersLoading, update, updateMemberRole, removeMember, addMember } = useOrganization();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState(organization?.name ?? '');
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [jobTitle, setJobTitle] = useState(profile?.job_title ?? '');
  const [companyName, setCompanyName] = useState(profile?.company_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrgName(organization?.name ?? '');
  }, [organization?.name]);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setFirstName(profile?.first_name ?? '');
    setLastName(profile?.last_name ?? '');
    setJobTitle(profile?.job_title ?? '');
    setCompanyName(profile?.company_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.first_name, profile?.last_name, profile?.job_title, profile?.company_name, profile?.phone]);

  function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({ name: orgName });
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    try {
      const computedFullName = [firstName, lastName].filter(Boolean).join(' ').trim() || fullName;
      const updated = await authService.updateProfile(profile.id, {
        full_name: computedFullName,
        first_name: firstName || null,
        last_name: lastName || null,
        job_title: jobTitle || null,
        company_name: companyName || null,
        phone: phone || null,
      });
      setProfile(updated);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      const updated = await authService.updateProfile(profile.id, { avatar_url: avatarUrl });
      setProfile(updated);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Erreur lors de l'envoi de la photo.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Nombre de membres pouvant administrer l'organisation (owner + admin). Si un seul
  // membre détient ce niveau d'accès, son indisponibilité (départ, absence, perte de
  // compte) bloquerait toute gestion de l'organisation (membres, paramètres, projets
  // orphelins) — d'où l'alerte ci-dessous invitant à promouvoir un second administrateur.
  const adminCount = useMemo(() => members.filter((m) => m.role === 'owner' || m.role === 'admin').length, [members]);
  const hasSingleAdminRisk = !membersLoading && members.length > 0 && adminCount <= 1;

  // Seul le propriétaire de l'organisation peut modifier le rôle ou retirer un
  // autre administrateur — un simple admin ne doit gérer que les membres
  // 'member'. Reflète côté UI la policy RLS "org_members_manage_admin"
  // (migration 0006) qui empêche désormais un admin de se promouvoir 'owner'
  // ou de rétrograder/retirer le propriétaire réel.
  const isViewerOwner = useMemo(() => members.some((m) => m.user_id === profile?.id && m.role === 'owner'), [members, profile?.id]);

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    addMember.mutate(
      { email: inviteEmail, role: inviteRole },
      {
        onSuccess: () => {
          setInviteOpen(false);
          setInviteEmail('');
          setInviteRole('member');
        },
        onError: (err) => setInviteError(err instanceof Error ? err.message : "Erreur lors de l'ajout du membre."),
      }
    );
  }

  if (!organization || !profile) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'organization' && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
          </CardHeader>
          <form onSubmit={handleOrgSubmit} className="flex flex-col gap-4">
            <Input id="orgname" label="Nom de l'organisation" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <div className="flex justify-end">
              <Button type="submit" loading={update.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === 'profile' && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Mon profil</CardTitle>
          </CardHeader>
          <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="group relative">
                <Avatar name={profile.full_name} src={profile.avatar_url} size="lg" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Changer la photo"
                  aria-label="Changer la photo"
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  <Camera className="h-3 w-3" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <p className="font-medium text-slate-800">{profile.full_name}</p>
                <p className="text-sm text-slate-500">{profile.email}</p>
                {uploadingAvatar && <p className="text-xs text-brand-600">Envoi en cours…</p>}
                {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input id="firstname" label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input id="lastname" label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <Select id="jobtitle" label="Profession" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}>
              <option value="" disabled>
                Sélectionner une profession…
              </option>
              {JOB_TITLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Input id="companyname" label="Entreprise" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <Input id="phone" label="Téléphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input id="profile-email" label="Email" value={profile.email} disabled hint="L'email ne peut pas être modifié ici." />
            <div className="flex justify-end">
              <Button type="submit" loading={savingProfile}>
                Enregistrer
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === 'members' && (
        <Card>
          {hasSingleAdminRisk && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong className="font-medium">Point de blocage : un seul administrateur.</strong> Si cette personne
                devient indisponible (départ, absence, perte d'accès), plus personne ne pourra gérer l'organisation
                (membres, paramètres). Promouvez un second membre en administrateur pour sécuriser la continuité.
              </span>
            </div>
          )}
          <CardHeader>
            <CardTitle>Membres de l'organisation</CardTitle>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Ajouter
            </Button>
          </CardHeader>
          {membersLoading ? (
            <FullPageSpinner />
          ) : (
            <ul className="divide-y divide-slate-100">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Avatar name={member.profile?.full_name} src={member.profile?.avatar_url} size="sm" />
                    <div>
                      <p className="font-medium text-slate-800">{member.profile?.full_name ?? 'Utilisateur'}</p>
                      <p className="text-xs text-slate-400">{member.profile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {member.role === 'owner' || (member.role === 'admin' && !isViewerOwner) ? (
                      <Badge tone="purple">{ORG_ROLE_LABELS[member.role]}</Badge>
                    ) : (
                      <Select
                        value={member.role}
                        onChange={(e) =>
                          updateMemberRole.mutate({ memberId: member.id, role: e.target.value as OrgRole })
                        }
                        className="h-8 w-40 text-xs"
                      >
                        <option value="admin">{ORG_ROLE_LABELS.admin}</option>
                        <option value="member">{ORG_ROLE_LABELS.member}</option>
                      </Select>
                    )}
                    {member.role !== 'owner' && (isViewerOwner || member.role === 'member') && (
                      <button
                        onClick={() => {
                          confirmStore.getState().show({ message: 'Retirer ce membre de l\'organisation ?' }).then((ok) => { if (ok) removeMember.mutate(member.id); });
                        }}
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
      )}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Ajouter un membre">
        <form onSubmit={handleInviteSubmit} className="flex flex-col gap-4">
          <Input id="inviteemail"
            label="Email"
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            hint="La personne doit déjà posséder un compte BuildFlow."
          />
          <Select id="inviterole" label="Rôle" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)}>
            <option value="member">{ORG_ROLE_LABELS.member}</option>
            <option value="admin">{ORG_ROLE_LABELS.admin}</option>
          </Select>
          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={addMember.isPending}>
              Ajouter
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
    