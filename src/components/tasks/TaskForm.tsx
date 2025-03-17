import { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Calendar, 
  Clock, 
  Tag, 
  FileText,
  AlertCircle,
  ArrowUpRight
} from 'lucide-react';
import { Client, TaskStatus } from '../clients/ClientTypes';

interface TaskFormProps {
  clients: Client[];
  statuses: TaskStatus[];
  isLoading: boolean;
  onSubmit: (taskData: any) => Promise<void>;
  onCancel: () => void;
  initialData?: {
    title: string;
    client_id: number | null;
    description: string;
    status_id: number | null;
    start_date: string;
    due_date: string;
    priority: string;
  };
}

const TaskForm = ({ 
  clients, 
  statuses, 
  isLoading, 
  onSubmit, 
  onCancel,
  initialData 
}: TaskFormProps) => {
  // Form state
  const [title, setTitle] = useState(initialData?.title || '');
  const [clientId, setClientId] = useState<number | null>(initialData?.client_id || null);
  const [description, setDescription] = useState(initialData?.description || '');
  const [statusId, setStatusId] = useState<number | null>(initialData?.status_id || null);
  const [startDate, setStartDate] = useState(initialData?.start_date || '');
  const [dueDate, setDueDate] = useState(initialData?.due_date || '');
  const [priority, setPriority] = useState(initialData?.priority || 'medium');
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // Handle input change with validation
  const handleInputChange = (
    setter: React.Dispatch<React.SetStateAction<string | number | null>>,
    field: string,
    value: string | number | null
  ) => {
    setter(value);
    
    // Clear the error when user starts typing
    if (formErrors[field]) {
      setFormErrors({
        ...formErrors,
        [field]: ''
      });
    }
  };

  // Validate form fields
  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!title.trim()) {
      errors.title = 'Task title is required';
    }
    
    if (!clientId) {
      errors.client = 'Please select a client';
    }
    
    if (dueDate && startDate && new Date(dueDate) < new Date(startDate)) {
      errors.dueDate = 'Due date cannot be earlier than start date';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Use the first status as default if none selected
    const finalStatusId = statusId || (statuses.length > 0 ? statuses[0].id : null);
    
    if (!finalStatusId) {
      setFormErrors({
        ...formErrors,
        status: 'No task status available. Please create a status first.'
      });
      return;
    }
    
    await onSubmit({
      title,
      client_id: clientId,
      description: description || null,
      status_id: finalStatusId,
      start_date: startDate || null,
      due_date: dueDate || null,
      priority
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">{initialData ? 'Edit Task' : 'Create New Task'}</h2>
        <button 
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close form"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            <div>
              <label htmlFor="taskTitle" className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="taskTitle"
                value={title}
                onChange={(e) => handleInputChange(setTitle, 'title', e.target.value)}
                className={`w-full px-4 py-3 border ${formErrors.title ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors`}
                placeholder="Enter task title"
                required
                disabled={isLoading}
              />
              {formErrors.title && (
                <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="taskClient" className="block text-sm font-medium text-gray-700 mb-1">
                Client *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Users className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  id="taskClient"
                  value={clientId || ''}
                  onChange={(e) => handleInputChange(
                    setClientId, 
                    'client', 
                    e.target.value ? parseInt(e.target.value) : null
                  )}
                  className={`w-full pl-10 px-4 py-3 border ${formErrors.client ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors`}
                  required
                  disabled={isLoading || clients.length === 0}
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {formErrors.client && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.client}</p>
                )}
              </div>
              {clients.length === 0 && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  No clients available. Please create a client first.
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="taskStatus" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Tag className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  id="taskStatus"
                  value={statusId || ''}
                  onChange={(e) => handleInputChange(
                    setStatusId, 
                    'status', 
                    e.target.value ? parseInt(e.target.value) : null
                  )}
                  className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  disabled={isLoading || statuses.length === 0}
                >
                  <option value="">Select a status</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
                {formErrors.status && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.status}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Right column */}
          <div className="space-y-4">
            <div>
              <label htmlFor="taskPriority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <ArrowUpRight className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  id="taskPriority"
                  value={priority}
                  onChange={(e) => handleInputChange(setPriority, 'priority', e.target.value)}
                  className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  disabled={isLoading}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            
            <div>
              <label htmlFor="taskStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  id="taskStartDate"
                  value={startDate}
                  onChange={(e) => handleInputChange(setStartDate, 'startDate', e.target.value)}
                  className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
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
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  id="taskDueDate"
                  value={dueDate}
                  onChange={(e) => handleInputChange(setDueDate, 'dueDate', e.target.value)}
                  className={`w-full pl-10 px-4 py-3 border ${formErrors.dueDate ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors`}
                  disabled={isLoading}
                />
                {formErrors.dueDate && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.dueDate}</p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <label htmlFor="taskDescription" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 top-3 flex items-start pl-3 pointer-events-none">
              <FileText className="h-5 w-5 text-gray-400" />
            </div>
            <textarea
              id="taskDescription"
              value={description}
              onChange={(e) => handleInputChange(setDescription, 'description', e.target.value)}
              className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              placeholder="Enter task description"
              rows={3}
              disabled={isLoading}
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg flex items-center transition-colors"
            disabled={isLoading || !title.trim() || !clientId}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                {initialData ? 'Saving...' : 'Creating...'}
              </>
            ) : (
              initialData ? 'Save Task' : 'Create Task'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;
