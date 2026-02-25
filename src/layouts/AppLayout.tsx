import { Outlet, NavLink } from 'react-router-dom';
import {
  Home,
  CheckSquare,
  UserCircle,
  DollarSign,
  Bot,
  Clock,
  BarChart2,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/clients', label: 'Clients', icon: UserCircle },
  { to: '/finances', label: 'Finances', icon: DollarSign },
  { to: '/agents', label: 'AI Agents', icon: Bot },
  { to: '/time', label: 'Time', icon: Clock },
  { to: '/reports', label: 'Reports', icon: BarChart2 },
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  const displayName = user?.displayName || user?.email || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white border-r border-gray-200">
        {/* Brand */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary-600">FableDash</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info & sign out */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-9 w-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-semibold">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {displayName}
              </p>
              {user?.email && user.displayName && (
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              )}
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
