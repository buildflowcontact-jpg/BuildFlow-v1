import { useEffect, useRef, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { documentsService } from '@/services/documents.service';
import { storageService } from '@/services/storage.service';

interface PhotoUploadFieldProps {
  projectId: string;
  uploadedBy: string;
  /** ID du document existant (mode édition). */
  existingDocumentId?: string | null;
  onChange: (documentId: string | null) => void;
}

/**
 * Champ d'upload photo réutilisable.
 * - Upload immédiat à la sélection (pas d'attente du submit).
 * - Prévisualisation inline après upload ou en mode édition.
 * - Bouton de suppression qui déslie la photo sans supprimer le fichier storage.
 */
export function PhotoUploadField({ projectId, uploadedBy, existingDocumentId, onChange }: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger l'URL signée de la photo existante en mode édition.
  useEffect(() => {
    if (!existingDocumentId) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('documents')
      .select('storage_path')
      .eq('id', existingDocumentId)
      .single()
      .then(async ({ data }) => {
        if (cancelled || !data) return;
        try {
          const url = await storageService.getSignedUrl('documents', data.storage_path, 3600);
          if (!cancelled) setPreviewUrl(url);
        } catch {
          // Non bloquant : la preview ne s'affiche pas si l'URL échoue.
        }
      });
    return () => { cancelled = true; };
  }, [existingDocumentId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation légère côté client.
    if (!file.type.startsWith('image/')) {
      setError('Fichier non supporté. Sélectionnez une image (JPG, PNG, HEIC…).');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Image trop volumineuse (max 20 Mo).');
      return;
    }

    setError(null);
    setUploading(true);

    // Preview locale immédiate pendant l'upload.
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    try {
      const doc = await documentsService.upload({
        projectId,
        file,
        type: 'photo',
        uploadedBy,
        silent: true,
      });
      onChange(doc.id);
    } catch (err) {
      setPreviewUrl(null);
      setError('Erreur lors de l\'upload. Réessayez.');
      onChange(null);
      console.error('PhotoUploadField upload error', err);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
      // Réinitialiser l'input pour permettre de re-sélectionner le même fichier.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleRemove() {
    setPreviewUrl(null);
    setError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">Photo</span>

      {previewUrl ? (
        <div className="relative w-full overflow-hidden rounded-xl border border-slate-200">
          <img
            src={previewUrl}
            alt="Photo de l'élément"
            className="h-48 w-full object-cover"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/60 text-white transition-colors hover:bg-red-600"
              aria-label="Supprimer la photo"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-32 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-400 transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Camera className="h-5 w-5" />
              Ajouter une photo
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
