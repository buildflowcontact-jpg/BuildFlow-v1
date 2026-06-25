import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type * as OBC from '@thatopen/components';
import { RotateCcw, Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner } from '@/components/ui/Spinner';

interface IfcViewerProps {
  fileUrl: string;
  /** Appelé avec le PNG (dataURL) du canvas rendu quand l'utilisateur clique sur "Capturer". */
  onCapture?: (dataUrl: string) => void;
}

/**
 * Viewer 3D pour les fichiers IFC, basé sur le moteur @thatopen/components
 * (successeur maintenu de web-ifc-viewer) + web-ifc + three.js.
 *
 * Le binaire web-ifc (.wasm) et le worker de @thatopen/fragments sont servis
 * localement depuis /public (voir public/wasm et public/fragments-worker.mjs)
 * pour éviter toute dépendance réseau vers unpkg.com au runtime.
 */
export function IfcViewer({ fileUrl, onCapture }: IfcViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);
  const resetRef = useRef<() => void>(() => {});
  const captureRef = useRef<() => string | null>(() => null);

  useEffect(() => {
    let disposed = false;
    let componentsInstance: { dispose: () => void } | null = null;

    async function init() {
      const container = containerRef.current;
      if (!container) return;
      setStatus('loading');
      setProgress(0);

      const OBC = await import('@thatopen/components');

      const components = new OBC.Components();
      componentsInstance = components;

      const worlds = components.get(OBC.Worlds);
      const world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();

      world.scene = new OBC.SimpleScene(components);
      world.scene.setup();
      world.scene.three.background = null;

      world.renderer = new OBC.SimpleRenderer(components, container, { preserveDrawingBuffer: true });
      world.camera = new OBC.OrthoPerspectiveCamera(components);

      components.init();
      components.get(OBC.Grids).create(world);

      resetRef.current = () => {
        void world.camera.controls.setLookAt(15, 15, 15, 0, 0, 0);
      };
      captureRef.current = () => {
        try {
          world.renderer!.three.render(world.scene.three, world.camera.three);
          return world.renderer!.three.domElement.toDataURL('image/png');
        } catch (err) {
          console.error('Échec de la capture du viewer 3D', err);
          return null;
        }
      };
      await world.camera.controls.setLookAt(15, 15, 15, 0, 0, 0);

      const ifcLoader = components.get(OBC.IfcLoader);
      await ifcLoader.setup({
        autoSetWasm: false,
        wasm: { path: '/wasm/', absolute: true },
      });

      const fragments = components.get(OBC.FragmentsManager);
      fragments.init('/fragments-worker.mjs');

      world.camera.controls.addEventListener('update', () => fragments.core.update());

      fragments.list.onItemSet.add(({ value: model }) => {
        model.useCamera(world.camera.three);
        world.scene.three.add(model.object as unknown as THREE.Object3D);
        fragments.core.update(true);
        if (!disposed) setStatus('ready');
      });

      fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
        const mat = material as unknown as { isLodMaterial?: boolean; polygonOffset?: boolean; polygonOffsetUnits?: number; polygonOffsetFactor?: number };
        if (!mat.isLodMaterial) {
          mat.polygonOffset = true;
          mat.polygonOffsetUnits = 1;
          mat.polygonOffsetFactor = Math.random();
        }
      });

      const response = await fetch(fileUrl);
      const data = await response.arrayBuffer();
      if (disposed) return;
      const buffer = new Uint8Array(data);

      await ifcLoader.load(buffer, true, 'model3d', {
        processData: {
          progressCallback: (p: number) => {
            if (!disposed) setProgress(Math.round(p * 100));
          },
        },
      });
    }

    init().catch((err) => {
      console.error('Erreur de chargement IFC', err);
      if (!disposed) setStatus('error');
    });

    return () => {
      disposed = true;
      componentsInstance?.dispose();
    };
  }, [fileUrl]);

  return (
    <div className="relative h-[65vh] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
      <div ref={containerRef} className="absolute inset-0" />

      {status !== 'error' && (
        <div className="absolute right-3 top-3 z-10 flex gap-2">
          {onCapture && (
            <Button
              size="sm"
              variant="outline"
              disabled={status !== 'ready'}
              onClick={() => {
                const dataUrl = captureRef.current();
                if (dataUrl) onCapture(dataUrl);
              }}
              className="bg-white/90"
            >
              <Camera className="h-4 w-4" />
              Capturer
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => resetRef.current()} className="bg-white/90">
            <RotateCcw className="h-4 w-4" />
            Recentrer
          </Button>
        </div>
      )}

      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-900/80 text-white">
          <FullPageSpinner />
          <p className="text-xs text-slate-300">Conversion et chargement de la maquette… {progress > 0 && `${progress}%`}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/80 px-6 text-center text-sm text-red-300">
          Impossible de charger cette maquette IFC. Le fichier est peut-être corrompu ou trop volumineux.
        </div>
      )}
    </div>
  );
}
