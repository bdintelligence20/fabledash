import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Task, TaskStatus } from './ClientTypes';

interface KanbanViewProps {
  clientId: number;
}

const KanbanView = ({ clientId }: KanbanViewProps) => {
  const [kanbanData, setKanbanData] = useState<{ status: TaskStatus; tasks: Task[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  
  // Fetch kanban data
  useEffect(() => {
    fetchKanbanData();
  }, [clientId]);
  
  const fetchKanbanData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const url = clientId 
        ? `${apiUrl}/tasks/kanban?client_id=${clientId}` 
        : `${apiUrl}/tasks/kanban`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setKanbanData(data.kanban);
      } else {
        setError(data.message || 'Failed to fetch kanban data');
      }
    } catch (error) {
      console.error("Error fetching kanban data:", error);
      setError('Network error while fetching kanban data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };
  
  // Render a task card
  const renderTaskCard = (task: Task) => {
    return (
      <div 
        key={task.id} 
        className="bg-white p-3 rounded-lg shadow-sm mb-2 border-l-4"
        style={{ borderLeftColor: task.status_color || '#e5e7eb' }}
      >
        <h4 className="font-medium text-sm mb-1">{task.title}</h4>
        
        {task.description && (
          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.description}</p>
        )}
        
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>{task.client_name}</span>
          {task.due_date && <span>Due: {formatDate(task.due_date)}</span>}
        </div>
      </div>
    );
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <div className="flex items-center mb-4">
        <h2 className="text-lg font-medium">Kanban Board</h2>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {kanbanData.map(column => (
            <div key={column.status.id} className="bg-gray-50 rounded-lg p-3">
              <div 
                className="flex justify-between items-center mb-3 pb-2 border-b"
                style={{ borderBottomColor: column.status.color || '#e5e7eb' }}
              >
                <h3 
                  className="font-medium text-sm"
                  style={{ color: column.status.color || '#374151' }}
                >
                  {column.status.name}
                </h3>
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                  {column.tasks.length}
                </span>
              </div>
              
              <div className="space-y-2 min-h-[100px]">
                {column.tasks.length > 0 ? (
                  column.tasks.map(task => renderTaskCard(task))
                ) : (
                  <div className="text-center py-4 text-sm text-gray-500">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KanbanView;
