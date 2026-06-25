import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Upload, Download, Trash2, Share2, Search, Lock, Folder } from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
import { useProject } from '@/hooks/useProject';
import { useDailyReports } from '@/hooks/useDailyReports';
import { useMyProjectAccess } from '@/hooks/useMyProjectAccess';
import { documentsService } from '@/services/documents.service';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ResourceSharingModal } from '@/components/sharing/ResourceSharingModal';
import { DOCUMENT_TYPE_LABELS } from '@/types/domain';
import type { DocumentType } from '@/types/database.types';
import type { Document } from '@/types/domain';
import { formatDateTime } from '@/utils/date';

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface DocumentsTabProps {
  projectId: string;
}

export function DocumentsTab({ projectId }: DocumentsTabProps) {
  const { documents, isLoading, upload, remove } = useDocuments(projectId);
  const { project, members } = useProject(projectId);
  const { canManage } = useMyProjectAccess(members);
  const userId = useAuthStore((s) => s.session?.user.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingType, setPendingType] = useState<DocumentType>('pdf');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingDoc, setSharingDoc] = useState<Document | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DocumentType | ''>('');
  const [filterFolder, setFilterFolder] = useState<string | ''>('');

  // Archivage automatique des rapports quotidiens générés par le cron mais
  // pas encore convertis en PDF (la génération du PDF se fait côté front).
  const { reports: dailyReports, archive: archiveDailyReport } = useDailyReports(projectId);
  useEffect(() => {
    if (!project || !userId) return;
    const pending = dailyReports.filter((r) => !r.document_id);
    for (const report of pending) {
      if (archiveDailyReport.isPending) break;
      archiveDailyReport.mutate({ report, project, uploadedBy: userId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyReports, project, userId]);

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents) if (doc.folder) set.add(doc.folder);
    return Array.from(set).sort();
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesQuery = !query || doc.name.toLowerCase().includes(query);
      const matchesType = !filterType || doc.type === filterType;
      const matchesFolder = !filterFolder || doc.folder === filterFolder;
      return matchesQuery && matchesType && matchesFolder;
    });
  }, [documents, search, filterType, filterFolder]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    upload.mutate({ file, type: pendingType, uploadedBy: userId });
    e.target.value = '';
  }

  async function handleDownload(doc: (typeof documents)[number]) {
    setDownloadingId(doc.id);
    try {
      const url = await documentsService.getDownloadUrl(doc);
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
          <h3 className="text-base font-semibold text-slate-900">Documents</h3>
          <p className="text-sm text-slate-500">{documents.length} document(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={pendingType} onChange={(e) => setPendingType(e.target.value as DocumentType)} className="h-9 w-40 text-xs">
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} loading={upload.isPending}>
            <Upload className="h-4 w-4" />
            Déposer un fichier
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un document…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as DocumentType | '')}
          className="h-10 w-44 text-sm"
        >
          <option value="">Tous les types</option>
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {folders.length > 0 && (
          <Select value={filterFolder} onChange={(e) => setFilterFolder(e.target.value)} className="h-10 w-48 text-sm">
            <option value="">Tous les dossiers</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </Select>
        )}
      </div>

      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun document" description="Déposez vos plans, PDF, photos ou comptes-rendus." />
      ) : filteredDocuments.length === 0 ? (
        <EmptyState icon={Search} title="Aucun résultat" description="Aucun document ne correspond à votre recherche." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {filteredDocuments.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between py-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{doc.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatSize(doc.size_bytes)} · {formatDateTime(doc.created_at)}
                    {doc.folder && (
                      <>
                        {' · '}
                        <Folder className="inline h-3 w-3 -translate-y-px" /> {doc.folder}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="blue">{DOCUMENT_TYPE_LABELS[doc.type]}</Badge>
                <button
                  onClick={() => setSharingDoc(doc)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                  title="Partager"
                  aria-label="Partager"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  title="Télécharger"
                  aria-label="Télécharger"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (!canManage) return;
                    if (confirm(`Supprimer le document "${doc.name}" ?`)) remove.mutate(doc);
                  }}
                  disabled={!canManage}
                  title={canManage ? 'Supprimer' : 'Droits insuffisants pour supprimer ce document'}
                  aria-label={canManage ? 'Supprimer' : 'Droits insuffisants pour supprimer ce document'}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  {canManage ? <Trash2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ResourceSharingModal
        open={Boolean(sharingDoc)}
        onClose={() => setSharingDoc(null)}
        resourceType="document"
        resourceId={sharingDoc?.id}
        resourceLabel={sharingDoc?.name ?? ''}
        projectId={projectId}
        members={members}
      />
    </Card>
  );
}
   