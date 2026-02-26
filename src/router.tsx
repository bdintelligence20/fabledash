import { createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import FinancesPage from './pages/FinancesPage';
import FinancialOverviewPage from './pages/FinancialOverviewPage';
import CostBenefitPage from './pages/CostBenefitPage';
import VolumeRatePage from './pages/VolumeRatePage';
import RevenueTrackingPage from './pages/RevenueTrackingPage';
import CashPositionPage from './pages/CashPositionPage';
import AgentsPage from './pages/AgentsPage';
import AgentDetailPage from './pages/AgentDetailPage';
import AgentChatPage from './pages/AgentChatPage';
import OpsAIPage from './pages/OpsAIPage';
import MeetingsPage from './pages/MeetingsPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import TimePage from './pages/TimePage';
import TimeLogListPage from './pages/TimeLogListPage';
import TimeAllocationPage from './pages/TimeAllocationPage';
import UtilizationPage from './pages/UtilizationPage';
import ReportsPage from './pages/ReportsPage';
import ComparisonReportPage from './pages/ComparisonReportPage';
import HealthReportPage from './pages/HealthReportPage';
import IntegrationsPage from './pages/IntegrationsPage';
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
          { path: '/tasks/:taskId', element: <TaskDetailPage /> },
          { path: '/clients', element: <ClientsPage /> },
          { path: '/clients/:clientId', element: <ClientDetailPage /> },
          { path: '/finances', element: <FinancesPage /> },
          { path: '/finances/overview', element: <FinancialOverviewPage /> },
          { path: '/finances/revenue', element: <RevenueTrackingPage /> },
          { path: '/finances/cost-benefit', element: <CostBenefitPage /> },
          { path: '/finances/volume-rate', element: <VolumeRatePage /> },
          { path: '/finances/cash', element: <CashPositionPage /> },
          { path: '/agents', element: <AgentsPage /> },
          { path: '/agents/:agentId', element: <AgentDetailPage /> },
          { path: '/agents/:agentId/chat/:conversationId', element: <AgentChatPage /> },
          { path: '/opsai', element: <OpsAIPage /> },
          { path: '/meetings', element: <MeetingsPage /> },
          { path: '/meetings/:meetingId', element: <MeetingDetailPage /> },
          { path: '/time', element: <TimePage /> },
          { path: '/time/logs', element: <TimeLogListPage /> },
          { path: '/time/allocation', element: <TimeAllocationPage /> },
          { path: '/time/utilization', element: <UtilizationPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/reports/comparison', element: <ComparisonReportPage /> },
          { path: '/reports/health', element: <HealthReportPage /> },
          { path: '/integrations', element: <IntegrationsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
