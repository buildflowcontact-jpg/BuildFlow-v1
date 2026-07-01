import { useRef, useState } from 'react';
import { Plus, HelpCircle, Trash2, MessageSquareReply, CheckCircle, Paperclip, FileText, Download, X } from 'lucide-react';
import { confirmStore } from '@/components/ui/ConfirmModal';
import { useRfis } from '@/hooks/useRfis';
import { useProject } from '@/hooks/useProject';
import { useAuthStore } from '@/stores/authStore';
import { useResourceAttachments } from '@/hooks/useResourceAttachments';
import { documentsService } from '@/services/documents.service';
import { storageService } from '@/services/storage.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { RFI_STATUS_LABELS } from '@/types/domain';
import { formatDate, formatDateTime } from '@/utils/date';
import { toast } from '@/stores/toastStore';
import type { Rfi } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';

const STATUS_TONE: Record<Rfi['status'], 'red' | 'blue' | 'slate'> = {
  open: 'red',
  answered: 'blue',
  closed: 'slate',
};

type RfiFormState = {
  title: string;
  question: string;
  assigned_to: string;
  due_date: string;
};

function emptyForm(): RfiFormState {
  return { title: '', question: '', assigned_to: '', due_date: '' };
}

// ── Sous-composant : pièces jointes d'une RFI ────────────────────────────────

function RfiAttachments({ rfiId, projectId }: { rfiId: string; projectId: string }) {
  const { attachments, attach, detach } = useResourceAttachments('rfi', rfiId);
  const userId = useAuthStore((s) => s.session?.user.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    try {
      const doc = await documentsService.upload({
        projectId,
        file,
        type: 'autre',
        uploadedBy: userId,
        silent: true,
      });
      await attach.mutateAsync({ document_id: doc.id });
      toast.success('Pièce jointe ajoutée');
    } catch {
      toast.error("Erreur lors de l'ajout de la pièce jointe");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDownload(storagePath: string, filename: string) {
    try {
      const url = await storageService.getSignedUrl('documents', storagePath, 3600);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } catch {
      toast.error('Téléchargement impossible');
    }
  }

  return (
    <div className="mt-2.5 border-t border-slate-100 pt-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">
          Pièces jointes ({attachments.length})
        </p>
        <div className="flex items-center gap-1.5">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50"
          >
            <Paperclip className="h-3 w-3" />
            {uploading ? 'Envoi…' : 'Ajouter'}
          </button>
        </div>
      </div>
      {attachments.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="flex-1 truncate text-slate-700">
                {att.document?.name ?? 'Fichier'}
              </span>
              {att.document?.storage_path && (
                <button
                  onClick={() => handleDownload(att.document!.storage_path, att.document!.name)}
                  title="Télécharger"
                  aria-label="Télécharger"
                  className="text-slate-400 hover:text-brand-600"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() =>
                  confirmStore.getState().show({ message: 'Retirer cette pièce jointe ?' }).then((ok) => {
                    if (ok) detach.mutate(att.id);
                  })
                }
                title="Supprimer"
                aria-label="Supprimer"
                className="text-slate-400 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

interface RfisTabProps {
  projectId: string;
}

export function RfisTab({ projectId }: RfisTabProps) {
  const { rfis, isLoading, create, respond, close, remove } = useRfis(projectId);
  const { members } = useProject(projectId);
  const userId = useAuthStore((s) => s.session?.user.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RfiFormState>(emptyForm());

  const [respondTarget, setRespondTarget] = useState<Rfi | null>(null);
  const [responseText, setResponseText] = useState('');

  // RFI dont on affiche les pièces jointes (expandé)
  const [expandedRfiId, setExpandedRfiId] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm());
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'rfis'>, 'project_id' | 'number'> & { number: number } = {
      number: null as unknown as number,
      title: form.title,
      question: form.question,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      raised_by: userId ?? null,
    };
    create.mutate(payload, { onSuccess: () => setModalOpen(false) });
  }

  function openRespond(rfi: Rfi) {
    setRespondTarget(rfi);
    setResponseText(rfi.response ?? '');
  }

  function handleRespondSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!respondTarget) return;
    respond.mutate(
      { id: respondTarget.id, response: responseText },
      { onSuccess: () => setRespondTarget(null) }
    );
  }

  function assigneeName(id: string | null) {
    if (!id) return null;
    const member = members.find((m) => m.profile?.id === id);
    return member?.profile?.full_name ?? member?.profile?.email ?? null;
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Demandes d'information (RFI)</h3>
          <p className="text-sm text-slate-500">{rfis.length} demande(s)</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle RFI
        </Button>
      </div>

      {rfis.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="Aucune RFI"
          description="Posez vos questions techniques et suivez les réponses."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rfis.map((rfi) => {
            const isExpanded = expandedRfiId === rfi.id;
            return (
              <li key={rfi.id} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setExpandedRfiId(isExpanded ? null : rfi.id)}
                      className="group flex items-center gap-1.5 text-left"
                    >
                      <p className="font-medium text-slate-800 group-hover:text-brand-700">
                        RFI #{rfi.number} — {rfi.title}
                      </p>
                      <Paperclip className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-500" />
                    </button>
                    <p className="mt-0.5 text-slate-600">{rfi.question}</p>
                    {rfi.response && (
                      <p className="mt-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">Réponse : </span>
                        {rfi.response}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                      {assigneeName(rfi.assigned_to) && (
                        <span>Assigné à {assigneeName(rfi.assigned_to)}</span>
                      )}
                      {rfi.due_date && <span>Échéance {formatDate(rfi.due_date)}</span>}
                      <span>{formatDateTime(rfi.created_at)}</span>
                    </div>
                    {/* Pièces jointes (expandées au clic sur le titre) */}
                    {isExpanded && (
                      <RfiAttachments rfiId={rfi.id} projectId={projectId} />
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={STATUS_TONE[rfi.status]}>{RFI_STATUS_LABELS[rfi.status]}</Badge>
                    {rfi.status !== 'closed' && (
                      <button
                        onClick={() => openRespond(rfi)}
                        title="Répondre"
                        aria-label="Répondre"
                        className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <MessageSquareReply className="h-4 w-4" />
                      </button>
                    )}
                    {rfi.status === 'answered' && (
                      <button
                        onClick={() => close.mutate(rfi.id)}
                        title="Clôturer"
                        aria-label="Clôturer"
                        className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-green-50 hover:text-green-600"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        confirmStore
                          .getState()
                          .show({ message: 'Supprimer cette RFI ?' })
                          .then((ok) => {
                            if (ok) remove.mutate(rfi.id);
                          })
                      }
                      title="Supprimer"
                      aria-label="Supprimer"
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle RFI" size="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="form-title"
            label="Titre"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Textarea
            label="Question"
            required
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="form-assigned-to"
              label="Assigné à"
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            >
              <option value="">Non assigné</option>
              {members
                .filter((m) => m.profile)
                .map((m) => (
                  <option key={m.profile!.id} value={m.profile!.id}>
                    {m.profile!.full_name ?? m.profile!.email}
                  </option>
                ))}
            </Select>
            <Input
              id="form-due-date"
              type="date"
              label="Échéance"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Créer
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!respondTarget}
        onClose={() => setRespondTarget(null)}
        title={respondTarget ? `Répondre — RFI #${respondTarget.number}` : ''}
      >
        <form onSubmit={handleRespondSubmit} className="flex flex-col gap-4">
          <Textarea
            label="Réponse"
            required
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRespondTarget(null)}>
              Annuler
            </Button>
            <Button type="submit" loading={respond.isPending}>
              Envoyer la réponse
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
