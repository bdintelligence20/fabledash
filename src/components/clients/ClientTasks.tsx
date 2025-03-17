import { useState, useEffect } from 'react';
import { Plus, X, Trash2, Edit, CheckSquare, Calendar, AlertCircle } from 'lucide-react';
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
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  
  // New state variables for the task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskStatusId, setNewTaskStatusId] = useState<number | null>(null);
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  
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
  
  // Delete a task
  const deleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      const response = await fetch(`${apiUrl}/tasks/${taskId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Remove the task from the local state
        setTasks(tasks.filter(task => task.id !== taskId));
      } else {
        setError(data.message || 'Failed to delete task');
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      setError('Network error while deleting task');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reset form fields
  const resetForm = () => {
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskStatusId(null);
    setNewTaskStartDate('');
    setNewTaskDueDate('');
    setNewTaskPriority('medium');
    setEditingTaskId(null);
  };
  
  // Create or update a task
  const createOrUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTaskTitle.trim()) {
      setError('Task title is required');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Use the first status as default if none selected
      const statusId = newTaskStatusId || (statuses.length > 0 ? statuses[0].id : null);
      
      if (!statusId) {
        setError('No task status available. Please create a status first.');
        setIsLoading(false);
        return;
      }
      
      const taskData = {
        client_id: clientId,
        title: newTaskTitle,
        description: newTaskDescription || null,
        status_id: statusId,
        start_date: newTaskStartDate || null,
        due_date: newTaskDueDate || null,
        priority: newTaskPriority
      };
      
      let url = `${apiUrl}/tasks/create`;
      let method = 'POST';
      
      // If we're editing an existing task, use PUT method and the task's ID
      if (editingTaskId) {
        url = `${apiUrl}/tasks/${editingTaskId}`;
        method = 'PUT';
      }
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Reset form
        resetForm();
        setShowCreateForm(false);
        
        // Refresh tasks list
        fetchTasks();
      } else {
        setError(data.message || `Failed to ${editingTaskId ? 'update' : 'create'} task`);
      }
    } catch (error) {
      console.error(`Error ${editingTaskId ? 'updating' : 'creating'} task:`, error);
      setError(`Network error while ${editingTaskId ? 'updating' : 'creating'} task`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <button 
          onClick={() => {
            resetForm();
            setShowCreateForm(true);
          }}
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
          <h3 className="text-lg font-medium mb-4">
            {editingTaskId ? 'Edit Task' : 'Create New Task'}
          </h3>
          
          <form onSubmit={createOrUpdateTask}>
            <div className="mb-4">
              <label htmlFor="taskTitle" className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="taskTitle"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter task title"
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="taskDescription" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="taskDescription"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter task description"
                rows={3}
                disabled={isLoading}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="taskStatus" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="taskStatus"
                  value={newTaskStatusId || ''}
                  onChange={(e) => setNewTaskStatusId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading || statuses.length === 0}
                >
                  <option value="">Select a status</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="taskPriority" className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  id="taskPriority"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label htmlFor="taskStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    id="taskStartDate"
                    value={newTaskStartDate}
                    onChange={(e) => setNewTaskStartDate(e.target.value)}
                    className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="taskDueDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    id="taskDueDate"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreateForm(false);
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg mr-2"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center"
                disabled={isLoading || !newTaskTitle.trim()}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    {editingTaskId ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  editingTaskId ? 'Update Task' : 'Create Task'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {isLoading && !showCreateForm ? (
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
                        onClick={() => {
                          // Set form fields with task data
                          setNewTaskTitle(task.title);
                          setNewTaskDescription(task.description || '');
                          setNewTaskStatusId(task.status_id);
                          setNewTaskStartDate(task.start_date || '');
                          setNewTaskDueDate(task.due_date || '');
                          setNewTaskPriority(task.priority || 'medium');
                          
                          // Show the form
                          setShowCreateForm(true);
                          
                          // Store the task ID for update
                          setEditingTaskId(task.id);
                        }}
                        disabled={isLoading}
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button 
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Delete ${task.title}`}
                        onClick={() => deleteTask(task.id)}
                        disabled={isLoading}
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
