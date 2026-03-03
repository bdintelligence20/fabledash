import { X } from 'lucide-react';
import Sidebar from './Sidebar';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
}

export default function MobileNav({ isOpen, onClose, sidebarCollapsed, onSidebarToggle }: MobileNavProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-72 z-50 shadow-strong transform transition-transform duration-300 md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#0D1117' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg transition-default z-10"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Sidebar content (always expanded in mobile drawer) */}
        <Sidebar
          collapsed={false}
          onToggle={onSidebarToggle}
          onMobileClose={onClose}
        />
      </div>
    </>
  );
}
