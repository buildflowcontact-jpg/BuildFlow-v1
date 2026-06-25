import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Pencil, Type, MapPin, Undo2, Trash2, Loader2, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import type { CaptureAnnotationShape } from '@/types/domain';

type Tool = 'pen' | 'text' | 'pin';

const COLORS: [string, string, string, string, string] = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#0f172a'];

interface CaptureEditorProps {
  open: boolean;
  onClose: () => void;
  /** Image source (data URL ou URL signée) sur laquelle dessiner. */
  imageUrl: string;
  initialAnnotations?: CaptureAnnotationShape[];
  saving?: boolean;
  /** dataUrl = capture aplatie (image + annotations), shapes = données structurées à conserver. */
  onSave: (dataUrl: string, shapes: CaptureAnnotationShape[]) => void;
}

/**
 * Éditeur d'annotation partagé entre la maquette 3D (IfcViewer) et les plans
 * 2D (PlanViewer) : dessin libre, texte positionné, pins commentés. Les
 * coordonnées des formes sont normalisées (0-1) par rapport à l'image source
 * pour rester valables indépendamment du zoom d'affichage.
 */
export function CaptureEditor({ open, onClose, imageUrl, initialAnnotations, saving, onSave }: CaptureEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageReady, setImageReady] = useState(false);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [shapes, setShapes] = useState<CaptureAnnotationShape[]>(initialAnnotations ?? []);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [pendingValue, setPendingValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setShapes(initialAnnotations ?? []);
    setCurrentStroke(null);
    setPendingPoint(null);
    setPendingValue('');
    setImageReady(false);

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageReady(true);
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, imageUrl]);

  useEffect(() => {
    if (!imageReady) return;
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageReady, shapes, currentStroke]);

  function draw() {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const shape of shapes) drawShape(ctx, canvas, shape);
    if (currentStroke && currentStroke.length > 1) {
      drawShape(ctx, canvas, { type: 'stroke', points: currentStroke, color, width: 4 });
    }
  }

  function drawShape(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, shape: CaptureAnnotationShape) {
    if (shape.type === 'stroke') {
      if (shape.points.length < 2) return;
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const [first, ...rest] = shape.points;
      if (!first) return;
      ctx.beginPath();
      ctx.moveTo(first.x * canvas.width, first.y * canvas.height);
      for (const point of rest) ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
      ctx.stroke();
    } else if (shape.type === 'text') {
      const fontSize = Math.max(16, canvas.width * 0.018);
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.fillStyle = shape.color;
      ctx.textBaseline = 'top';
      ctx.fillText(shape.text, shape.x * canvas.width, shape.y * canvas.height);
    } else if (shape.type === 'pin') {
      const x = shape.x * canvas.width;
      const y = shape.y * canvas.height;
      const radius = Math.max(8, canvas.width * 0.01);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = shape.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }

  function pointFromEvent(e: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const point = pointFromEvent(e);
    if (tool === 'pen') {
      setCurrentStroke([point]);
    } else if (tool === 'text' || tool === 'pin') {
      setPendingPoint(point);
      setPendingValue('');
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (tool !== 'pen' || !currentStroke) return;
    setCurrentStroke([...currentStroke, pointFromEvent(e)]);
  }

  function handlePointerUp() {
    if (tool === 'pen' && currentStroke && currentStroke.length > 1) {
      setShapes((prev) => [...prev, { type: 'stroke', points: currentStroke, color, width: 4 }]);
    }
    setCurrentStroke(null);
  }

  function commitPending() {
    if (!pendingPoint || !pendingValue.trim()) {
      setPendingPoint(null);
      return;
    }
    if (tool === 'text') {
      setShapes((prev) => [...prev, { type: 'text', x: pendingPoint.x, y: pendingPoint.y, text: pendingValue.trim(), color }]);
    } else if (tool === 'pin') {
      setShapes((prev) => [...prev, { type: 'pin', x: pendingPoint.x, y: pendingPoint.y, comment: pendingValue.trim(), color }]);
    }
    setPendingPoint(null);
    setPendingValue('');
  }

  function handleUndo() {
    setShapes((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setShapes([]);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'), shapes);
  }

  return (
    <Modal open={open} onClose={onClose} title="Annoter la capture" size="xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ToolButton icon={Pencil} label="Dessin libre" active={tool === 'pen'} onClick={() => setTool('pen')} />
          <ToolButton icon={Type} label="Texte" active={tool === 'text'} onClick={() => setTool('text')} />
          <ToolButton icon={MapPin} label="Pin" active={tool === 'pin'} onClick={() => setTool('pin')} />

          <div className="mx-1 h-6 w-px bg-slate-200" />

          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              onClick={() => setColor(c)}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform',
                color === c ? 'scale-110 border-slate-900' : 'border-white'
              )}
              style={{ backgroundColor: c }}
            />
          ))}

          <div className="mx-1 h-6 w-px bg-slate-200" />

          <Button type="button" variant="ghost" size="sm" onClick={handleUndo} disabled={shapes.length === 0}>
            <Undo2 className="h-4 w-4" />
            Annuler
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={shapes.length === 0}>
            <Trash2 className="h-4 w-4" />
            Tout effacer
          </Button>
        </div>

        <div className="relative mx-auto max-h-[60vh] w-full overflow-auto rounded-xl border border-slate-200 bg-slate-50">
          {!imageReady && (
            <div className="flex h-64 items-center justify-center text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            className={cn('block w-full touch-none', !imageReady && 'hidden', tool === 'pen' ? 'cursor-crosshair' : 'cursor-pointer')}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          {pendingPoint && (
            <div
              className="absolute z-10 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-popover"
              style={{ left: `${pendingPoint.x * 100}%`, top: `${pendingPoint.y * 100}%` }}
            >
              <textarea
                autoFocus
                value={pendingValue}
                onChange={(e) => setPendingValue(e.target.value)}
                placeholder={tool === 'pin' ? 'Commentaire du pin…' : 'Texte à afficher…'}
                rows={2}
                className="w-full resize-none rounded-md border border-slate-200 p-1.5 text-sm focus:border-brand-400 focus:outline-none"
              />
              <div className="mt-1.5 flex justify-end gap-1.5">
                <Button type="button" variant="ghost" size="sm" onClick={() => setPendingPoint(null)}>
                  Annuler
                </Button>
                <Button type="button" variant="primary" size="sm" onClick={commitPending}>
                  <Check className="h-3.5 w-3.5" />
                  Valider
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} loading={saving} disabled={!imageReady}>
            Enregistrer le brouillon
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
        active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
