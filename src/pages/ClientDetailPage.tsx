import { useParams } from 'react-router-dom';

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface-900">Client Detail</h1>
      <p className="mt-2 text-surface-500">
        Client <span className="font-mono text-surface-700">{clientId}</span> — Coming Soon
      </p>
    </div>
  );
}
