import { createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import FinancesPage from './pages/FinancesPage';
import AgentsPage from './pages/AgentsPage';
import TimePage from './pages/TimePage';
import TimeLogListPage from './pages/TimeLogListPage';
import ReportsPage from './pages/ReportsPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';

export const router = createBrowserRouter([
  // Public route
  { path: '/login', element: <LoginPage /> },

  // Protected routes — ProtectedRoute checks auth, AppLayout provides shell
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/tasks', element: <TasksPage /> },
          { path: '/clients', element: <ClientsPage /> },
          { path: '/clients/:clientId', element: <ClientDetailPage /> },
          { path: '/finances', element: <FinancesPage /> },
          { path: '/agents', element: <AgentsPage /> },
          { path: '/time', element: <TimePage /> },
          { path: '/time/logs', element: <TimeLogListPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
