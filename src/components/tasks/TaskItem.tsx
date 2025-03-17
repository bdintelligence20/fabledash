import { useState } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { Task, TaskStatus, Client } from '../clients/ClientTypes';

interface TaskItemProps {
  task: Task;
  statuses: TaskStatus[];
  clients: Client[];
  isLoading: boolean;
  onToggleComplete: (taskId: number, currentStatusId: number) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
  onEdit: (task: Task) => void;
}

const TaskItem = ({ 
  task, 
  statuses, 
  clients,
  isLoading, 
  onToggleComplete, 
  onDelete,
  onEdit
}: TaskItemProps) => {
  // Get status name by ID
  const getStatusName = (statusId: number) => {
    const status = statuses.find(s => s.id === statusId);
    return status ? status.name : 'Unknown';
  };
  
  // Get status color by ID
  const getStatusColor = (statusId: number) => {
    const status = statuses.find(s => s.id === statusId);
    return status ? status.color : '#cccccc';
  };
  
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date set';
    return new Date(dateString).toLocaleDateString();
  };
  
  // Get client name by ID
  const getClientName = (clientId: number | null) => {
    if (!clientId) return 'No client';
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown client';
  };
  
  // Check if task is completed
  const isCompleted = statuses.some(s => 
    s.id === task.status_id && s.name.toLowerCase() === 'completed'
  );
  
  // Check if task is overdue
  const isOverdue = () => {
    if (!task.due_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDueDate = new Date(task.due_date);
    taskDueDate.setHours(0, 0, 0, 0);
    return taskDueDate < today && !isCompleted;
  };
  
  // Get priority color
  const getPriorityColor = (priority: string = 'medium') => {
    switch (priority.toLowerCase()) {
      case 'high':
        return '#ef4444'; // red-500
      case 'medium':
        return '#f59e0b'; // amber-500
      case 'low':
        return '#10b981'; // emerald-500
      default:
        return '#6b7280'; // gray-500
    }
  };
  
  return (
    <div className={`p-4 border-b ${isCompleted ? 'bg-gray-50' : ''} ${isOverdue() ? 'bg-red-50' : ''} hover:bg-gray-100 transition-colors`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <input 
            type="checkbox" 
            className="h-5 w-5 mr-3 mt-1 accent-purple-600" 
            checked={isCompleted}
            onChange={() => onToggleComplete(task.id, task.status_id)}
            disabled={isLoading}
          />
          <div>
            <div className="flex items-center">
              <h3 className={`font-medium ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                {task.title}
              </h3>
              {task.priority && (
                <span 
                  className="ml-2 inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: getPriorityColor(task.priority) }}
                  title={`Priority: ${task.priority}`}
                ></span>
              )}
            </div>
            
            {task.description && (
              <p className={`text-sm ${isCompleted ? 'text-gray-500' : 'text-gray-600'} mt-1 line-clamp-2`}>
                {task.description}
              </p>
            )}
            
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span 
                className="inline-block px-2 py-1 text-xs rounded-full"
                style={{ 
                  backgroundColor: `${getStatusColor(task.status_id)}20`, 
                  color: getStatusColor(task.status_id) 
                }}
              >
                {getStatusName(task.status_id)}
              </span>
              
              <span className="text-xs text-gray-500">
                Client: {getClientName(task.client_id)}
              </span>
              
              {task.due_date && (
                <span className={`text-xs ${isOverdue() ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                  Due: {formatDate(task.due_date)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button 
            className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-200 rounded transition-colors"
            aria-label={`Edit ${task.title}`}
            onClick={() => onEdit(task)}
            disabled={isLoading}
          >
            <Edit className="h-5 w-5" />
          </button>
          <button 
            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-100 rounded transition-colors"
            aria-label={`Delete ${task.title}`}
            onClick={() => onDelete(task.id)}
            disabled={isLoading}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskItem;
