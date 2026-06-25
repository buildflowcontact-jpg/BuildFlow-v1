import { useRef, useState, useEffect, type PointerEvent as ReactPointerEvent } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/utils/cn';

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  className?: string;
}

/**
 * Pavé de signature électronique simple (canvas + pointer events).
 * Produit un PNG en data URL transmis au parent ; vide => null.
 */
export function SignaturePad({ onChange, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  function getPos(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (isEmpty) setIsEmpty(false);
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(isEmpty ? null : canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange(null);
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-crosshair touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {isEmpty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Signez ici
          </p>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={clear} className="self-start">
        <Eraser className="h-3.5 w-3.5" />
        Effacer
      </Button>
    </div>
  );
}
