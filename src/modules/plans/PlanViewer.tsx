import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  MessageSquarePlus,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Send,
  CheckCircle2,
  Circle,
  Camera,
} from 'lucide-react';
import { usePlanVersions, usePlanAnnotations } from '@/hooks/usePlans';
import { useCaptures } from '@/hooks/useCaptures';
import { CaptureEditor } from '@/components/captures/CaptureEditor';
import { plansService } from '@/services/plans.service';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import type { Plan, PlanVersion, ProjectMemberWithProfile } from '@/types/domain';
import { SendVersionModal } from './SendVersionModal';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface PlanViewerProps {
  plan: Plan;
  members: ProjectMemberWithProfile[];
  userId: string | undefined;
}

export function PlanViewer({ plan, members, userId }: PlanViewerProps) {
  const { data: versions, isLoading: versionsLoading } = usePlanVersions(plan.id);
  const latestVersion: PlanVersion | undefined = versions?.[0];
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinContent, setPinContent] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [sendOpen, setSendOpen] = useState(false);
  const [captureDataUrl, setCaptureDataUrl] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const { annotations, addAnnotation, setResolved } = usePlanAnnotations(latestVersion?.id);
  const { create: createCapture } = useCaptures(plan.project_id, userId);

  useEffect(() => {
    setFileUrl(null);
    setNumPages(0);
    setPageNumber(1);
    if (!latestVersion) return;
    let active = true;
    void plansService.getVersionUrl(latestVersion).then((url) => {
      if (active) setFileUrl(url);
    });
    return () => {
      active = false;
    };
  }, [latestVersion]);

  const pageAnnotations = useMemo(
    () => annotations.filter((a) => (a.page_number ?? 1) === pageNumber),
    [annotations, pageNumber]
  );

  if (versionsLoading) return <FullPageSpinner />;
  if (!latestVersion) return <p className="text-sm text-slate-400">Aucune version disponible.</p>;

  function memberName(uid: string | null) {
    if (!uid) return 'Utilisateur';
    const member = members.find((m) => m.profile?.id === uid);
    return member?.profile?.full_name ?? member?.profile?.email ?? 'Utilisateur';
  }

  function handleSurfaceClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!annotateMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPendingPin({ x, y });
    setPinContent('');
  }

  function submitPin() {
    if (!pendingPin || !pinContent.trim() || !userId) return;
    addAnnotation.mutate(
      { author_id: userId, x: pendingPin.x, y: pendingPin.y, content: pinContent.trim(), page_number: pageNumber },
      { onSuccess: () => setPendingPin(null) }
    );
  }

  function handleCapture() {
    const canvas = surfaceRef.current?.querySelector('canvas');
    if (!canvas) return;
    setCaptureDataUrl(canvas.toDataURL('image/png'));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-400">Version {latestVersion.version}</p>
          {numPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-500">
                Page {pageNumber} / {numPages}
              </span>
              <button
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Zoom -"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-500">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Zoom +"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleCapture} disabled={!fileUrl}>
            <Camera className="h-4 w-4" />
            Capturer
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" />
            Envoyer
          </Button>
          <Button
            size="sm"
            variant={annotateMode ? 'primary' : 'outline'}
            onClick={() => {
              setAnnotateMode((v) => !v);
              setPendingPin(null);
            }}
          >
            <MessageSquarePlus className="h-4 w-4" />
            {annotateMode ? 'Mode annotation activé' : 'Annoter'}
          </Button>
        </div>
      </div>

      <div className="flex max-h-[65vh] flex-col items-center overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-3">
        <div
          ref={surfaceRef}
          onClick={handleSurfaceClick}
          className={cn('relative inline-block', annotateMode && 'cursor-crosshair')}
        >
          {fileUrl ? (
            <Document
              file={fileUrl}
              onLoadSuccess={(doc) => setNumPages(doc.numPages)}
              loading={<FullPageSpinner />}
              error={<p className="p-6 text-sm text-red-500">Impossible d'afficher ce PDF.</p>}
            >
              <Page pageNumber={pageNumber} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>
          ) : (
            <FullPageSpinner />
          )}

          {pageAnnotations.map((a) => (
            <div
              key={a.id}
              className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setResolved.mutate({ id: a.id, resolved: !a.resolved });
                }}
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ring-2 ring-white',
                  a.resolved ? 'bg-emerald-500' : 'bg-amber-500'
                )}
                title={a.resolved ? 'Résolue — cliquer pour réouvrir' : 'Non résolue — cliquer pour résoudre'}
              >
                {a.resolved ? <CheckCircle2 className="h-3.5 w-3.5" /> : '!'}
              </button>
              <div className="pointer-events-none absolute left-1/2 top-6 z-20 w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-700">{memberName(a.author_id)}</p>
                  {a.resolved ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Résolue
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Circle className="h-3 w-3" /> Ouverte
                    </span>
                  )}
                </div>
                <p className="text-slate-500">{a.content}</p>
              </div>
            </div>
          ))}

          {pendingPin && (
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-brand-300 bg-white p-2 shadow-lg"
              style={{ left: `${pendingPin.x * 100}%`, top: `${pendingPin.y * 100}%` }}
            >
              <div className="flex w-56 flex-col gap-2">
                <Textarea
                  autoFocus
                  rows={2}
                  value={pinContent}
                  onChange={(e) => setPinContent(e.target.value)}
                  placeholder="Commentaire…"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setPendingPin(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <Button size="sm" onClick={submitPin} loading={addAnnotation.isPending} disabled={!pinContent.trim()}>
                    Ajouter
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SendVersionModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        plan={plan}
        version={latestVersion}
        members={members}
        userId={userId}
      />

      <CaptureEditor
        open={Boolean(captureDataUrl)}
        onClose={() => setCaptureDataUrl(null)}
        imageUrl={captureDataUrl ?? ''}
        saving={createCapture.isPending}
        onSave={(dataUrl, shapes) => {
          createCapture.mutate(
            {
              sourceType: 'plan',
              sourceId: latestVersion.id,
              sourceLabel: `${plan.name} (v${latestVersion.version}, p.${pageNumber})`,
              dataUrl,
              annotations: shapes,
            },
            { onSuccess: () => setCaptureDataUrl(null) }
          );
        }}
      />
    </div>
  );
}
