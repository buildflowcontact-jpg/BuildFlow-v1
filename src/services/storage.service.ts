import { supabase } from '@/lib/supabaseClient';

export type StorageBucket = 'documents' | 'plans' | 'models3d' | 'avatars';

function sanitizeFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  const ext = lastDot >= 0 ? fileName.slice(lastDot) : '';
  const diacriticsPattern = new RegExp('[\\u0300-\\u036f]', 'g');
  const base = (lastDot >= 0 ? fileName.slice(0, lastDot) : fileName)
    .normalize('NFD')
    .replace(diacriticsPattern, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .toLowerCase();
  return `${Date.now()}-${base}${ext}`;
}

export const storageService = {
  buildPath(folderId: string, fileName: string): string {
    return `${folderId}/${sanitizeFileName(fileName)}`;
  },

  async upload(bucket: StorageBucket, path: string, file: File): Promise<string> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    return path;
  },

  async remove(bucket: StorageBucket, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  },

  async getSignedUrl(bucket: StorageBucket, path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  },

  getPublicUrl(bucket: StorageBucket, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  async download(bucket: StorageBucket, path: string): Promise<Blob> {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) throw error;
    return data;
  },
};
