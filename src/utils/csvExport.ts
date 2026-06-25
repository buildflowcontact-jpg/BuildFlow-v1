/**
 * Génère un fichier CSV (compatible Excel, séparateur point-virgule + BOM UTF-8
 * pour un affichage correct des accents dans Excel) à partir d'en-têtes et de
 * lignes déjà formatées en chaînes de caractères.
 */
function toCsvCell(value: string): string {
  // Neutralise l'injection de formule (CSV/Excel) : si une valeur commence par
  // =, +, -, @ ou une tabulation, Excel/LibreOffice peut l'interpréter comme
  // une formule à l'ouverture du fichier (ex. =HYPERLINK(...) pointant vers un
  // site malveillant). On préfixe d'une apostrophe pour forcer une lecture en
  // texte brut — sans incidence visuelle, l'apostrophe n'apparaît pas dans la
  // cellule une fois le fichier ouvert dans un tableur.
  const safeValue = /^[=+\-@\t]/.test(value) ? `'${value}` : value;
  if (/[;"\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(toCsvCell).join(';'));
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
