import JSZip from 'jszip';
import { buildCsv, downloadCsv } from '@/utils/csvExport';
import { storageService } from './storage.service';
import { plansService } from './plans.service';
import { buildProjectSummaryPdf, buildGanttPdf, buildPunchListPdf, finalizePdfFooters } from './pdfExport.service';
import { PROJECT_STATUS_LABELS, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, SUPPLY_STATUS_LABELS, PUNCH_LIST_STATUS_LABELS } from '@/types/domain';
import type {
  Project,
  Phase,
  Task,
  TaskWithChildren,
  Supply,
  PunchListItem,
  ProjectMemberWithProfile,
  Document as ProjectDocument,
  Plan,
  Model3D,
} from '@/types/domain';
import type { ProjectStatus, TaskStatus, TaskPriority, SupplyStatus, PunchListStatus } from '@/types/database.types';

function flattenTasks(tree: TaskWithChildren[], depth = 0): { task: TaskWithChildren; depth: number }[] {
  const result: { task: TaskWithChildren; depth: number }[] = [];
  for (const task of tree) {
    result.push({ task, depth });
    result.push(...flattenTasks(task.children, depth + 1));
  }
  return result;
}

/** Export CSV (ouvrable directement dans Excel) de la liste des tâches, avec indentation par niveau hiérarchique. */
export function exportTasksCsv(project: Project, tree: TaskWithChildren[]): void {
  const headers = ['Tâche', 'Statut', 'Priorité', 'Début', 'Fin', 'Avancement (%)'];
  const rows = flattenTasks(tree).map(({ task, depth }) => [
    `${'  '.repeat(depth)}${task.title}`,
    TASK_STATUS_LABELS[task.status as TaskStatus],
    TASK_PRIORITY_LABELS[task.priority as TaskPriority],
    task.start_date ?? '',
    task.end_date ?? '',
    String(task.progress ?? 0),
  ]);
  downloadCsv(`taches-${project.reference ?? project.name}.csv`, headers, rows);
}

/** Export CSV de la liste des approvisionnements. */
export function exportSuppliesCsv(project: Project, supplies: Supply[]): void {
  const headers = ['Fournisseur', 'Référence commande', 'Article', 'Quantité', 'Unité', 'Statut', 'Livraison prévue', 'Livraison réelle'];
  const rows = supplies.map((s) => [
    s.supplier_name,
    s.order_reference ?? '',
    s.item_description,
    String(s.quantity),
    s.unit ?? '',
    SUPPLY_STATUS_LABELS[s.status as SupplyStatus],
    s.expected_delivery_date ?? '',
    s.actual_delivery_date ?? '',
  ]);
  downloadCsv(`approvisionnements-${project.reference ?? project.name}.csv`, headers, rows);
}

/** Export CSV des réserves de réception. */
export function exportPunchListCsv(project: Project, items: PunchListItem[], members: ProjectMemberWithProfile[]): void {
  const headers = ['Titre', 'Description', 'Localisation', 'Statut', 'Assigné à', 'Échéance'];
  const rows = items.map((item) => {
    const assignee = members.find((m) => m.profile?.id === item.assigned_to);
    return [
      item.title,
      item.description ?? '',
      item.location ?? '',
      PUNCH_LIST_STATUS_LABELS[item.status as PunchListStatus],
      assignee?.profile?.full_name ?? assignee?.invited_email ?? '',
      item.due_date ?? '',
    ];
  });
  downloadCsv(`reserves-${project.reference ?? project.name}.csv`, headers, rows);
}

function projectInfoCsv(project: Project): string {
  const headers = ['Référence', 'Statut', 'Début', 'Fin prévue', 'Budget (€)', 'Description'];
  const rows = [
    [
      project.reference ?? '',
      PROJECT_STATUS_LABELS[project.status as ProjectStatus],
      project.start_date ?? '',
      project.end_date_planned ?? '',
      project.budget != null ? String(project.budget) : '',
      project.description ?? '',
    ],
  ];
  return buildCsv(headers, rows);
}

/**
 * Génère une archive ZIP complète du projet : fiche chantier + planning + réserves
 * en PDF, tâches/approvisionnements/réserves en CSV, et l'ensemble des fichiers
 * stockés (documents, plans — toutes versions —, maquettes 3D), organisés par dossier.
 * Permet de conserver une copie hors-ligne complète d'un chantier (sauvegarde,
 * remise à un client, archivage en fin de projet).
 */
export async function exportProjectArchive(params: {
  project: Project;
  phases: Phase[];
  tasks: Task[];
  tree: TaskWithChildren[];
  members: ProjectMemberWithProfile[];
  supplies: Supply[];
  punchListItems: PunchListItem[];
  documents: ProjectDocument[];
  plans: Plan[];
  models: Model3D[];
  onProgress?: (label: string) => void;
}): Promise<void> {
  const { project } = params;
  const zip = new JSZip();
  const report = (label: string) => params.onProgress?.(label);

  report('Génération des PDF...');
  const summaryPdf = buildProjectSummaryPdf(project, params.phases, params.tasks, params.members);
  finalizePdfFooters(summaryPdf);
  zip.file('fiche-chantier.pdf', summaryPdf.output('blob'));

  const ganttPdf = buildGanttPdf(project, params.phases, params.tree);
  finalizePdfFooters(ganttPdf);
  zip.file('planning.pdf', ganttPdf.output('blob'));

  const punchListPdf = buildPunchListPdf(project, params.punchListItems, params.members);
  finalizePdfFooters(punchListPdf);
  zip.file('reserves.pdf', punchListPdf.output('blob'));

  report('Génération des fichiers CSV...');
  zip.file('informations-projet.csv', `\ufeff${projectInfoCsv(project)}`);
  zip.file(
    'taches.csv',
    `\ufeff${buildCsv(
      ['Tâche', 'Statut', 'Priorité', 'Début', 'Fin', 'Avancement (%)'],
      flattenTasks(params.tree).map(({ task, depth }) => [
        `${'  '.repeat(depth)}${task.title}`,
        TASK_STATUS_LABELS[task.status as TaskStatus],
        TASK_PRIORITY_LABELS[task.priority as TaskPriority],
        task.start_date ?? '',
        task.end_date ?? '',
        String(task.progress ?? 0),
      ])
    )}`
  );
  zip.file(
    'approvisionnements.csv',
    `\ufeff${buildCsv(
      ['Fournisseur', 'Référence commande', 'Article', 'Quantité', 'Unité', 'Statut', 'Livraison prévue', 'Livraison réelle'],
      params.supplies.map((s) => [
        s.supplier_name,
        s.order_reference ?? '',
        s.item_description,
        String(s.quantity),
        s.unit ?? '',
        SUPPLY_STATUS_LABELS[s.status as SupplyStatus],
        s.expected_delivery_date ?? '',
        s.actual_delivery_date ?? '',
      ])
    )}`
  );

  report('Téléchargement des documents...');
  const documentsFolder = zip.folder('documents')!;
  for (const doc of params.documents) {
    try {
      const blob = await storageService.download('documents', doc.storage_path);
      documentsFolder.file(doc.name, blob);
    } catch {
      // fichier introuvable/inaccessible : on l'ignore plutôt que de bloquer l'archive entière
    }
  }

  report('Téléchargement des plans...');
  const plansFolder = zip.folder('plans')!;
  for (const plan of params.plans) {
    try {
      const versions = await plansService.listVersions(plan.id);
      const planFolder = plansFolder.folder(plan.name) ?? plansFolder;
      for (const version of versions) {
        const blob = await storageService.download('plans', version.storage_path);
        const ext = version.storage_path.split('.').pop();
        planFolder.file(`v${version.version}${ext ? `.${ext}` : ''}`, blob);
      }
    } catch {
      // idem : on continue l'archive même si une version est inaccessible
    }
  }

  report('Téléchargement des maquettes 3D...');
  const modelsFolder = zip.folder('maquettes-3d')!;
  for (const model of params.models) {
    try {
      const blob = await storageService.download('models3d', model.storage_path);
      modelsFolder.file(model.name, blob);
    } catch {
      // idem
    }
  }

  report('Compression de l\'archive...');
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `archive-${project.reference ?? project.name}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}
