import { useEffect, useState } from 'react';
import { Camera, FileText, Trash2, Pencil, Send, Download, Box, Map } from 'lucide-react';
import { useCaptures, useCaptureReports } from '@/hooks/useCaptures';
import { useProject } from '@/hooks/useProject';
import { useAuthStore } from '@/stores/authStore';
import { capturesService } from '@/services/captures.service';
import { CaptureEditor } from '@/components/captures/CaptureEditor';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/utils/date';
import { cn } from '@/utils/cn';
import type { AnnotatedCapture, CaptureAnnotationShape, CaptureReport } from '@/types/domain';

interface CapturesPanelProps {
  projectId: string;
}

/**
 * Panneau "Mes captures" : regroupe les brouillons de captures annotées de
 * l'utilisateur courant, qu'elles viennent du plan 2D ou de la maquette 3D
 * (distingués par `source_type`), avec la possibilité de les envoyer
 * regroupées sous forme d'un rapport PDF. Liste aussi l'historique des
 * rapports déjà envoyés sur ce projet.
 */
export function CapturesPanel({ projectId }: CapturesPanelProps) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { drafts, isLoading, remove, update, sendReport } = useCaptures(projectId, userId);
  const { reports, isLoading: reportsLoading } = useCaptureReports(projectId);
  const { project, members } = useProject(projectId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingCapture, setEditingCapture] = useState<AnnotatedCapture | null>(null);
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openEditor(capture: AnnotatedCapture) {
    const url = await capturesService.getImageUrl(capture);
    setEditingCapture(capture);
    setEditingUrl(url);
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Mes captures</h3>
            <p className="text-sm text-slate-500">{drafts.length} brouillon(s) en attente d'envoi</p>
          </div>
          <Button size="sm" onClick={() => setSendOpen(true)} disabled={selected.size === 0}>
            <Send className="h-4 w-4" />
            Envoyer comme rapport ({selected.size})
          </Button>
        </div>

        {drafts.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="Aucun brouillon"
            description="Capturez une vue depuis le plan 2D ou la maquette 3D pour commencer une annotation."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {drafts.map((capture) => (
              <li key={capture.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(capture.id)}
                    onChange={() => toggle(capture.id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <DraftThumbnail capture={capture} />
                  <div>
                    <p className="font-medium text-slate-800">{capture.source_label}</p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-400">
                      {capture.source_type === 'model3d' ? <Box className="h-3 w-3" /> : <Map className="h-3 w-3" />}
                      {formatDateTime(capture.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditor(capture)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                    title="Modifier l'annotation"
                    aria-label="Modifier l'annotation"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Supprimer ce brouillon de capture ?')) remove.mutate(capture);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                    title="Supprimer"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Rapports envoyés</h3>
        {reportsLoading ? (
          <FullPageSpinner />
        ) : reports.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun rapport envoyé pour le moment.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reports.map((report) => <ReportRow key={report.id} report={report} />)}
          </ul>
        )}
      </Card>

      {editingCapture && editingUrl && (
        <CaptureEditor
          open
          onClose={() => {
            setEditingCapture(null);
            setEditingUrl(null);
          }}
          imageUrl={editingUrl}
          initialAnnotations={(editingCapture.annotations as unknown as CaptureAnnotationShape[]) ?? []}
          saving={update.isPending}
          onSave={(dataUrl, shapes) => {
            update.mutate(
              { capture: editingCapture, dataUrl, annotations: shapes },
              {
                onSuccess: () => {
                  setEditingCapture(null);
                  setEditingUrl(null);
                },
              }
            );
          }}
        />
      )}

      <SendCaptureReportModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        project={project}
        members={members}
        captures={drafts.filter((c) => selected.has(c.id))}
        sendReport={sendReport}
        onSent={() => setSelected(new Set())}
      />
    </div>
  );
}

function DraftThumbnail({ capture }: { capture: AnnotatedCapture }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void capturesService.getImageUrl(capture).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [capture]);

  return (
    <div className="flex h-10 w-14 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Camera className="h-4 w-4 text-slate-300" />}
    </div>
  );
}

function ReportRow({ report }: { report: CaptureReport }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = await capturesService.getReportPdfUrl(report);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <li className="flex items-center justify-between py-3 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <FileText className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium text-slate-800">{report.title}</p>
          <p className="text-xs text-slate-400">
            {report.sent_at && `Envoyé le ${formatDateTime(report.sent_at)}`}
            {Array.isArray(report.sent_to) && report.sent_to.length > 0 && ` à ${(report.sent_to as string[]).join(', ')}`}
          </p>
        </div>
      </div>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        title="Télécharger le PDF"
        aria-label="Télécharger le PDF"
      >
        <Download className="h-4 w-4" />
      </button>
    </li>
  );
}

function SendCaptureReportModal({
  open,
  onClose,
  project,
  members,
  captures,
  sendReport,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  project: ReturnType<typeof useProject>['project'];
  members: ReturnType<typeof useProject>['members'];
  captures: AnnotatedCapture[];
  sendReport: ReturnType<typeof useCaptures>['sendReport'];
  onSent: () => void;
}) {
  const [title, setTitle] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setTitle('');
      setSelectedRecipients(new Set());
    }
  }, [open]);

  const candidates = members.filter((m) => m.profile);

  function toggleRecipient(id: string) {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSend() {
    if (!project || !title.trim() || captures.length === 0) return;
    const recipients = candidates
      .filter((m) => selectedRecipients.has(m.profile!.id))
      .map((m) => ({ id: m.profile!.id, label: m.profile!.full_name ?? m.profile!.email ?? 'Utilisateur' }));
    sendReport.mutate(
      { project, title: title.trim(), captures, recipients },
      { onSuccess: () => { onClose(); onSent(); } }
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Envoyer comme rapport">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-500">{captures.length} capture(s) sélectionnée(s).</p>
        <Input label="Titre du rapport" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Réserves visite du 12/06" />

        {candidates.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun membre disponible sur ce projet.</p>
        ) : (
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {candidates.map((m) => {
              const id = m.profile!.id;
              const checked = selectedRecipients.has(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggleRecipient(id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150',
                      checked ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleRecipient(id)} className="h-4 w-4 accent-brand-600" />
                    <span className="font-medium text-slate-800">{m.profile!.full_name ?? m.profile!.email}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSend} loading={sendReport.isPending} disabled={!title.trim() || captures.length === 0}>
            <Send className="h-4 w-4" />
            Envoyer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
