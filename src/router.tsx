import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import ClientsPage from './pages/ClientsPage';
import FinancesPage from './pages/FinancesPage';
import AgentsPage from './pages/AgentsPage';
import TimePage from './pages/TimePage';
import ReportsPage from './pages/ReportsPage';
import NotFoundPage from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/tasks', element: <TasksPage /> },
      { path: '/clients', element: <ClientsPage /> },
      { path: '/finances', element: <FinancesPage /> },
      { path: '/agents', element: <AgentsPage /> },
      { path: '/time', element: <TimePage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
