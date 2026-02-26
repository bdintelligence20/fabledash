import { Link, useNavigate } from 'react-router-dom';
import { Home, CheckSquare, UserCircle, Sparkles, ArrowLeft } from 'lucide-react';

const quickLinks = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/clients', label: 'Clients', icon: UserCircle },
  { to: '/opsai', label: 'OpsAI', icon: Sparkles },
];

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Branding */}
      <h1 className="text-2xl font-bold mb-2">
        <span className="text-primary-600">Fable</span>
        <span className="text-surface-400">Dash</span>
      </h1>

      {/* 404 hero */}
      <p className="text-8xl font-bold text-surface-200 mt-4">404</p>
      <p className="mt-4 text-xl font-semibold text-surface-700">Page Not Found</p>
      <p className="mt-2 text-sm text-surface-500 max-w-md">
        The page you're looking for doesn't exist or has been moved. Try one of the links below to get back on track.
      </p>

      {/* Quick links */}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {quickLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2 px-4 py-2 bg-surface-50 text-surface-700 rounded-lg border border-surface-200 hover:bg-surface-100 hover:border-surface-300 transition-colors text-sm font-medium"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>

      {/* Go back button */}
      <button
        onClick={() => navigate(-1)}
        className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        Go Back
      </button>
    </div>
  );
}
