/**
 * Utilitaires d'export PDF (jsPDF + jspdf-autotable).
 * Toutes les fonctions sont async pour permettre un import dynamique en lazy-loading.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WarrantyClaim, Project } from '@/types/domain';

// ── Palettes ────────────────────────────────────────────────────────────────

const COLOR_BRAND: [number, number, number] = [37, 99, 235];   // brand-600
const COLOR_HEADER: [number, number, number] = [30, 41, 59];   // slate-800
const COLOR_SUB: [number, number, number] = [100, 116, 139];   // slate-500
const COLOR_ROW_ALT: [number, number, number] = [248, 250, 252]; // slate-50

// ── Labels (locaux, pas d'import circulaire) ────────────────────────────────

const WARRANTY_TYPE_PDF: Record<string, string> = {
  parfait_achevement: 'Parfait achèvement',
  biennale: 'Biennale',
  decennale: 'Décennale',
  hors_garantie: 'Hors garantie',
};
const WARRANTY_PRIORITY_PDF: Record<string, string> = {
  basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'URGENTE',
};
const WARRANTY_STATUS_PDF: Record<string, string> = {
  ouvert: 'Ouvert', en_cours: 'En cours', resolu: 'Résolu', clos: 'Clos',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

function docHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFontSize(16);
  doc.setTextColor(...COLOR_HEADER);
  doc.text(title, 14, 18);

  doc.setFontSize(11);
  doc.text(subtitle, 14, 27);

  doc.setFontSize(9);
  doc.setTextColor(...COLOR_SUB);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, 34);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Export Garanties / SAV ───────────────────────────────────────────────────

export function exportWarrantyClaimsPdf(
  claims: WarrantyClaim[],
  projectName: string,
  getCompanyName: (id: string | null) => string,
): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  docHeader(doc, 'Récapitulatif Garanties / SAV', projectName);

  autoTable(doc, {
    startY: 42,
    head: [['#', 'Titre', 'Type', 'Priorité', 'Statut', 'Signalé le', 'Échéance', 'Entreprise', 'Lot', 'Localisation']],
    body: claims.map((c, i) => [
      i + 1,
      c.title,
      WARRANTY_TYPE_PDF[c.warranty_type] ?? c.warranty_type,
      WARRANTY_PRIORITY_PDF[c.priority] ?? c.priority,
      WARRANTY_STATUS_PDF[c.status] ?? c.status,
      toLocalDate(c.reported_date),
      toLocalDate(c.due_date),
      getCompanyName(c.company_id),
      c.lot ?? '—',
      c.location ?? '—',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: COLOR_BRAND, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR_ROW_ALT },
    columnStyles: { 1: { cellWidth: 50 } },
  });

  doc.save(`garanties-${slugify(projectName)}.pdf`);
}

// ── Export Fiche Projet ──────────────────────────────────────────────────────

const PROJECT_STATUS_PDF: Record<string, string> = {
  etude: 'Étude',
  planification: 'Planification',
  en_cours: 'En cours',
  livre: 'Livré',
  annule: 'Annulé',
};

export function exportProjectSummaryPdf(
  project: Project,
  clientName: string | null,
): void {
  const doc = new jsPDF();
  docHeader(doc, 'Fiche Projet', project.name);

  autoTable(doc, {
    startY: 42,
    body: [
      ['Client', clientName ?? '—'],
      ['Statut', PROJECT_STATUS_PDF[project.status] ?? project.status],
      ['Adresse', project.address ?? '—'],
      ['Début', toLocalDate(project.start_date)],
      ['Fin prévue', toLocalDate(project.end_date_planned)],
      ['Budget', project.budget != null ? `${project.budget.toLocaleString('fr-FR')} €` : '—'],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40, fillColor: COLOR_ROW_ALT, textColor: COLOR_HEADER },
    },
    styles: { fontSize: 10 },
    theme: 'grid',
  });

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (project.description) {
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_HEADER);
    doc.text('Description', 14, finalY);
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_SUB);
    const lines = doc.splitTextToSize(project.description, 180) as string[];
    doc.text(lines, 14, finalY + 6);
  }

  doc.save(`projet-${slugify(project.name)}.pdf`);
}
