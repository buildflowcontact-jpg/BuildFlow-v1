import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HardHat, CheckCircle2, HelpCircle, FileText, ClipboardList, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatDate } from '@/utils/date';

// ── Types ────────────────────────────────────────────────────────────────────

interface PortalProject {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  status: string;
  start_date: string | null;
  end_date_planned: string | null;
  budget: number | null;
}

interface PortalData {
  project: PortalProject;
  progress: number;
  open_rfis: { id: string; number: number; title: string; status: string; created_at: string }[];
  pending_change_orders: { id: string; title: string; status: string; amount: number | null; created_at: string }[];
  recent_documents: { id: string; name: string; type: string; created_at: string }[];
  recent_logs: { id: string; log_date: string; summary: string | null; weather: string | null }[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  on_hold: 'En pause',
  completed: 'Terminé',
  cancelled: 'Annulé',
  open: 'Ouverte',
  answered: 'Répondue',
  closed: 'Clôturée',
  pending_approval: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
};

// ── Composant ─────────────────────────────────────────────────────────────────

export function PublicPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    void supabase
      .rpc('get_portal_data', { p_token: token })
      .then(({ data: result, error: rpcError }) => {
        if (rpcError) {
          setError('Impossible de charger le portail.');
        } else {
          // La RPC retourne Json — on cast via unknown
          const payload = result as unknown as (PortalData & { error?: string }) | null;
          if (!payload || payload.error) {
            setError(payload?.error ?? 'Token invalide ou expiré');
          } else {
            setData(payload);
          }
        }
        setLoading(false);
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50/30 to-violet-50/30">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 rounded-xl bg-gradient-brand px-3 py-2 text-white shadow-glow">
            <HardHat className="h-4 w-4" />
            <span className="font-semibold">BuildFlow</span>
          </div>
          <p className="text-xs text-slate-400">Portail client — lecture seule</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <h2 className="text-xl font-semibold text-slate-800">Accès impossible</h2>
            <p className="text-slate-500">{error}</p>
            <p className="text-sm text-slate-400">
              Ce lien est peut-être expiré. Demandez un nouveau lien à votre interlocuteur.
            </p>
          </div>
        )}

        {data && !loading && (
          <div className="flex flex-col gap-8">
            {/* Entête projet */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{data.project.name}</h1>
                  {data.project.address && (
                    <p className="mt-1 text-sm text-slate-500">{data.project.address}</p>
                  )}
                  {data.project.description && (
                    <p className="mt-2 text-sm text-slate-600">{data.project.description}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  {STATUS_LABELS[data.project.status] ?? data.project.status}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-slate-400">Début</p>
                  <p className="mt-0.5 font-medium text-slate-700">
                    {data.project.start_date ? formatDate(data.project.start_date) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Fin prévue</p>
                  <p className="mt-0.5 font-medium text-slate-700">
                    {data.project.end_date_planned ? formatDate(data.project.end_date_planned) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Budget</p>
                  <p className="mt-0.5 font-medium text-slate-700">
                    {data.project.budget != null
                      ? `${data.project.budget.toLocaleString('fr-FR')} €`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Avancement</p>
                  <p className="mt-0.5 font-medium text-slate-700">{data.progress} %</p>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500"
                    style={{ width: `${data.progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* RFIs ouvertes */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-brand-500" />
                  <h2 className="font-semibold text-slate-800">Demandes d'information</h2>
                  {data.open_rfis.length > 0 && (
                    <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                      {data.open_rfis.length}
                    </span>
                  )}
                </div>
                {data.open_rfis.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucune RFI ouverte</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.open_rfis.map((r) => (
                      <li key={r.id} className="py-2 text-sm">
                        <p className="font-medium text-slate-700">
                          RFI #{r.number} — {r.title}
                        </p>
                        <p className="text-xs text-slate-400">
                          {STATUS_LABELS[r.status] ?? r.status} · {formatDate(r.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Avenants en attente */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  <h2 className="font-semibold text-slate-800">Avenants en attente</h2>
                  {data.pending_change_orders.length > 0 && (
                    <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                      {data.pending_change_orders.length}
                    </span>
                  )}
                </div>
                {data.pending_change_orders.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucun avenant en attente</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.pending_change_orders.map((c) => (
                      <li key={c.id} className="py-2 text-sm">
                        <p className="font-medium text-slate-700">{c.title}</p>
                        <p className="text-xs text-slate-400">
                          {c.amount != null ? `${c.amount.toLocaleString('fr-FR')} €` : ''} · {formatDate(c.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Documents récents */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-500" />
                  <h2 className="font-semibold text-slate-800">Documents récents</h2>
                </div>
                {data.recent_documents.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucun document</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.recent_documents.map((d) => (
                      <li key={d.id} className="py-2 text-sm">
                        <p className="font-medium text-slate-700">{d.name}</p>
                        <p className="text-xs text-slate-400">{formatDate(d.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Journal de chantier */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-green-500" />
                  <h2 className="font-semibold text-slate-800">Journal de chantier</h2>
                </div>
                {data.recent_logs.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucune entrée récente</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.recent_logs.map((l) => (
                      <li key={l.id} className="py-2 text-sm">
                        <p className="font-medium text-slate-700">{formatDate(l.log_date)}</p>
                        {l.summary && <p className="text-xs text-slate-500 line-clamp-2">{l.summary}</p>}
                        {l.weather && <p className="text-xs text-slate-400">{l.weather}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <p className="text-center text-xs text-slate-400">
              Ce portail est en lecture seule. Pour toute question, contactez votre chef de projet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
