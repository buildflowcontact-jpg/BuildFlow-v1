import { useRef, useState } from 'react';
import { Box, Upload, Download, Trash2, Lock, Eye } from 'lucide-react';
import { useModels3d } from '@/hooks/useModels3d';
import { useCaptures } from '@/hooks/useCaptures';
import { useProject } from '@/hooks/useProject';
import { useMyProjectAccess } from '@/hooks/useMyProjectAccess';
import { models3dService } from '@/services/models3d.service';
import { CaptureEditor } from '@/components/captures/CaptureEditor';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/utils/date';
import { IfcViewer } from './IfcViewer';
import type { Model3D } from '@/types/domain';
import { confirmStore } from '@/components/ui/ConfirmModal';

interface Models3dTabProps {
  projectId: string;
}

export function Models3dTab({ projectId }: Models3dTabProps) {
  const { models, isLoading, upload, remove } = useModels3d(projectId);
  const { members } = useProject(projectId);
  const { canManage } = useMyProjectAccess(members);
  const userId = useAuthStore((s) => s.session?.user.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewerModel, setViewerModel] = useState<Model3D | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [captureDataUrl, setCaptureDataUrl] = useState<string | null>(null);
  const { create: createCapture } = useCaptures(projectId, userId);

  async function handlePreview(model: Model3D) {
    setViewerModel(model);
    setViewerUrl(null);
    const url = await models3dService.getDownloadUrl(model);
    setViewerUrl(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (!file.name.toLowerCase().endsWith('.ifc')) {
      alert('Seuls les fichiers .ifc sont acceptés pour les maquettes 3D.');
      e.target.value = '';
      return;
    }
    upload.mutate({ file, uploadedBy: userId });
    e.target.value = '';
  }

  async function handleDownload(model: (typeof models)[number]) {
    setDownloadingId(model.id);
    try {
      const url = await models3dService.getDownloadUrl(model);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Maquettes 3D</h3>
          <p className="text-sm text-slate-500">{models.length} maquette(s)</p>
        </div>
        <input ref={fileInputRef} type="file" accept=".ifc" className="hidden" onChange={handleFileChange} />
        <Button size="sm" onClick={() => fileInputRef.current?.click()} loading={upload.isPending}>
          <Upload className="h-4 w-4" />
          Déposer une maquette
        </Button>
      </div>

      {models.length === 0 ? (
        <EmptyState
          icon={Box}
          title="Aucune maquette 3D"
          description="Déposez vos fichiers de maquette (la visualisation avancée pourra être ajoutée ultérieurement)."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {models.map((model) => (
            <li key={model.id} className="flex items-center justify-between py-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Box className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{model.name}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(model.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {model.format && <Badge tone="slate">{model.format.toUpperCase()}</Badge>}
                {model.format?.toLowerCase() === 'ifc' && (
                  <button
                    onClick={() => handlePreview(model)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                    title="Aperçu 3D"
                    aria-label="Aperçu 3D"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDownload(model)}
                  disabled={downloadingId === model.id}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  title="Télécharger"
                  aria-label="Télécharger"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (!canManage) return;
                    confirmStore.getState().show({ message: `Supprimer "${model.name}" ?` }).then((ok) => { if (ok) remove.mutate(model); });
                  }}
                  disabled={!canManage}
                  title={canManage ? 'Supprimer' : 'Droits insuffisants pour supprimer cette maquette'}
                  aria-label={canManage ? 'Supprimer' : 'Droits insuffisants pour supprimer cette maquette'}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  {canManage ? <Trash2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(viewerModel)} onClose={() => setViewerModel(null)} title={`Aperçu 3D — ${viewerModel?.name ?? ''}`} size="xl">
        {viewerUrl ? <IfcViewer fileUrl={viewerUrl} onCapture={setCaptureDataUrl} /> : <FullPageSpinner />}
      </Modal>

      <CaptureEditor
        open={Boolean(captureDataUrl)}
        onClose={() => setCaptureDataUrl(null)}
        imageUrl={captureDataUrl ?? ''}
        saving={createCapture.isPending}
        onSave={(dataUrl, shapes) => {
          if (!viewerModel) return;
          createCapture.mutate(
            { sourceType: 'model3d', sourceId: viewerModel.id, sourceLabel: viewerModel.name, dataUrl, annotations: shapes },
            { onSuccess: () => setCaptureDataUrl(null) }
          );
        }}
      />
    </Card>
  );
}
