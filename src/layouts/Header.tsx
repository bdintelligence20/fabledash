import { Menu, Search, Bell } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';

interface HeaderProps {
  onMobileMenuOpen: () => void;
}

export default function Header({ onMobileMenuOpen }: HeaderProps) {
  return (
    <header className="bg-white border-b border-surface-200 px-6 py-3 flex items-center gap-4">
      {/* Mobile hamburger */}
      <button
        onClick={onMobileMenuOpen}
        className="md:hidden p-1.5 text-surface-600 hover:text-surface-900 hover:bg-surface-50 rounded-lg transition-default"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumbs */}
      <Breadcrumbs />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search input */}
      <div className="hidden sm:flex items-center relative max-w-xs">
        <Search className="absolute left-3 h-4 w-4 text-surface-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search..."
          className="w-full py-1.5 pl-9 pr-3 text-sm rounded-lg border border-surface-200 bg-surface-50 text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-default"
        />
      </div>

      {/* Notification bell */}
      <button
        className="relative p-2 text-surface-500 hover:text-surface-700 hover:bg-surface-50 rounded-lg transition-default"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {/* Unread indicator dot — always shown as placeholder */}
        <span className="absolute -top-1 -right-1 h-2 w-2 bg-danger-500 rounded-full" />
      </button>
    </header>
  );
}
