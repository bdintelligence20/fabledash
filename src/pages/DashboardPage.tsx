import { useState } from 'react';
import { format } from 'date-fns';
import { BarChart2 } from 'lucide-react';
import { Card, Tabs } from '../components/ui';
import { MetricRow, RecentActivity, AlertsPanel, QuickActions } from '../components/dashboard';

const revenueTabs = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'ytd', label: 'YTD' },
];

export default function DashboardPage() {
  const [activeRevenueTab, setActiveRevenueTab] = useState('monthly');
  const today = format(new Date(), 'EEEE, d MMM yyyy');

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between animate-up">
        <div>
          <h1 className="text-2xl font-bold text-heading">Dashboard</h1>
          <p className="text-body mt-1">
            Welcome back. Here's your business at a glance.
          </p>
        </div>
        <p className="text-sm text-surface-500 hidden sm:block">{today}</p>
      </div>

      {/* Metric row */}
      <div className="mt-6 animate-up" style={{ animationDelay: '100ms' }}>
        <MetricRow />
      </div>

      {/* Main content grid */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 animate-up"
        style={{ animationDelay: '200ms' }}
      >
        {/* Left column — recent activity */}
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>

        {/* Right column — alerts + quick actions */}
        <div className="lg:col-span-1 space-y-6">
          <AlertsPanel />
          <QuickActions />
        </div>
      </div>

      {/* Bottom section — revenue chart placeholder */}
      <div className="mt-6 animate-up" style={{ animationDelay: '300ms' }}>
        <Card padding="none">
          <Card.Header className="flex items-center justify-between">
            <h3 className="text-heading text-base">Revenue Overview</h3>
            <Tabs
              tabs={revenueTabs}
              activeTab={activeRevenueTab}
              onChange={setActiveRevenueTab}
              variant="pills"
            />
          </Card.Header>
          <Card.Body className="flex flex-col items-center justify-center min-h-[300px]">
            <BarChart2 className="h-16 w-16 text-surface-300" />
            <p className="mt-4 text-surface-400 text-sm">
              Chart visualization coming in Phase 7
            </p>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
