import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { LazyRoute as Lazy } from '@/app/LazyRoute';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/modules/auth/LoginPage';
import { RegisterPage } from '@/modules/auth/RegisterPage';
import { ForgotPasswordPage } from '@/modules/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/modules/auth/ResetPasswordPage';
import { ProjectLayout } from '@/modules/projects/ProjectLayout';
import { ProjectOverviewPage } from '@/modules/projects/ProjectOverviewPage';
import { NotFoundPage } from '@/modules/misc/NotFoundPage';

// Chargement différé (route-level code-splitting) : chaque page ci-dessous
// part dans son propre chunk JS, téléchargé seulement à la navigation vers
// sa route. Réduit le bundle initial (cf. audit du 26/06/2026, section
// Performance — bundle principal ~6 Mo / 1,07 Mo gzip sans aucun split).
// Restent en chargement immédiat (eager) : les pages d'auth (premier écran
// vu par tout visiteur), AppShell/ProjectLayout (coquille toujours montée),
// et ProjectOverviewPage (premier onglet affiché par défaut sur un projet).
const DashboardPage = lazy(() =>
  import('@/modules/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ProjectsListPage = lazy(() =>
  import('@/modules/projects/ProjectsListPage').then((m) => ({ default: m.ProjectsListPage }))
);
const ProjectMembersPage = lazy(() =>
  import('@/modules/projects/ProjectMembersPage').then((m) => ({ default: m.ProjectMembersPage }))
);
const ClientsPage = lazy(() => import('@/modules/clients/ClientsPage').then((m) => ({ default: m.ClientsPage })));
const CompaniesPage = lazy(() =>
  import('@/modules/companies/CompaniesPage').then((m) => ({ default: m.CompaniesPage }))
);
const SettingsPage = lazy(() =>
  import('@/modules/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

// Les 17 onglets projet : un chunk par onglet (cf. src/modules/projects/pages/*).
const ProjectTasksPage = lazy(() => import('@/modules/projects/pages/ProjectTasksPage'));
const ProjectGanttPage = lazy(() => import('@/modules/projects/pages/ProjectGanttPage'));
const ProjectDocumentsPage = lazy(() => import('@/modules/projects/pages/ProjectDocumentsPage'));
const ProjectPlansAnd3dPage = lazy(() => import('@/modules/projects/pages/ProjectPlansAnd3dPage'));
const ProjectSuppliesPage = lazy(() => import('@/modules/projects/pages/ProjectSuppliesPage'));
const ProjectIncidentsPage = lazy(() => import('@/modules/projects/pages/ProjectIncidentsPage'));
const ProjectPunchListPage = lazy(() => import('@/modules/projects/pages/ProjectPunchListPage'));
const ProjectDailyLogsPage = lazy(() => import('@/modules/projects/pages/ProjectDailyLogsPage'));
const ProjectMeetingReportsPage = lazy(() => import('@/modules/projects/pages/ProjectMeetingReportsPage'));
const ProjectSecurityPage = lazy(() => import('@/modules/projects/pages/ProjectSecurityPage'));
const ProjectDoePage = lazy(() => import('@/modules/projects/pages/ProjectDoePage'));
const ProjectBudgetPage = lazy(() => import('@/modules/projects/pages/ProjectBudgetPage'));
const ProjectRfisPage = lazy(() => import('@/modules/projects/pages/ProjectRfisPage'));
const ProjectChangeOrdersPage = lazy(() => import('@/modules/projects/pages/ProjectChangeOrdersPage'));
const ProjectTimeEntriesPage = lazy(() => import('@/modules/projects/pages/ProjectTimeEntriesPage'));
const ProjectClientPortalPage = lazy(() => import('@/modules/projects/pages/ProjectClientPortalPage'));
const ProjectBillingPage = lazy(() => import('@/modules/projects/pages/ProjectBillingPage'));
const ProjectQualityPage = lazy(() => import('@/modules/projects/pages/ProjectQualityPage'));
const ProjectMessagingPage = lazy(() => import('@/modules/projects/pages/ProjectMessagingPage'));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        handle: { title: 'Tableau de bord' },
        element: (
          <Lazy>
            <DashboardPage />
          </Lazy>
        ),
      },
      {
        path: 'projects',
        handle: { title: 'Projets' },
        element: (
          <Lazy>
            <ProjectsListPage />
          </Lazy>
        ),
      },
      {
        path: 'projects/:projectId',
        handle: { title: 'Projet' },
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectOverviewPage /> },
          {
            path: 'tasks',
            element: (
              <Lazy>
                <ProjectTasksPage />
              </Lazy>
            ),
          },
          {
            path: 'gantt',
            element: (
              <Lazy>
                <ProjectGanttPage />
              </Lazy>
            ),
          },
          {
            path: 'documents',
            element: (
              <Lazy>
                <ProjectDocumentsPage />
              </Lazy>
            ),
          },
          {
            path: 'plans',
            element: (
              <Lazy>
                <ProjectPlansAnd3dPage />
              </Lazy>
            ),
          },
          {
            path: 'supplies',
            element: (
              <Lazy>
                <ProjectSuppliesPage />
              </Lazy>
            ),
          },
          {
            path: 'daily-logs',
            element: (
              <Lazy>
                <ProjectDailyLogsPage />
              </Lazy>
            ),
          },
          {
            path: 'budget',
            element: (
              <Lazy>
                <ProjectBudgetPage />
              </Lazy>
            ),
          },
          {
            path: 'rfis',
            element: (
              <Lazy>
                <ProjectRfisPage />
              </Lazy>
            ),
          },
          {
            path: 'change-orders',
            element: (
              <Lazy>
                <ProjectChangeOrdersPage />
              </Lazy>
            ),
          },
          {
            path: 'billing',
            element: (
              <Lazy>
                <ProjectBillingPage />
              </Lazy>
            ),
          },
          {
            path: 'time-entries',
            element: (
              <Lazy>
                <ProjectTimeEntriesPage />
              </Lazy>
            ),
          },
          {
            path: 'client-portal',
            element: (
              <Lazy>
                <ProjectClientPortalPage />
              </Lazy>
            ),
          },
          {
            path: 'incidents',
            element: (
              <Lazy>
                <ProjectIncidentsPage />
              </Lazy>
            ),
          },
          {
            path: 'punchlist',
            element: (
              <Lazy>
                <ProjectPunchListPage />
              </Lazy>
            ),
          },
          {
            path: 'doe',
            element: (
              <Lazy>
                <ProjectDoePage />
              </Lazy>
            ),
          },
          {
            path: 'meeting-reports',
            element: (
              <Lazy>
                <ProjectMeetingReportsPage />
              </Lazy>
            ),
          },
          {
            path: 'security',
            element: (
              <Lazy>
                <ProjectSecurityPage />
              </Lazy>
            ),
          },
          {
            path: 'quality',
            element: (
              <Lazy>
                <ProjectQualityPage />
              </Lazy>
            ),
          },
          {
            path: 'messages',
            element: (
              <Lazy>
                <ProjectMessagingPage />
              </Lazy>
            ),
          },
          {
            path: 'members',
            element: (
              <Lazy>
                <ProjectMembersPage />
              </Lazy>
            ),
          },
        ],
      },
      {
        path: 'clients',
        handle: { title: 'Clients' },
        element: (
          <Lazy>
            <ClientsPage />
          </Lazy>
        ),
      },
      {
        path: 'companies',
        handle: { title: 'Entreprises' },
        element: (
          <Lazy>
            <CompaniesPage />
          </Lazy>
        ),
      },
      {
        path: 'settings',
        handle: { title: 'Paramètres', showBack: true },
        element: (
          <Lazy>
            <SettingsPage />
          </Lazy>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
