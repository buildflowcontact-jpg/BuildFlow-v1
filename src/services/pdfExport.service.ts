import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { differenceInCalendarDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  PROJECT_STATUS_LABELS,
  PUNCH_LIST_STATUS_LABELS,
  PHASE_TYPE_LABELS,
  PHASE_STATUS_LABELS,
  MEETING_ACTION_ITEM_STATUS_LABELS,
  DOE_ITEM_STATUS_LABELS,
  DOE_ITEM_CATEGORY_LABELS,
} from '@/types/domain';
import type {
  Project,
  Phase,
  Task,
  TaskWithChildren,
  PunchListItem,
  ProjectMemberWithProfile,
  DailyReportTimeEntry,
  DailyReportWeatherDay,
  MeetingReportWithItems,
  MeetingAttendee,
  FirePermit,
  PrecautionItem,
  DoeItem,
  Company,
} from '@/types/domain';
import type {
  ProjectStatus,
  PhaseType,
  PhaseStatus,
  TaskStatus,
  PunchListStatus,
  MeetingActionItemStatus,
  DoeItemStatus,
  DoeItemCategory,
} from '@/types/database.types';

const BRAND_COLOR: [number, number, number] = [37, 99, 235]; // brand-600
const STATUS_COLORS: Record<TaskStatus, [number, number, number]> = {
  todo: [148, 163, 184],
  in_progress: [37, 99, 235],
  blocked: [239, 68, 68],
  done: [22, 163, 74],
};

/**
 * Crée un document PDF avec un en-tête BuildFlow réutilisable. Toute nouvelle
 * exportation (chantier, planning, réserves, et futures exportations) doit
 * partir de cette fonction afin de conserver une mise en page cohérente.
 */
function createDocument(title: string, subtitle?: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BuildFlow', 40, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 40, 48);

  doc.setTextColor(30, 41, 59);
  if (subtitle) {
    doc.setFontSize(10);
    doc.text(subtitle, 40, 84);
  }

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`, pageWidth - 40, 84, { align: 'right' });

  return doc;
}

export function finalizePdfFooters(doc: jsPDF): void {
  addFooters(doc);
}

function addFooters(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - 40, pageHeight - 24, { align: 'right' });
    doc.text('BuildFlow — Export généré automatiquement', 40, pageHeight - 24);
  }
}

function downloadDoc(doc: jsPDF, filename: string): void {
  addFooters(doc);
  doc.save(filename);
}

function flattenTasks(tree: TaskWithChildren[]): TaskWithChildren[] {
  const result: TaskWithChildren[] = [];
  function walk(nodes: TaskWithChildren[]) {
    for (const node of nodes) {
      result.push(node);
      walk(node.children);
    }
  }
  walk(tree);
  return result;
}

/** Construit le PDF "fiche chantier" sans le télécharger (réutilisable pour l'archive ZIP). */
export function buildProjectSummaryPdf(
  project: Project,
  phases: Phase[],
  tasks: Task[],
  members: ProjectMemberWithProfile[]
): jsPDF {
  const doc = createDocument('Fiche chantier', project.name);

  let y = 110;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Informations générales', 40, y);
  y += 16;

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, textColor: [51, 65, 85] },
    body: [
      ['Référence', project.reference ?? '—'],
      ['Statut', PROJECT_STATUS_LABELS[project.status as ProjectStatus]],
      ['Début', project.start_date ? format(new Date(project.start_date), 'dd/MM/yyyy') : '—'],
      ['Fin prévue', project.end_date_planned ? format(new Date(project.end_date_planned), 'dd/MM/yyyy') : '—'],
      ['Budget', project.budget != null ? `${project.budget.toLocaleString('fr-FR')} €` : '—'],
      ['Description', project.description ?? '—'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110 } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Phases du projet', 40, y);
  y += 8;

  autoTable(doc, {
    startY: y + 6,
    head: [['Phase', 'Type', 'Statut', 'Début', 'Fin']],
    body: phases
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((phase) => [
        phase.name,
        PHASE_TYPE_LABELS[phase.type as PhaseType],
        PHASE_STATUS_LABELS[phase.status as PhaseStatus],
        phase.start_date ? format(new Date(phase.start_date), 'dd/MM/yyyy') : '—',
        phase.end_date ? format(new Date(phase.end_date), 'dd/MM/yyyy') : '—',
      ]),
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Synthèse des tâches', 40, y);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const overdueTasks = tasks.filter((t) => t.end_date && new Date(t.end_date) < new Date() && t.status !== 'done').length;

  autoTable(doc, {
    startY: y + 14,
    head: [['Total', 'Terminées', 'En retard']],
    body: [[String(totalTasks), String(doneTasks), String(overdueTasks)]],
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9, halign: 'center' },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Équipe projet', 40, y);

  autoTable(doc, {
    startY: y + 14,
    head: [['Nom', 'Email', 'Rôle']],
    body: members.map((m) => [
      m.profile?.full_name ?? m.invited_email ?? '—',
      m.profile?.email ?? m.invited_email ?? '—',
      m.role === 'owner' ? 'Propriétaire' : 'Collaborateur',
    ]),
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9 },
  });

  return doc;
}

export function exportProjectSummaryPdf(
  project: Project,
  phases: Phase[],
  tasks: Task[],
  members: ProjectMemberWithProfile[]
): void {
  const doc = buildProjectSummaryPdf(project, phases, tasks, members);
  downloadDoc(doc, `fiche-chantier-${project.reference ?? project.name}.pdf`);
}

/** Construit le PDF "planning" sans le télécharger (réutilisable pour l'archive ZIP). */
export function buildGanttPdf(project: Project, phases: Phase[], tree: TaskWithChildren[]): jsPDF {
  const doc = createDocument('Planning du projet', project.name);
  const allTasks = flattenTasks(tree).filter((t) => t.start_date && t.end_date);

  if (allTasks.length === 0) {
    doc.setFontSize(11);
    doc.text('Aucune tâche planifiée (dates de début/fin manquantes).', 40, 110);
    return doc;
  }

  const starts = allTasks.map((t) => new Date(t.start_date!).getTime());
  const ends = allTasks.map((t) => new Date(t.end_date!).getTime());
  const rangeStart = new Date(Math.min(...starts));
  const rangeEnd = new Date(Math.max(...ends));
  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));

  const pageWidth = doc.internal.pageSize.getWidth();
  const labelWidth = 170;
  const chartLeft = 40 + labelWidth;
  const chartWidth = pageWidth - chartLeft - 40;
  const rowHeight = 16;
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = 110;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Période : ${format(rangeStart, 'dd/MM/yyyy', { locale: fr })} → ${format(rangeEnd, 'dd/MM/yyyy', { locale: fr })}`,
    40,
    y
  );
  y += 18;

  const orderedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);
  const byPhase = new Map<string | null, TaskWithChildren[]>();
  for (const task of allTasks) {
    const key = task.phase_id;
    const list = byPhase.get(key) ?? [];
    list.push(task);
    byPhase.set(key, list);
  }

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 50) {
      doc.addPage();
      y = 50;
    }
  }

  function drawTaskRow(task: TaskWithChildren) {
    ensureSpace(rowHeight + 4);
    const start = new Date(task.start_date!);
    const end = new Date(task.end_date!);
    const x = chartLeft + (differenceInCalendarDays(start, rangeStart) / totalDays) * chartWidth;
    const width = Math.max(3, (differenceInCalendarDays(end, start) / totalDays) * chartWidth);

    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const label = task.title.length > 32 ? `${task.title.slice(0, 30)}…` : task.title;
    doc.text(label, 44, y + rowHeight / 2 + 3);

    const color = STATUS_COLORS[task.status as TaskStatus];
    doc.setFillColor(...color);
    doc.roundedRect(x, y + 3, width, rowHeight - 6, 1, 1, 'F');

    y += rowHeight + 2;
  }

  for (const phase of orderedPhases) {
    const phaseTasks = byPhase.get(phase.id);
    if (!phaseTasks || phaseTasks.length === 0) continue;
    ensureSpace(20);
    doc.setFillColor(241, 245, 249);
    doc.rect(40, y, pageWidth - 80, 16, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(phase.name, 44, y + 11);
    doc.setFont('helvetica', 'normal');
    y += 20;
    for (const task of phaseTasks) drawTaskRow(task);
    y += 6;
  }

  const orphanTasks = byPhase.get(null);
  if (orphanTasks && orphanTasks.length > 0) {
    ensureSpace(20);
    doc.setFillColor(241, 245, 249);
    doc.rect(40, y, pageWidth - 80, 16, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Sans phase', 44, y + 11);
    doc.setFont('helvetica', 'normal');
    y += 20;
    for (const task of orphanTasks) drawTaskRow(task);
  }

  return doc;
}

export function exportGanttPdf(project: Project, phases: Phase[], tree: TaskWithChildren[]): void {
  const doc = buildGanttPdf(project, phases, tree);
  downloadDoc(doc, `planning-${project.reference ?? project.name}.pdf`);
}

/** Construit le PDF "réserves de réception" sans le télécharger (réutilisable pour l'archive ZIP). */
export function buildPunchListPdf(project: Project, items: PunchListItem[], members: ProjectMemberWithProfile[]): jsPDF {
  const doc = createDocument('Réserves de réception', project.name);

  autoTable(doc, {
    startY: 110,
    head: [['Titre', 'Localisation', 'Statut', 'Assigné à', 'Échéance']],
    body: items.map((item) => {
      const assignee = members.find((m) => m.profile?.id === item.assigned_to);
      return [
        item.title,
        item.location ?? '—',
        PUNCH_LIST_STATUS_LABELS[item.status as PunchListStatus],
        assignee?.profile?.full_name ?? assignee?.invited_email ?? '—',
        item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy') : '—',
      ];
    }),
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 150 } },
  });

  return doc;
}

export function exportPunchListPdf(project: Project, items: PunchListItem[], members: ProjectMemberWithProfile[]): void {
  const doc = buildPunchListPdf(project, items, members);
  downloadDoc(doc, `reserves-${project.reference ?? project.name}.pdf`);
}

export interface ReceptionSignature {
  signerName: string;
  dataUrl: string;
}

/**
 * Construit le PDF "PV de réception" : synthèse des réserves (levées vs
 * restantes), détail par réserve, puis les deux signatures électroniques
 * (client + chef de chantier) en bas de page. Document horodaté destiné à
 * être archivé dans Documents.
 */
export function buildReceptionReportPdf(
  project: Project,
  items: PunchListItem[],
  members: ProjectMemberWithProfile[],
  signatures: { client: ReceptionSignature; chefChantier: ReceptionSignature }
): jsPDF {
  const doc = createDocument('Procès-verbal de réception', project.name);

  const resolvedCount = items.filter((i) => i.status === 'resolved' || i.status === 'verified').length;
  const remainingCount = items.length - resolvedCount;

  let y = 110;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Synthèse des réserves', 40, y);

  autoTable(doc, {
    startY: y + 10,
    head: [['Total', 'Levées', 'Restantes']],
    body: [[String(items.length), String(resolvedCount), String(remainingCount)]],
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9, halign: 'center' },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Détail des réserves', 40, y);

  autoTable(doc, {
    startY: y + 10,
    head: [['Titre', 'Localisation', 'Statut', 'Assigné à', 'Échéance']],
    body: items.map((item) => {
      const assignee = members.find((m) => m.profile?.id === item.assigned_to);
      return [
        item.title,
        item.location ?? '—',
        PUNCH_LIST_STATUS_LABELS[item.status as PunchListStatus],
        assignee?.profile?.full_name ?? assignee?.invited_email ?? '—',
        item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy') : '—',
      ];
    }),
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 150 } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 32;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 140 > pageHeight - 50) {
    doc.addPage();
    y = 50;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Signatures', 40, y);
  y += 16;

  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - 80 - 20) / 2;
  const sigBlocks: { label: string; signature: ReceptionSignature; x: number }[] = [
    { label: 'Le client', signature: signatures.client, x: 40 },
    { label: 'Le chef de chantier', signature: signatures.chefChantier, x: 40 + colWidth + 20 },
  ];

  for (const block of sigBlocks) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(block.label, block.x, y);

    const imgTop = y + 8;
    const imgHeight = 70;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(block.x, imgTop, colWidth, imgHeight, 4, 4);
    if (block.signature.dataUrl) {
      const props = doc.getImageProperties(block.signature.dataUrl);
      const ratio = Math.min((colWidth - 12) / props.width, (imgHeight - 12) / props.height);
      const w = props.width * ratio;
      const h = props.height * ratio;
      doc.addImage(block.signature.dataUrl, 'PNG', block.x + (colWidth - w) / 2, imgTop + (imgHeight - h) / 2, w, h);
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(block.signature.signerName, block.x, imgTop + imgHeight + 14);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }), block.x, imgTop + imgHeight + 26);
  }

  return doc;
}

export function exportReceptionReportPdf(
  project: Project,
  items: PunchListItem[],
  members: ProjectMemberWithProfile[],
  signatures: { client: ReceptionSignature; chefChantier: ReceptionSignature }
): File {
  const doc = buildReceptionReportPdf(project, items, members, signatures);
  const filename = `pv-reception-${project.reference ?? project.name}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  return pdfToFile(doc, filename);
}

// Codes météo WMO (sous-ensemble Open-Meteo) → libellé FR.
const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Ciel dégagé',
  1: 'Principalement dégagé',
  2: 'Partiellement nuageux',
  3: 'Couvert',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine légère',
  53: 'Bruine modérée',
  55: 'Bruine dense',
  56: 'Bruine verglaçante légère',
  57: 'Bruine verglaçante dense',
  61: 'Pluie légère',
  63: 'Pluie modérée',
  65: 'Pluie forte',
  66: 'Pluie verglaçante légère',
  67: 'Pluie verglaçante forte',
  71: 'Neige légère',
  73: 'Neige modérée',
  75: 'Neige forte',
  77: 'Grains de neige',
  80: 'Averses de pluie légères',
  81: 'Averses de pluie modérées',
  82: 'Averses de pluie violentes',
  85: 'Averses de neige légères',
  86: 'Averses de neige fortes',
  95: 'Orage',
  96: 'Orage avec grêle légère',
  99: 'Orage avec grêle forte',
};

/** Construit le PDF "rapport quotidien" (pointage + météo) sans le télécharger. */
export function buildDailyReportPdf(
  project: Project,
  reportDate: string,
  timeEntries: DailyReportTimeEntry[],
  weather: DailyReportWeatherDay | null
): jsPDF {
  const doc = createDocument(
    'Rapport quotidien',
    `${project.name} — ${format(new Date(reportDate), 'EEEE d MMMM yyyy', { locale: fr })}`
  );

  let y = 110;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Météo du jour', 40, y);

  if (weather) {
    const dayIndex = Math.max(0, weather.time.findIndex((t) => t === reportDate));
    const code = weather.weathercode[dayIndex] ?? -1;
    autoTable(doc, {
      startY: y + 10,
      theme: 'plain',
      styles: { fontSize: 9, textColor: [51, 65, 85] },
      body: [
        ['Conditions', WEATHER_CODE_LABELS[code] ?? `Code ${code}`],
        ['Température max', `${weather.temperature_2m_max[dayIndex]} °C`],
        ['Température min', `${weather.temperature_2m_min[dayIndex]} °C`],
        ['Probabilité de précipitations', `${weather.precipitation_probability_max[dayIndex]} %`],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 160 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Données météo indisponibles.', 40, y + 18);
    y += 40;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Pointage horaire', 40, y);

  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);

  if (timeEntries.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Aucun pointage enregistré pour cette journée.', 40, y + 18);
  } else {
    autoTable(doc, {
      startY: y + 10,
      head: [['Collaborateur', 'Heures']],
      body: [...timeEntries.map((entry) => [entry.full_name, `${entry.hours} h`]), ['Total', `${totalHours} h`]],
      headStyles: { fillColor: BRAND_COLOR },
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
    });
  }

  return doc;
}

export function exportDailyReportPdf(
  project: Project,
  reportDate: string,
  timeEntries: DailyReportTimeEntry[],
  weather: DailyReportWeatherDay | null
): void {
  const doc = buildDailyReportPdf(project, reportDate, timeEntries, weather);
  downloadDoc(doc, `rapport-quotidien-${reportDate}.pdf`);
}

/**
 * Construit le PDF d'un rapport de captures annotées (plans 2D ou maquettes
 * 3D) : une capture par page, image pleine largeur + légende. Les annotations
 * (dessin libre, texte, pins) sont déjà "aplaties" dans `dataUrl` au moment de
 * la capture, ce PDF ne fait qu'assembler les images.
 */
export function buildCaptureReportPdf(
  project: Project,
  title: string,
  captures: { label: string; dataUrl: string; createdAt: string }[]
): jsPDF {
  const doc = createDocument('Rapport de captures', `${project.name} — ${title}`);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  captures.forEach((capture, index) => {
    if (index > 0) doc.addPage();

    const top = index === 0 ? 100 : 40;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(capture.label, margin, top);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(format(new Date(capture.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr }), margin, top + 14);

    const imgTop = top + 24;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - imgTop - 50;
    const props = doc.getImageProperties(capture.dataUrl);
    const ratio = Math.min(maxWidth / props.width, maxHeight / props.height);
    const width = props.width * ratio;
    const height = props.height * ratio;

    doc.addImage(capture.dataUrl, 'PNG', margin, imgTop, width, height);
  });

  return doc;
}

/**
 * Construit le PDF "compte-rendu de réunion de chantier" : infos générales
 * (date, lieu, participants), ordre du jour, notes, points d'action avec
 * responsable/échéance/statut, et date de la prochaine réunion. Document
 * destiné à être archivé dans Documents (type compte_rendu).
 */
export function buildMeetingReportPdf(project: Project, report: MeetingReportWithItems, members: ProjectMemberWithProfile[]): jsPDF {
  const doc = createDocument('Compte-rendu de réunion de chantier', `${project.name} — ${report.title}`);

  const attendees = Array.isArray(report.attendees) ? (report.attendees as unknown as MeetingAttendee[]) : [];

  let y = 110;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Informations générales', 40, y);
  y += 16;

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, textColor: [51, 65, 85] },
    body: [
      ['Date de réunion', format(new Date(report.meeting_date), 'EEEE d MMMM yyyy', { locale: fr })],
      ['Lieu', report.location ?? '—'],
      ['Prochaine réunion', report.next_meeting_date ? format(new Date(report.next_meeting_date), 'dd/MM/yyyy') : '—'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 130 } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Participants', 40, y);

  autoTable(doc, {
    startY: y + 10,
    head: [['Nom', 'Rôle']],
    body: attendees.length > 0 ? attendees.map((a) => [a.name, a.role ?? '—']) : [['Aucun participant renseigné', '']],
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  if (report.agenda) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Ordre du jour', 40, y);
    y += 16;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const agendaLines = doc.splitTextToSize(report.agenda, doc.internal.pageSize.getWidth() - 80);
    doc.text(agendaLines, 40, y);
    y += agendaLines.length * 12 + 20;
  }

  if (report.notes) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Notes / compte-rendu', 40, y);
    y += 16;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const notesLines = doc.splitTextToSize(report.notes, doc.internal.pageSize.getWidth() - 80);
    doc.text(notesLines, 40, y);
    y += notesLines.length * 12 + 20;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 60 > pageHeight - 50) {
    doc.addPage();
    y = 50;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text("Points d'action", 40, y);

  autoTable(doc, {
    startY: y + 10,
    head: [['Description', 'Responsable', 'Échéance', 'Statut']],
    body:
      report.actionItems.length > 0
        ? report.actionItems.map((item) => {
            const assignee = members.find((m) => m.profile?.id === item.assigned_to);
            return [
              item.description,
              assignee?.profile?.full_name ?? assignee?.invited_email ?? '—',
              item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy') : '—',
              MEETING_ACTION_ITEM_STATUS_LABELS[item.status as MeetingActionItemStatus],
            ];
          })
        : [['Aucun point d’action', '', '', '']],
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 220 } },
  });

  return doc;
}

export function exportMeetingReportPdf(project: Project, report: MeetingReportWithItems, members: ProjectMemberWithProfile[]): File {
  const doc = buildMeetingReportPdf(project, report, members);
  const filename = `cr-reunion-${report.meeting_date}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  return pdfToFile(doc, filename);
}

export interface FirePermitSignature {
  signerName: string;
  dataUrl: string;
}

/**
 * Construit le PDF "permis de feu" : informations sur l'intervention par
 * point chaud, checklist des mesures de prévention, puis les deux signatures
 * électroniques (émetteur + exécutant) en bas de page.
 */
export function buildFirePermitPdf(
  project: Project,
  permit: FirePermit,
  companyName: string | null,
  signatures: { issuer: FirePermitSignature; executant: FirePermitSignature }
): jsPDF {
  const doc = createDocument('Permis de feu', project.name);

  const precautions = Array.isArray(permit.precautions) ? (permit.precautions as unknown as PrecautionItem[]) : [];

  let y = 110;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text("Informations sur l'intervention", 40, y);
  y += 16;

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, textColor: [51, 65, 85] },
    body: [
      ['Date', format(new Date(permit.work_date), 'EEEE d MMMM yyyy', { locale: fr })],
      ['Localisation', permit.location],
      ['Nature des travaux', permit.work_description],
      ['Entreprise exécutante', companyName ?? '—'],
      ['Exécutant', permit.executant_name],
      ['Horaires', `${permit.start_time ?? '—'} – ${permit.end_time ?? '—'}`],
      ['Surveillance après arrêt', `${permit.fire_watch_minutes} minutes`],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 150 } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Mesures de prévention', 40, y);

  autoTable(doc, {
    startY: y + 10,
    head: [['Mesure', 'Vérifiée']],
    body:
      precautions.length > 0
        ? precautions.map((p) => [p.label, p.checked ? 'Oui' : 'Non'])
        : [['Aucune mesure renseignée', '']],
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 380 }, 1: { halign: 'center' } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 32;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 140 > pageHeight - 50) {
    doc.addPage();
    y = 50;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Signatures', 40, y);
  y += 16;

  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - 80 - 20) / 2;
  const sigBlocks: { label: string; signature: FirePermitSignature; x: number }[] = [
    { label: 'Émetteur du permis', signature: signatures.issuer, x: 40 },
    { label: 'Exécutant', signature: signatures.executant, x: 40 + colWidth + 20 },
  ];

  for (const block of sigBlocks) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(block.label, block.x, y);

    const imgTop = y + 8;
    const imgHeight = 70;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(block.x, imgTop, colWidth, imgHeight, 4, 4);
    if (block.signature.dataUrl) {
      const props = doc.getImageProperties(block.signature.dataUrl);
      const ratio = Math.min((colWidth - 12) / props.width, (imgHeight - 12) / props.height);
      const w = props.width * ratio;
      const h = props.height * ratio;
      doc.addImage(block.signature.dataUrl, 'PNG', block.x + (colWidth - w) / 2, imgTop + (imgHeight - h) / 2, w, h);
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(block.signature.signerName, block.x, imgTop + imgHeight + 14);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }), block.x, imgTop + imgHeight + 26);
  }

  return doc;
}

export function exportFirePermitPdf(
  project: Project,
  permit: FirePermit,
  companyName: string | null,
  signatures: { issuer: FirePermitSignature; executant: FirePermitSignature }
): File {
  const doc = buildFirePermitPdf(project, permit, companyName, signatures);
  const filename = `permis-feu-${permit.work_date}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  return pdfToFile(doc, filename);
}

/**
 * Construit le PDF "synthèse DOE" : récapitulatif des pièces attendues,
 * groupées par lot, avec entreprise, catégorie, statut et date de réception.
 * Document de suivi (pas de signatures), destiné à être archivé ou diffusé
 * au client à la livraison du chantier.
 */
export function buildDoeSummaryPdf(project: Project, items: DoeItem[], companies: Company[]): jsPDF {
  const doc = createDocument('Synthèse DOE', project.name);

  const total = items.length;
  const validated = items.filter((i) => i.status === 'valide').length;
  const received = items.filter((i) => i.status === 'recu').length;
  const missing = items.filter((i) => i.status === 'manquant').length;

  let y = 110;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Avancement global', 40, y);

  autoTable(doc, {
    startY: y + 10,
    head: [['Total', 'Validées', 'Reçues', 'Manquantes']],
    body: [[String(total), String(validated), String(received), String(missing)]],
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9, halign: 'center' },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  const byLot = new Map<string, DoeItem[]>();
  for (const item of items) {
    const list = byLot.get(item.lot) ?? [];
    list.push(item);
    byLot.set(item.lot, list);
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  for (const [lot, lotItems] of [...byLot.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (y + 40 > pageHeight - 50) {
      doc.addPage();
      y = 50;
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(40, y, pageWidth - 80, 16, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(lot, 44, y + 11);
    doc.setFont('helvetica', 'normal');
    y += 20;

    autoTable(doc, {
      startY: y,
      head: [['Pièce', 'Catégorie', 'Entreprise', 'Statut', 'Reçu le']],
      body: lotItems.map((item) => {
        const company = companies.find((c) => c.id === item.company_id);
        return [
          item.label,
          DOE_ITEM_CATEGORY_LABELS[item.category as DoeItemCategory],
          company?.name ?? '—',
          DOE_ITEM_STATUS_LABELS[item.status as DoeItemStatus],
          item.received_date ? format(new Date(item.received_date), 'dd/MM/yyyy') : '—',
        ];
      }),
      headStyles: { fillColor: BRAND_COLOR },
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 180 } },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }

  return doc;
}

export function exportDoeSummaryPdf(project: Project, items: DoeItem[], companies: Company[]): void {
  const doc = buildDoeSummaryPdf(project, items, companies);
  downloadDoc(doc, `doe-${project.reference ?? project.name}.pdf`);
}

/** Convertit un document jsPDF en File (pour upload direct vers Supabase Storage, ex. archivage auto). */
export function pdfToFile(doc: jsPDF, filename: string): File {
  addFooters(doc);
  const blob = doc.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
}
