import { useState, type FormEvent } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  FolderKanban,
  Users,
  Settings,
  ChevronsLeft,
  ChevronDown,
  Plus,
  Info,
  ListTree,
  GanttChartSquare,
  FileText,
  Map,
  Truck,
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  Wallet,
  HelpCircle,
  Clock,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useProjects } from '@/hooks/useProjects';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

const projectSectionItems = [
  { to: '', label: 'Tableau de bord', icon: Info, end: true },
  { to: 'documents', label: 'Documents', icon: FileText },
  { to: 'budget', label: 'Budget', icon: Wallet },
  { to: 'billing', label: 'Devis & Facturation', icon: Receipt },
  { to: 'tasks', label: 'Tâches', icon: ListTree },
  { to: 'gantt', label: 'Planning', icon: GanttChartSquare },
  { to: 'plans', label: 'Plans et 3D', icon: Map },
  { to: 'supplies', label: 'Commandes', icon: Truck },
  { to: 'daily-logs', label: 'Journal de chantier', icon: ClipboardList },
  { to: 'rfis', label: 'RFI', icon: HelpCircle },
  { to: 'time-entries', label: 'Pointage horaire', icon: Clock },
  { to: 'client-portal', label: 'Portail client', icon: LayoutDashboard },
  { to: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { to: 'punchlist', label: 'Réserves', icon: ClipboardCheck },
  { to: 'quality', label: 'Qualité', icon: ShieldCheck },
  { to: 'messages', label: 'Messagerie', icon: MessageCircle },
  { to: 'members', label: 'Membres', icon: Users },
];

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { projects, create } = useProjects();
  const organization = useAuthStore((s) => s.organization);
  const profile = useAuthStore((s) => s.profile);
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const syncStatus = useSyncStatus();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  function openCreateModal() {
    setCreateError(null);
    setName('');
    setDescription('');
    setAddress('');
    setCreateOpen(true);
  }

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (!organization?.id) {
      setCreateError('Aucune organisation associée à votre compte. Recharge la page ou contacte le support.');
      return;
    }

    setCreateError(null);
    create.mutate(
      {
        name: name.trim(),
        reference: null,
        description: description.trim() || null,
        address: address.trim() || null,
        client_id: null,
        status: 'prospection',
        start_date: null,
        end_date_planned: null,
        budget: null,
      },
      {
        onSuccess: (project) => {
          setCreateOpen(false);
          setName('');
          setDescription('');
          setAddress('');
          navigate(`/projects/${project.id}`);
        },
        onError: (error) => {
          setCreateError(error instanceof Error ? error.message : 'Erreur lors de la création du projet.');
        },
      }
    );
  }

  const displayName = profile?.full_name || profile?.email || 'Mon compte';
  const syncTooltip =
    syncStatus.state === 'online'
      ? `Connecté — dernière synchro ${
          syncStatus.lastSyncAt
            ? syncStatus.lastSyncAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            : 'à l’instant'
        }`
      : !syncStatus.isOnline
        ? 'Hors ligne — pas d’accès internet'
        : 'Supabase inaccessible — synchronisation interrompue';

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-slate-200/80 bg-white transition-all duration-200 ease-smooth',
        collapsed ? 'w-[68px]' : 'w-60'
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-4">
        <img src="/logo-icon-square.png" alt="BuildFlow" className="h-8 w-8 shrink-0" />
        {!collapsed && <span className="font-semibold tracking-tight text-slate-900">BuildFlow</span>}
      </div>

      <div className="flex flex-col gap-2 border-b border-slate-100 p-3">
        {collapsed ? (
          <>
            <button
              onClick={toggleSidebar}
              title="Sélectionner un projet"
              aria-label="Sélectionner un projet"
              className="flex h-9 w-full items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <FolderKanban className="h-4 w-4" />
            </button>
            <button
              onClick={openCreateModal}
              title="Créer un projet"
              aria-label="Créer un projet"
              className="flex h-9 w-full items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <div className="relative">
              <select
                value={projectId ?? ''}
                onChange={(e) => {
                  if (e.target.value) navigate(`/projects/${e.target.value}`);
                }}
                className={cn(
                  'h-9 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700',
                  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
                )}
              >
                <option value="" disabled>
                  {projects.length === 0 ? 'Aucun projet' : 'Sélectionner un projet…'}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              <Plus className="h-4 w-4" />
              Créer un projet
            </button>
          </>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {projectId && (
          <>
            <div className="my-2 border-t border-slate-100" />
            {!collapsed && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Projet</p>
            )}
            {projectSectionItems
              .filter((item) => item.to !== 'time-entries' || profile?.job_title === 'Chef de chantier')
              .map((item) => (
              <NavLink
                key={item.to || 'overview'}
                to={`/projects/${projectId}${item.to ? `/${item.to}` : ''}`}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ease-smooth',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-brand-600" />
                    )}
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <button
        onClick={toggleSidebar}
        title={collapsed ? 'Étendre la barre latérale' : 'Réduire la barre latérale'}
        aria-label={collapsed ? 'Étendre la barre latérale' : 'Réduire la barre latérale'}
        className="flex items-center justify-center gap-2 border-t border-slate-100 p-3 text-slate-400 transition-colors duration-150 hover:text-slate-600"
      >
        <ChevronsLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
      </button>

      <div className={cn('flex items-center gap-2 border-t border-slate-100 p-3', collapsed && 'flex-col')}>
        <span
          title={syncTooltip}
          className={cn(
            'h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white',
            syncStatus.state === 'online' ? 'bg-emerald-500' : 'bg-red-500'
          )}
        />
        {!collapsed && (
          <span className="flex-1 truncate text-sm font-medium text-slate-700" title={displayName}>
            {displayName}
          </span>
        )}
        <button
          onClick={() => navigate('/settings')}
          title="Paramètres du compte"
          aria-label="Paramètres du compte"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Créer un projet">
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <Input
            label="Nom du projet"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="Adresse / localisation"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Créer le projet
            </Button>
          </div>
        </form>
      </Modal>
    </aside>
  );
}
