import { Spinner } from './Spinner';

export function LoadingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 gap-4">
      <Spinner size="lg" />
      <p className="text-surface-600 text-sm font-medium">Loading FableDash...</p>
    </div>
  );
}
