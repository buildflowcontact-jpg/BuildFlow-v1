import { useOutletContext } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useTasks } from '@/hooks/useTasks';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/utils/date';
import { ProjectContactsSection } from './ProjectContactsSection';
import type { ProjectOutletContext } from './ProjectLayout';

export function ProjectOverviewPage() {
  const { project, projectId, phases, members } = useOutletContext<ProjectOutletContext>();
  const { clients } = useClients();
  const { tasks } = useTasks(projectId);
  const client = clients.find((c) => c.id === project.client_id);

  function handleExportPdf() {
    // Import dynamique : pdfExport.service n'est chargé qu'à la demande (hors bundle initial).
    void import('@/services/pdfExport.service').then((m) =>
      m.exportProjectSummaryPdf(project, phases, tasks, members)
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExportPdf}>
          <FileDown className="h-4 w-4" />
          Exporter PDF
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <p className="text-sm text-slate-600">{project.description || 'Aucune description.'}</p>
          </Card>
          <ProjectContactsSection projectId={projectId} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Client</dt>
              <dd className="font-medium text-slate-800">{client?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-slate-500">Adresse</dt>
              <dd className="text-right font-medium text-slate-800">{project.address ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Début</dt>
              <dd className="font-medium text-slate-800">
                {project.start_date ? formatDate(project.start_date) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Fin prévue</dt>
              <dd className="font-medium text-slate-800">
                {project.end_date_planned ? formatDate(project.end_date_planned) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Budget</dt>
              <dd className="font-medium text-slate-800">
                {project.budget != null ? `${project.budget.toLocaleString('fr-FR')} €` : '—'}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
