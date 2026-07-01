import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, HelpCircle, FileSignature, FileText, ArrowRight, Link2, Plus, Trash2, Copy, Check } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useTasks } from '@/hooks/useTasks';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useRfis } from '@/hooks/useRfis';
import { useChangeOrders } from '@/hooks/useChangeOrders';
import { useDocuments } from '@/hooks/useDocuments';
import { usePortalTokens } from '@/hooks/usePortalTokens';
import { confirmStore } from '@/components/ui/ConfirmModal';
import { toast } from '@/stores/toastStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { PROJECT_STATUS_LABELS, RFI_STATUS_LABELS, CHANGE_ORDER_STATUS_LABELS, parsePortalWidgets } from '@/types/domain';
import { formatDate, formatDateTime } from '@/utils/date';
import type { ProjectStatus } from '@/types/database.types';

// ── Panneau de gestion des liens portail ──────────────────────────────────────

function PortalLinksPanel({ projectId }: { projectId: string }) {
  const { tokens, isLoading, create, revoke } = usePortalTokens(projectId);
  const [email, setEmail] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const portalBase = `${window.location.origin}/portal`;

  function getUrl(token: string) {
    return `${portalBase}/${token}`;
  }

  async function handleCopy(token: string, id: string) {
    await navigator.clipboard.writeText(getUrl(token));
    setCopiedId(id);
    toast.success('Lien copié !');
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    create.mutate(email.trim(), {
      onSuccess: () => {
        toast.success('Lien portail créé');
        setEmail('');
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-brand-500" />
          <CardTitle>Liens portail client</CardTitle>
        </div>
      </CardHeader>
      <p className="mb-4 text-sm text-slate-500">
        Générez un lien de portail en lecture seule à partager avec votre client. Valide 30 jours.
      </p>

      <form onSubmit={handleCreate} className="mb-4 flex gap-2">
        <Input
          id="portal-email"
          type="email"
          placeholder="email@client.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="sm" loading={create.isPending}>
          <Plus className="h-4 w-4" />
          Créer
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun lien actif.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 truncate">{t.client_email}</p>
                <p className="text-xs text-slate-400">Expire le {formatDate(t.expires_at)}</p>
              </div>
              <button
                onClick={() => handleCopy(t.token, t.id)}
                title="Copier le lien"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
              >
                {copiedId === t.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                onClick={() =>
                  confirmStore.getState().show({ message: `Révoquer le lien de ${t.client_email} ?` }).then((ok) => {
                    if (ok) revoke.mutate(t.id, { onSuccess: () => toast.success('Lien révoqué') });
                  })
                }
                title="Révoquer"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

interface ClientPortalTabProps {
  projectId: string;
}

export function ClientPortalTab({ projectId }: ClientPortalTabProps) {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const base = `/projects/${routeProjectId ?? projectId}`;

  const { project, isLoading: projectLoading } = useProject(projectId);
  const { tasks, isLoading: tasksLoading } = useTasks(projectId);
  const { dailyLogs, isLoading: logsLoading } = useDailyLogs(projectId);
  const { rfis, isLoading: rfisLoading } = useRfis(projectId);
  const { changeOrders, isLoading: changeOrdersLoading } = useChangeOrders(projectId);
  const { documents, isLoading: documentsLoading } = useDocuments(projectId);

  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.status === 'done').length;
    return Math.round((done / tasks.length) * 100);
  }, [tasks]);

  const recentLogs = useMemo(
    () => [...dailyLogs].sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, 3),
    [dailyLogs]
  );
  const openRfis = useMemo(() => rfis.filter((r) => r.status !== 'closed').slice(0, 5), [rfis]);
  const pendingChangeOrders = useMemo(
    () => changeOrders.filter((c) => c.status === 'pending_approval'),
    [changeOrders]
  );
  const recentDocuments = useMemo(
    () => [...documents].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [documents]
  );

  if (projectLoading || tasksLoading || logsLoading || rfisLoading || changeOrdersLoading || documentsLoading) {
    return <FullPageSpinner />;
  }
  if (!project) return null;

  const widgets = parsePortalWidgets(project.portal_widgets);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{project.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{project.address || 'Adresse non renseignée'}</p>
          </div>
          <Badge tone="blue">{PROJECT_STATUS_LABELS[project.status as ProjectStatus]}</Badge>
        </div>
        {widgets.progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Avancement</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </Card>

      {widgets.change_orders && pendingChangeOrders.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Avenants en attente de votre décision</CardTitle>
            <button
              onClick={() => navigate(`${base}/change-orders`)}
              className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              Traiter <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="divide-y divide-amber-100">
            {pendingChangeOrders.map((co) => (
              <li key={co.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-slate-800">
                  Avenant #{co.number} — {co.title}
                </span>
                <Badge tone="yellow">{CHANGE_ORDER_STATUS_LABELS[co.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(widgets.daily_logs || widgets.rfis) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {widgets.daily_logs && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <CardHeader className="!mb-0">
                  <CardTitle>Journal de chantier récent</CardTitle>
                </CardHeader>
                <button
                  onClick={() => navigate(`${base}/daily-logs`)}
                  className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                >
                  Voir tout <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              {recentLogs.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Aucune entrée" description="Le journal de chantier sera publié ici." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentLogs.map((log) => (
                    <li key={log.id} className="py-2.5 text-sm">
                      <p className="font-medium text-slate-800">{formatDate(log.log_date)}</p>
                      <p className="mt-0.5 line-clamp-2 text-slate-600">{log.progress_summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {widgets.rfis && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <CardHeader className="!mb-0">
                  <CardTitle>Demandes d'information ouvertes</CardTitle>
                </CardHeader>
                <button
                  onClick={() => navigate(`${base}/rfis`)}
                  className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                >
                  Voir tout <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              {openRfis.length === 0 ? (
                <EmptyState icon={HelpCircle} title="Aucune RFI ouverte" description="Posez vos questions techniques à l'équipe projet." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {openRfis.map((rfi) => (
                    <li key={rfi.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="font-medium text-slate-800">
                        #{rfi.number} — {rfi.title}
                      </span>
                      <Badge tone={rfi.status === 'open' ? 'red' : 'blue'}>{RFI_STATUS_LABELS[rfi.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}

      {widgets.documents && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardHeader className="!mb-0">
              <CardTitle>Documents récents</CardTitle>
            </CardHeader>
            <button
              onClick={() => navigate(`${base}/documents`)}
              className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              Voir tout <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {recentDocuments.length === 0 ? (
            <EmptyState icon={FileText} title="Aucun document" description="Les documents partagés apparaîtront ici." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentDocuments.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    <FileSignature className="h-4 w-4 text-slate-400" />
                    {doc.name}
                  </span>
                  <span className="text-xs text-slate-400">{formatDateTime(doc.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {!widgets.progress &&
        !widgets.change_orders &&
        !widgets.daily_logs &&
        !widgets.rfis &&
        !widgets.documents && (
          <EmptyState
            icon={ClipboardList}
            title="Aucun widget activé"
            description="Le chef de projet n'a encore activé aucune section pour ce portail."
          />
        )}

      {/* Panneau de partage de liens portail */}
      <PortalLinksPanel projectId={projectId} />
    </div>
  );
}
