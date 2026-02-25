import { useParams } from 'react-router-dom';

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface-900">Task Detail</h1>
      <p className="mt-2 text-surface-600">
        Viewing task <span className="font-mono text-sm">{taskId}</span>. Full detail view coming soon.
      </p>
    </div>
  );
}
