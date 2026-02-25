import { NavLink } from 'react-router-dom';
import {
  Home,
  CheckSquare,
  UserCircle,
  DollarSign,
  Bot,
  Clock,
  BarChart2,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: Home }],
  },
  {
    label: 'Manage',
    items: [
      { to: '/clients', label: 'Clients', icon: UserCircle },
      { to: '/tasks', label: 'Tasks', icon: CheckSquare },
      { to: '/time', label: 'Time', icon: Clock },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/finances', label: 'Finances', icon: DollarSign },
      { to: '/agents', label: 'AI Agents', icon: Bot },
      { to: '/reports', label: 'Reports', icon: BarChart2 },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMobileClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();

  const displayName = user?.displayName || user?.email || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const handleNavClick = () => {
    // Close mobile nav when a link is clicked
    onMobileClose?.();
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-surface-200">
      {/* Brand area */}
      <div className={`border-b border-surface-200 flex items-center ${collapsed ? 'justify-center px-2 py-5' : 'px-6 py-5'}`}>
        {collapsed ? (
          <span className="text-xl font-bold text-primary-600">F</span>
        ) : (
          <div>
            <h1 className="text-xl font-bold">
              <span className="text-primary-600">Fable</span>
              <span className="text-surface-400">Dash</span>
            </h1>
            <p className="text-xs text-surface-400">Operations Intelligence</p>
          </div>
        )}
      </div>

      {/* Main navigation — scrollable middle */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 px-4 pt-4 pb-2">
                {section.label}
              </p>
            )}
            {collapsed && <div className="pt-3" />}
            <ul className="space-y-0.5 px-2">
              {section.items.map(({ to, label, icon: Icon, badge }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={handleNavClick}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 py-2.5 rounded-r-lg text-sm transition-default',
                        collapsed ? 'justify-center px-2' : 'px-4',
                        isActive
                          ? 'bg-primary-50 text-primary-600 font-semibold border-l-3 border-primary-500'
                          : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900',
                      ].join(' ')
                    }
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{label}</span>}
                    {!collapsed && badge !== undefined && badge > 0 && (
                      <span className="ml-auto bg-danger-100 text-danger-600 text-xs font-medium rounded-full px-2 py-0.5">
                        {badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-2 border-t border-surface-200">
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center w-full py-2 text-surface-400 hover:text-surface-600 hover:bg-surface-50 rounded-lg transition-default"
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* User footer */}
      <div className={`border-t border-surface-200 ${collapsed ? 'px-2 py-3' : 'px-4 py-3'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div
            className="flex-shrink-0 h-9 w-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-semibold"
            title={collapsed ? displayName : undefined}
          >
            {initial}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 truncate">
                  {displayName}
                </p>
                {user?.email && user.displayName && (
                  <p className="text-xs text-surface-500 truncate">{user.email}</p>
                )}
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="flex-shrink-0 p-1.5 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-100 transition-default"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
