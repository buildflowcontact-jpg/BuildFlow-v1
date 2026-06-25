import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Découpage manuel des chunks vendor.
// Objectif : isoler les dépendances tierces par "taux de churn" (à quelle
// fréquence elles changent) plutôt que de tout mélanger dans un seul fichier.
// Avantage pour la suite du projet : quand on livre une mise à jour qui ne
// touche qu'au code applicatif (src/), les chunks vendor ci-dessous restent
// identiques d'un build à l'autre → le navigateur des utilisateurs les garde
// en cache et ne retélécharge que le code qui a réellement changé.
//
// Les dépendances lourdes utilisées uniquement pour les exports (jsPDF,
// jspdf-autotable, JSZip, html2canvas, dompurify) ne sont volontairement PAS
// listées ici : elles sont chargées via des import() dynamiques dans
// pdfExport.service.ts / projectExport.service.ts (voir ces fichiers), donc
// Rollup les place déjà dans leurs propres chunks asynchrones, téléchargés
// uniquement au moment d'un export. Les ajouter ici les ferait remonter dans
// le bundle initial — l'inverse de ce qu'on veut.
//
// En ajoutant une nouvelle dépendance tierce, demande-toi : "est-ce que je
// l'utilise dès le chargement de l'app (vendor-*) ou seulement dans un flux
// secondaire/à la demande (laisser le code-splitting automatique / import()
// dynamique s'en occuper) ?"
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;

  if (/node_modules\/(react|react-dom|react-router-dom|scheduler)\//.test(id)) {
    return 'vendor-react';
  }
  if (/node_modules\/(@supabase|@tanstack)\//.test(id)) {
    return 'vendor-data';
  }
  if (/node_modules\/(lucide-react|motion|clsx|date-fns|zustand)\//.test(id)) {
    return 'vendor-ui';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
