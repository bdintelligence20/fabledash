import { useState, useEffect } from 'react';
import { Plus, X, Trash2, Edit, CheckSquare } from 'lucide-react';
import { Task, TaskStatus } from './ClientTypes';

interface ClientTasksProps {
  clientId: number;
}

const ClientTasks = ({ clientId }: ClientTasksProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  
  // Fetch tasks and statuses on component mount
  useEffect(() => {
    fetchTasks();
    fetchStatuses();
  }, [clientId]);
  
  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/tasks/client/${clientId}`);
      const data = await response.json();
      
      if (data.success) {
        setTasks(data.tasks);
      } else {
        setError(data.message || 'Failed to fetch tasks');
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setError('Network error while fetching tasks');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch task statuses from API
  const fetchStatuses = async () => {
    try {
      const response = await fetch(`${apiUrl}/task-statuses/list`);
      const data = await response.json();
      
      if (data.success) {
        setStatuses(data.statuses);
      }
    } catch (error) {
      console.error("Error fetching task statuses:", error);
    }
  };
  
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
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
          disabled={isLoading}
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Task
        </button>
      </div>
      
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
            aria-label="Close error message"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      
      {showCreateForm && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-4">Create New Task</h3>
          {/* Task form will be implemented here */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateForm(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg mr-2"
            >
              Cancel
            </button>
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Create Task
            </button>
          </div>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {tasks.length > 0 ? (
            <div className="divide-y">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center mt-2">
                        <span 
                          className="inline-block px-2 py-1 text-xs rounded-full mr-2"
                          style={{ 
                            backgroundColor: `${getStatusColor(task.status_id)}20`, 
                            color: getStatusColor(task.status_id) 
                          }}
                        >
                          {getStatusName(task.status_id)}
                        </span>
                        {task.due_date && (
                          <span className="text-xs text-gray-500">
                            Due: {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        className="text-gray-500 hover:text-gray-700"
                        aria-label={`Edit ${task.title}`}
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button 
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Delete ${task.title}`}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Tasks Yet</h3>
              <p className="text-gray-500 mb-6">Create your first task for this client</p>
              <button 
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg inline-flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Task
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientTasks;
