import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/modules/auth/LoginPage';
import { RegisterPage } from '@/modules/auth/RegisterPage';
import { ForgotPasswordPage } from '@/modules/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/modules/auth/ResetPasswordPage';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';
import { ProjectsListPage } from '@/modules/projects/ProjectsListPage';
import { ProjectLayout } from '@/modules/projects/ProjectLayout';
import { ProjectOverviewPage } from '@/modules/projects/ProjectOverviewPage';
import { ProjectMembersPage } from '@/modules/projects/ProjectMembersPage';
import {
  ProjectTasksPage,
  ProjectGanttPage,
  ProjectDocumentsPage,
  ProjectPlansAnd3dPage,
  ProjectSuppliesPage,
  ProjectIncidentsPage,
  ProjectPunchListPage,
  ProjectDailyLogsPage,
  ProjectBudgetPage,
  ProjectRfisPage,
  ProjectChangeOrdersPage,
  ProjectTimeEntriesPage,
  ProjectClientPortalPage,
} from '@/modules/projects/projectSectionPages';
import { ClientsPage } from '@/modules/clients/ClientsPage';
import { CompaniesPage } from '@/modules/companies/CompaniesPage';
import { SettingsPage } from '@/modules/settings/SettingsPage';
import { NotFoundPage } from '@/modules/misc/NotFoundPage';

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
      { index: true, handle: { title: 'Tableau de bord' }, element: <DashboardPage /> },
      { path: 'projects', handle: { title: 'Projets' }, element: <ProjectsListPage /> },
      {
        path: 'projects/:projectId',
        handle: { title: 'Projet' },
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectOverviewPage /> },
          { path: 'tasks', element: <ProjectTasksPage /> },
          { path: 'gantt', element: <ProjectGanttPage /> },
          { path: 'documents', element: <ProjectDocumentsPage /> },
          { path: 'plans', element: <ProjectPlansAnd3dPage /> },
          { path: 'supplies', element: <ProjectSuppliesPage /> },
          { path: 'daily-logs', element: <ProjectDailyLogsPage /> },
          { path: 'budget', element: <ProjectBudgetPage /> },
          { path: 'rfis', element: <ProjectRfisPage /> },
          { path: 'change-orders', element: <ProjectChangeOrdersPage /> },
          { path: 'time-entries', element: <ProjectTimeEntriesPage /> },
          { path: 'client-portal', element: <ProjectClientPortalPage /> },
          { path: 'incidents', element: <ProjectIncidentsPage /> },
          { path: 'punchlist', element: <ProjectPunchListPage /> },
          { path: 'members', element: <ProjectMembersPage /> },
        ],
      },
      { path: 'clients', handle: { title: 'Clients' }, element: <ClientsPage /> },
      { path: 'companies', handle: { title: 'Entreprises' }, element: <CompaniesPage /> },
      { path: 'settings', handle: { title: 'Paramètres', showBack: true }, element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
