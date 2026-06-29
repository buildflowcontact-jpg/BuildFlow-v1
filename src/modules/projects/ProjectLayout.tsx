import { useRef, useState, useEffect, useMemo } from 'react';
import { Outlet, useParams, useLocation } from 'react-router-dom';
import { FileDown, ChevronDown, FileSpreadsheet, FileArchive, Columns2, X, MapPin } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { PROJECT_SECTIONS } from '@/modules/projects/projectSections';
import { ProjectSplitView } from '@/modules/projects/ProjectSplitView';
import { usePhases } from '@/hooks/usePhases';
import { useTasks } from '@/hooks/useTasks';
import { useSupplies } from '@/hooks/useSupplies';
import { usePunchList } from '@/hooks/usePunchList';
import { useDocuments } from '@/hooks/useDocuments';
import { usePlans } from '@/hooks/usePlans';
import { useModels3d } from '@/hooks/useModels3d';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { FullPageSpinner } from '@/components/ui/Spinner';
import {
  PROJECT_STATUS_LABELS,
  PORTAL_WIDGET_LABELS,
  DEFAULT_PORTAL_WIDGETS,
  parsePortalWidgets,
  type PortalWidgetsConfig,
} from '@/types/domain';
import { useClients } from '@/hooks/useClients';
import type { ProjectStatus, Json } from '@/types/database.types';

export interface ProjectOutletContext {
  projectId: string;
  project: NonNullable<ReturnType<typeof useProject>['project']>;
  phases: ReturnType<typeof usePhases>['phases'];
  phasesLoading: boolean;
  members: ReturnType<typeof useProject>['members'];
  membersLoading: boolean;
  inviteMember: ReturnType<typeof useProject>['inviteMember'];
  removeMember: ReturnType<typeof useProject>['removeMember'];
  transferOwnership: ReturnType<typeof useProject>['transferOwnership'];
}

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const { project, isLoading, members, membersLoading, update, inviteMember, removeMember, transferOwnership } =
    useProject(projectId);
  const { phases, isLoading: phasesLoading } = usePhases(projectId);
  const { tasks, tree } = useTasks(projectId);
  const { supplies } = useSupplies(projectId);
  const { items: punchListItems } = usePunchList(projectId);
  const { documents } = useDocuments(projectId);
  const { plans } = usePlans(projectId);
  const { models } = useModels3d(projectId);
  const { clients } = useClients();

  const [exportOpen, setExportOpen] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const currentSectionKey = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    return PROJECT_SECTIONS.some((s) => s.key === last) ? last! : PROJECT_SECTIONS[0]!.key;
  }, [location.pathname]);

  const [splitOpen, setSplitOpen] = useState(false);
  const [leftKey, setLeftKey] = useState(currentSectionKey);
  const [rightKey, setRightKey] = useState(
    () => PROJECT_SECTIONS.find((s) => s.key !== currentSectionKey)?.key ?? PROJECT_SECTIONS[0]!.key
  );

  function toggleSplit() {
    if (!splitOpen) {
      setLeftKey(currentSectionKey);
      setRightKey(PROJECT_SECTIONS.find((s) => s.key !== currentSectionKey)?.key ?? PROJECT_SECTIONS[0]!.key);
    }
    setSplitOpen((o) => !o);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleArchive() {
    if (!project) return;
    setExportOpen(false);
    setArchiving('Préparation...');
    try {
      // Chargé à la demande : jsPDF + JSZip ne sont utiles qu'à l'export,
      // inutile de les inclure dans le bundle initial.
      const { exportProjectArchive } = await import('@/services/projectExport.service');
      await exportProjectArchive({
        project,
        phases,
        tasks,
        tree,
        members,
        supplies,
        punchListItems,
        documents,
        plans,
        models,
        onProgress: setArchiving,
      });
    } finally {
      setArchiving(null);
    }
  }

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    reference: '',
    description: '',
    address: '',
    client_id: '',
    status: 'prospection' as ProjectStatus,
    start_date: '',
    end_date_planned: '',
    budget: '',
    latitude: '',
    longitude: '',
    portal_widgets: DEFAULT_PORTAL_WIDGETS as PortalWidgetsConfig,
  });
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  async function handleGeolocate() {
    if (!editForm.address.trim()) return;
    setGeocoding(true);
    setGeocodeError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(editForm.address)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const results = (await res.json()) as { lat: string; lon: string }[];
      if (results.length === 0) {
        setGeocodeError('Adresse introuvable.');
        return;
      }
      setEditForm((f) => ({ ...f, latitude: Number(results[0]!.lat).toFixed(6), longitude: Number(results[0]!.lon).toFixed(6) }));
    } catch {
      setGeocodeError('Géolocalisation indisponible.');
    } finally {
      setGeocoding(false);
    }
  }

  if (isLoading || !project || !projectId) return <FullPageSpinner />;

  function openEdit() {
    setEditForm({
      name: project!.name,
      reference: project!.reference ?? '',
      description: project!.description ?? '',
      address: project!.address ?? '',
      client_id: project!.client_id ?? '',
      status: project!.status as ProjectStatus,
      start_date: project!.start_date ?? '',
      end_date_planned: project!.end_date_planned ?? '',
      budget: project!.budget != null ? String(project!.budget) : '',
      latitude: project!.latitude != null ? String(project!.latitude) : '',
      longitude: project!.longitude != null ? String(project!.longitude) : '',
      portal_widgets: parsePortalWidgets(project!.portal_widgets),
    });
    setGeocodeError(null);
    setEditOpen(true);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      {
        name: editForm.name,
        reference: editForm.reference || null,
        description: editForm.description || null,
        address: editForm.address || null,
        client_id: editForm.client_id || null,
        status: editForm.status,
        start_date: editForm.start_date || null,
        end_date_planned: editForm.end_date_planned || null,
        budget: editForm.budget ? Number(editForm.budget) : null,
        latitude: editForm.latitude ? Number(editForm.latitude) : null,
        longitude: editForm.longitude ? Number(editForm.longitude) : null,
        portal_widgets: editForm.portal_widgets as unknown as Json,
      },
      { onSuccess: () => setEditOpen(false) }
    );
  }

  const context: ProjectOutletContext = {
    projectId,
    project,
    phases,
    phasesLoading,
    members,
    membersLoading,
    inviteMember,
    removeMember,
    transferOwnership,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">{project.name}</h1>
            <Badge tone="blue">{PROJECT_STATUS_LABELS[project.status as ProjectStatus]}</Badge>
          </div>
          {project.reference && <p className="text-sm text-slate-400">Réf. {project.reference}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={exportMenuRef}>
            <Button variant="outline" onClick={() => setExportOpen((o) => !o)} loading={Boolean(archiving)}>
              <FileDown className="h-4 w-4" />
              {archiving ?? 'Exporter'}
              {!archiving && <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            {exportOpen && (
              <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white py-1.5 shadow-popover">
                <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">PDF</p>
                <button
                  onClick={() => {
                    setExportOpen(false);
                    void import('@/services/pdfExport.service').then((m) => m.exportProjectSummaryPdf(project, phases, tasks, members));
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileDown className="h-4 w-4 text-slate-400" /> Fiche chantier
                </button>
                <button
                  onClick={() => {
                    setExportOpen(false);
                    void import('@/services/pdfExport.service').then((m) => m.exportGanttPdf(project, phases, tree));
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileDown className="h-4 w-4 text-slate-400" /> Planning
                </button>
                <button
                  onClick={() => {
                    setExportOpen(false);
                    void import('@/services/pdfExport.service').then((m) => m.exportPunchListPdf(project, punchListItems, members));
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileDown className="h-4 w-4 text-slate-400" /> Réserves de réception
                </button>

                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Excel / CSV</p>
                <button
                  onClick={() => {
                    setExportOpen(false);
                    void import('@/services/projectExport.service').then((m) => m.exportTasksCsv(project, tree));
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-slate-400" /> Tâches
                </button>
                <button
                  onClick={() => {
                    setExportOpen(false);
                    void import('@/services/projectExport.service').then((m) => m.exportSuppliesCsv(project, supplies));
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-slate-400" /> Approvisionnements
                </button>
                <button
                  onClick={() => {
                    setExportOpen(false);
                    void import('@/services/projectExport.service').then((m) => m.exportPunchListCsv(project, punchListItems, members));
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-slate-400" /> Réserves de réception
                </button>

                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Archive</p>
                <button
                  onClick={handleArchive}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileArchive className="h-4 w-4 text-slate-400" /> Archive complète du projet (.zip)
                </button>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={toggleSplit}
            title={splitOpen ? 'Fermer la vue partagée' : 'Vue partagée (2 onglets)'}
            aria-label={splitOpen ? 'Fermer la vue partagée' : 'Vue partagée (2 onglets)'}
          >
            {splitOpen ? <X className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={openEdit}>
            Modifier
          </Button>
        </div>
      </div>

      {splitOpen ? (
        <ProjectSplitView
          projectId={projectId}
          leftKey={leftKey}
          rightKey={rightKey}
          onChangeLeft={setLeftKey}
          onChangeRight={setRightKey}
        />
      ) : (
        <Outlet context={context} />
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Modifier le projet" size="lg">
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="editform-name"
              label="Nom du projet"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <Input id="editform-reference"
              label="Référence"
              value={editForm.reference}
              onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
            />
          </div>
          <Textarea
            label="Description"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
          <div className="flex items-end gap-2">
            <Input id="editform-address"
              label="Adresse"
              className="flex-1"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
            <Button type="button" variant="outline" onClick={handleGeolocate} loading={geocoding}>
              <MapPin className="h-4 w-4" />
              Géolocaliser
            </Button>
          </div>
          {geocodeError && <p className="text-sm text-red-600">{geocodeError}</p>}
          {editForm.latitude && editForm.longitude && (
            <p className="text-xs text-slate-400">
              Coordonnées : {editForm.latitude}, {editForm.longitude}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select id="editform-client-id"
              label="Client"
              value={editForm.client_id}
              onChange={(e) => setEditForm({ ...editForm, client_id: e.target.value })}
            >
              <option value="">Aucun</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
            <Select id="editform-status"
              label="Statut"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ProjectStatus })}
            >
              {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input id="editform-start-date"
              label="Début"
              type="date"
              value={editForm.start_date}
              onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
            />
            <Input id="editform-end-date-planned"
              label="Fin prévue"
              type="date"
              value={editForm.end_date_planned}
              onChange={(e) => setEditForm({ ...editForm, end_date_planned: e.target.value })}
            />
            <Input id="editform-budget"
              label="Budget (€)"
              type="number"
              min="0"
              step="0.01"
              value={editForm.budget}
              onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
            />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Portail client — widgets visibles</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PORTAL_WIDGET_LABELS) as (keyof PortalWidgetsConfig)[]).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={editForm.portal_widgets[key]}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        portal_widgets: { ...editForm.portal_widgets, [key]: e.target.checked },
                      })
                    }
                  />
                  {PORTAL_WIDGET_LABELS[key]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={update.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
