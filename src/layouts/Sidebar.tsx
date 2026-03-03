import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  ChevronDown,
  MessageSquare,
  Sparkles,
  Plug,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface SubNavItem {
  to: string;
  label: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  highlight?: boolean;
  subItems?: SubNavItem[];
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
      {
        to: '/time',
        label: 'Time',
        icon: Clock,
        subItems: [
          { to: '/time', label: 'Log Time' },
          { to: '/time/logs', label: 'Time Logs' },
          { to: '/time/allocation', label: 'Allocation' },
          { to: '/time/utilization', label: 'Utilization' },
        ],
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/opsai', label: 'OpsAI', icon: Sparkles, highlight: true },
      {
        to: '/finances',
        label: 'Finances',
        icon: DollarSign,
        subItems: [
          { to: '/finances/overview', label: 'Financial Overview' },
          { to: '/finances/revenue', label: 'Revenue' },
          { to: '/finances/cost-benefit', label: 'Cost-Benefit' },
          { to: '/finances/cash', label: 'Cash Position' },
          { to: '/finances/volume-rate', label: 'Volume vs Rate' },
          { to: '/finances', label: 'Data Sources' },
        ],
      },
      { to: '/meetings', label: 'Meetings', icon: MessageSquare },
      { to: '/agents', label: 'AI Agents', icon: Bot },
      {
        to: '/reports',
        label: 'Reports',
        icon: BarChart2,
        subItems: [
          { to: '/reports/health', label: 'Health & Vitality' },
          { to: '/reports/comparison', label: 'Period Comparison' },
        ],
      },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/integrations', label: 'Integrations', icon: Plug }],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMobileClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const displayName = user?.displayName || user?.email || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const initialExpanded = new Set<string>();
  if (location.pathname.startsWith('/finances')) initialExpanded.add('/finances');
  if (location.pathname.startsWith('/reports')) initialExpanded.add('/reports');
  if (location.pathname.startsWith('/time')) initialExpanded.add('/time');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(initialExpanded);

  const toggleExpanded = (to: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(to)) next.delete(to);
      else next.add(to);
      return next;
    });
  };

  const handleNavClick = () => {
    onMobileClose?.();
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'linear-gradient(180deg, #0D1117 0%, #0B0F18 100%)' }}
    >
      {/* Brand */}
      <div
        className={`flex items-center border-b shrink-0 ${
          collapsed ? 'justify-center px-2 py-5' : 'px-5 py-5'
        }`}
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {collapsed ? (
          <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <span className="text-white text-base font-bold">F</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">F</span>
            </div>
            <div>
              <p className="text-white font-bold text-base leading-none tracking-tight">
                FableDash
              </p>
              <p
                className="text-[10px] mt-0.5"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Operations Intelligence
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {navSections.map((section) => (
          <div key={section.label} className="mb-1">
            {!collapsed && (
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.14em] px-4 pt-4 pb-1.5"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                {section.label}
              </p>
            )}
            {collapsed && <div className="pt-3" />}
            <ul className="space-y-0.5 px-2">
              {section.items.map(({ to, label, icon: Icon, badge, highlight, subItems }) => {
                const hasSubItems = subItems && subItems.length > 0;
                const isExpanded = expandedItems.has(to);
                const isParentActive = hasSubItems && location.pathname.startsWith(to);

                return (
                  <li key={to}>
                    {hasSubItems && !collapsed ? (
                      <button
                        onClick={() => toggleExpanded(to)}
                        className="flex items-center gap-2.5 py-2 rounded-lg text-sm w-full text-left px-3 transition-all duration-150"
                        style={
                          isParentActive
                            ? { background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600 }
                            : { color: 'rgba(255,255,255,0.5)' }
                        }
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span>{label}</span>
                        <ChevronDown
                          className={[
                            'ml-auto h-3.5 w-3.5 transition-transform duration-200',
                            isExpanded ? 'rotate-180' : '',
                          ].join(' ')}
                        />
                      </button>
                    ) : (
                      <NavLink
                        to={to}
                        end={to === '/' || (hasSubItems && !collapsed)}
                        onClick={handleNavClick}
                        title={collapsed ? label : undefined}
                        className={({ isActive }) => {
                          const active = isActive || (collapsed && isParentActive);
                          const baseClasses = [
                            'flex items-center gap-2.5 py-2 rounded-lg text-sm transition-all duration-150',
                            collapsed ? 'justify-center px-2' : 'px-3',
                          ].join(' ');
                          return baseClasses;
                        }}
                        style={({ isActive }) => {
                          const active = isActive || (collapsed && isParentActive);
                          if (active) {
                            return {
                              background: 'rgba(255,255,255,0.1)',
                              color: '#ffffff',
                              fontWeight: 600,
                            };
                          }
                          if (highlight) {
                            return {
                              background: 'rgba(101,113,245,0.18)',
                              color: 'rgba(185,192,255,1)',
                              fontWeight: 500,
                            };
                          }
                          return { color: 'rgba(255,255,255,0.5)' };
                        }}
                      >
                        <Icon
                          className={`flex-shrink-0 ${collapsed ? 'h-5 w-5' : 'h-4 w-4'}`}
                        />
                        {!collapsed && <span>{label}</span>}
                        {!collapsed && badge !== undefined && badge > 0 && (
                          <span
                            className="ml-auto text-xs font-medium rounded-full px-1.5 py-0.5"
                            style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}
                          >
                            {badge}
                          </span>
                        )}
                      </NavLink>
                    )}

                    {hasSubItems && isExpanded && !collapsed && (
                      <ul className="mt-0.5 mb-1 space-y-0.5 pl-2">
                        {subItems!.map((sub) => (
                          <li key={sub.to}>
                            <NavLink
                              to={sub.to}
                              end
                              onClick={handleNavClick}
                              className="flex items-center py-1.5 pl-7 pr-3 rounded-lg text-xs transition-all duration-150"
                              style={({ isActive }) =>
                                isActive
                                  ? { color: '#a5afff', fontWeight: 600 }
                                  : { color: 'rgba(255,255,255,0.35)' }
                              }
                            >
                              {sub.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div
        className="px-2 py-2 border-t shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center w-full py-2 rounded-lg transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* User footer */}
      <div
        className={`border-t shrink-0 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className={`flex items-center rounded-xl p-2 ${collapsed ? 'justify-center' : 'gap-2.5'}`}
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <div
            className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center text-sm font-bold text-white"
            title={collapsed ? displayName : undefined}
          >
            {initial}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  {displayName}
                </p>
                {user?.email && user.displayName && (
                  <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {user.email}
                  </p>
                )}
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-150"
                style={{ color: 'rgba(255,255,255,0.3)' }}
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
