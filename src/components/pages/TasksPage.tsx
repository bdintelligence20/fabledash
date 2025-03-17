import { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { Task, TaskStatus, Client } from '../clients/ClientTypes';
import TaskForm from '../tasks/TaskForm';
import TaskList from '../tasks/TaskList';
import TaskFilterComponent, { TaskFilter } from '../tasks/TaskFilter';

const TasksPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Refs
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  
  // Fetch tasks, statuses, and clients on component mount
  useEffect(() => {
    fetchTasks();
    fetchStatuses();
    fetchClients();
  }, []);
  
  // Filter tasks when search query or filter changes
  useEffect(() => {
    filterTasks();
  }, [tasks, searchQuery, activeFilter]);
  
  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/tasks/list`);
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
  
  // Filter tasks based on search query and active filter
  const filterTasks = () => {
    let filtered = [...tasks];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) || 
        (task.description && task.description.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (activeFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (activeFilter) {
        case 'active':
          // Tasks that are not completed
          const completedStatusIds = statuses
            .filter(s => s.name.toLowerCase() === 'completed')
            .map(s => s.id);
          filtered = filtered.filter(task => !completedStatusIds.includes(task.status_id));
          break;
        case 'completed':
          // Tasks that are completed
          const completedIds = statuses
            .filter(s => s.name.toLowerCase() === 'completed')
            .map(s => s.id);
          filtered = filtered.filter(task => completedIds.includes(task.status_id));
          break;
        case 'overdue':
          // Tasks with due dates in the past
          filtered = filtered.filter(task => {
            if (!task.due_date) return false;
            const dueDate = new Date(task.due_date);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate < today;
          });
          break;
      }
    }
    
    setFilteredTasks(filtered);
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
  
  // Fetch clients from API
  const fetchClients = async () => {
    try {
      const response = await fetch(`${apiUrl}/clients/list`);
      const data = await response.json();
      
      if (data.success) {
        setClients(data.clients);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };
  
  // Create a new task
  const createTask = async (taskData: any) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/tasks/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Reset form
        setShowCreateForm(false);
        setEditingTask(null);
        
        // Refresh tasks list
        fetchTasks();
      } else {
        setError(data.message || 'Failed to create task');
      }
    } catch (error) {
      console.error("Error creating task:", error);
      setError('Network error while creating task');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update an existing task
  const updateTask = async (taskData: any) => {
    if (!editingTask) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Reset form
        setEditingTask(null);
        
        // Refresh tasks list
        fetchTasks();
      } else {
        setError(data.message || 'Failed to update task');
      }
    } catch (error) {
      console.error("Error updating task:", error);
      setError('Network error while updating task');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toggle task completion
  const toggleTaskCompletion = async (taskId: number, currentStatusId: number) => {
    // Find the "Completed" status ID
    const completedStatus = statuses.find(s => s.name.toLowerCase() === 'completed');
    const inProgressStatus = statuses.find(s => s.name.toLowerCase() === 'in progress');
    
    if (!completedStatus || !inProgressStatus) {
      setError('Could not find required status types');
      return;
    }
    
    // Determine the new status
    const newStatusId = currentStatusId === completedStatus.id 
      ? inProgressStatus.id 
      : completedStatus.id;
    
    try {
      setIsLoading(true);
      
      const response = await fetch(`${apiUrl}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status_id: newStatusId,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update the task in the local state
        setTasks(tasks.map(task => 
          task.id === taskId 
            ? { ...task, status_id: newStatusId } 
            : task
        ));
      } else {
        setError(data.message || 'Failed to update task');
      }
    } catch (error) {
      console.error("Error updating task:", error);
      setError('Network error while updating task');
    } finally {
      setIsLoading(false);
    }
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
  
  // Handle task submission (create or update)
  const handleTaskSubmit = async (taskData: any) => {
    if (editingTask) {
      await updateTask(taskData);
    } else {
      await createTask(taskData);
    }
  };
  
  // Handle task edit
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowCreateForm(true);
  };
  
  // Handle form cancel
  const handleFormCancel = () => {
    setShowCreateForm(false);
    setEditingTask(null);
  };
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
          disabled={isLoading}
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Task
        </button>
      </div>
      
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative">
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
      
      {!showCreateForm && (
        <TaskFilterComponent
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          showFilterDropdown={showFilterDropdown}
          setShowFilterDropdown={setShowFilterDropdown}
          filterDropdownRef={filterDropdownRef}
          tasksCount={filteredTasks.length}
        />
      )}
      
      {showCreateForm ? (
        <TaskForm
          clients={clients}
          statuses={statuses}
          isLoading={isLoading}
          onSubmit={handleTaskSubmit}
          onCancel={handleFormCancel}
          initialData={editingTask ? {
            title: editingTask.title,
            client_id: editingTask.client_id,
            description: editingTask.description || '',
            status_id: editingTask.status_id,
            start_date: editingTask.start_date || '',
            due_date: editingTask.due_date || '',
            priority: editingTask.priority || 'medium'
          } : undefined}
        />
      ) : isLoading && !tasks.length ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <TaskList
          tasks={filteredTasks}
          statuses={statuses}
          clients={clients}
          isLoading={isLoading}
          onToggleComplete={toggleTaskCompletion}
          onDelete={deleteTask}
          onEdit={handleEditTask}
          onAddTask={() => setShowCreateForm(true)}
        />
      )}
    </div>
  );
};

export default TasksPage;
