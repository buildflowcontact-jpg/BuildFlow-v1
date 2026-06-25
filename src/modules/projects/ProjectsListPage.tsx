import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban, Trash2 } from 'lucide-react';
import { useProjects, useProjectsProgress } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { PROJECT_STATUS_LABELS } from '@/types/domain';
import { formatDate } from '@/utils/date';
import type { ProjectStatus, TablesInsert } from '@/types/database.types';

const STATUS_TONE: Record<ProjectStatus, 'slate' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'> = {
  prospection: 'slate',
  devis: 'blue',
  etude: 'purple',
  preparation: 'purple',
  approvisionnement: 'yellow',
  chantier: 'yellow',
  reception: 'green',
  livre: 'green',
  annule: 'red',
};

type ProjectFormState = {
  name: string;
  reference: string;
  description: string;
  client_id: string;
  status: ProjectStatus;
  start_date: string;
  end_date_planned: string;
  budget: string;
};

const emptyForm: ProjectFormState = {
  name: '',
  reference: '',
  description: '',
  client_id: '',
  status: 'prospection',
  start_date: '',
  end_date_planned: '',
  budget: '',
};

export function ProjectsListPage() {
  const { projects, isLoading, create, remove } = useProjects();
  const { clients } = useClients();
  const { data: progressByProject } = useProjectsProgress(projects.map((p) => p.id));
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProjectFormState>(emptyForm);

  function handleDelete(e: React.MouseEvent, projectId: string, projectName: string) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Supprimer définitivement le projet "${projectName}" ? Cette action est irréversible.`)) {
      remove.mutate(projectId);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'projects'>, 'organization_id' | 'owner_id'> = {
      name: form.name,
      reference: form.reference || null,
      description: form.description || null,
      client_id: form.client_id || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date_planned: form.end_date_planned || null,
      budget: form.budget ? Number(form.budget) : null,
    };
    create.mutate(payload, {
      onSuccess: () => {
        setModalOpen(false);
        setForm(emptyForm);
      },
    });
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{projects.length} projet(s)</p>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouveau projet
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Aucun projet" description="Créez votre premier projet pour démarrer." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="flex h-full flex-col gap-3 transition-shadow hover:shadow-popover">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{project.name}</p>
                    {project.reference && <p className="text-xs text-slate-400">Réf. {project.reference}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge tone={STATUS_TONE[project.status as ProjectStatus]}>{PROJECT_STATUS_LABELS[project.status as ProjectStatus]}</Badge>
                    <button
                      title="Supprimer le projet"
                      aria-label="Supprimer le projet"
                      onClick={(e) => handleDelete(e, project.id, project.name)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {project.description && <p className="line-clamp-2 text-sm text-slate-500">{project.description}</p>}
                <div className="mt-auto flex flex-col gap-2 pt-2">
                  <ProgressBar value={progressByProject?.[project.id] ?? 0} />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{project.start_date ? formatDate(project.start_date) : 'Non planifié'}</span>
                    <span>{project.end_date_planned ? formatDate(project.end_date_planned) : ''}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau projet" size="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom du projet" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Référence" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Client" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">Aucun</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
            <Select
              label="Statut"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
            >
              {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Début"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <Input
              label="Fin prévue"
              type="date"
              value={form.end_date_planned}
              onChange={(e) => setForm({ ...form, end_date_planned: e.target.value })}
            />
            <Input
              label="Budget (€)"
              type="number"
              min="0"
              step="0.01"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Créer le projet
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
