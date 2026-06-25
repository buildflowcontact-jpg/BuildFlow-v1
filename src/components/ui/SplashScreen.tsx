/**
 * Écran de lancement affiché pendant l'initialisation de l'application
 * (vérification de session, chargement du profil/organisation). Visuellement
 * cohérent avec le splash statique défini dans index.html (affiché avant même
 * le chargement du bundle JS) afin d'éviter tout effet de flash au montage de React.
 */
export function SplashScreen({ label = 'Chargement de BuildFlow…' }: { label?: string }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-indigo-50 via-violet-50 to-blue-50">
      <img src="/logo-icon-square.png" alt="BuildFlow" className="h-16 w-16 drop-shadow-lg" />
      <p className="text-lg font-semibold tracking-tight text-slate-800">BuildFlow</p>
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
