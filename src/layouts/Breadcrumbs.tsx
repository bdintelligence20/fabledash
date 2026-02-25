import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clients',
  '/tasks': 'Tasks',
  '/finances': 'Finances',
  '/agents': 'AI Agents',
  '/time': 'Time Tracking',
  '/reports': 'Reports',
};

interface Breadcrumb {
  label: string;
  path: string;
}

export default function Breadcrumbs() {
  const location = useLocation();
  const pathname = location.pathname;

  // Build breadcrumb trail
  const crumbs: Breadcrumb[] = [];

  if (pathname === '/') {
    // On dashboard, just show "Dashboard" as current
    crumbs.push({ label: 'Dashboard', path: '/' });
  } else {
    // Always start with Home
    crumbs.push({ label: 'Home', path: '/' });

    // Split path and build intermediate + final crumbs
    const segments = pathname.split('/').filter(Boolean);
    let currentPath = '';

    for (const segment of segments) {
      currentPath += `/${segment}`;
      const label = routeLabels[currentPath] || segment;
      crumbs.push({ label, path: currentPath });
    }
  }

  return (
    <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-sm">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const isFirst = index === 0;

        return (
          <span key={crumb.path} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="text-surface-300 h-4 w-4 flex-shrink-0" />
            )}
            {isLast ? (
              <span className="text-surface-900 font-medium flex items-center gap-1.5">
                {isFirst && crumbs.length === 1 && (
                  <Home className="h-4 w-4" />
                )}
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="text-surface-500 hover:text-primary-600 transition-default flex items-center gap-1.5"
              >
                {isFirst && <Home className="h-4 w-4" />}
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
