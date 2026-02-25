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

/** Routes with dynamic child segments (e.g. /clients/:id). Final crumb shows "Detail". */
const dynamicParentRoutes = new Set(['/clients', '/tasks']);

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

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;

      if (routeLabels[currentPath]) {
        // Known route — use static label
        crumbs.push({ label: routeLabels[currentPath], path: currentPath });
      } else {
        // Dynamic segment (e.g. a Firestore document ID)
        const parentPath = '/' + segments.slice(0, i).join('/');
        const label = dynamicParentRoutes.has(parentPath) ? 'Detail' : segment.slice(0, 8);
        crumbs.push({ label, path: currentPath });
      }
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
