import { useState, useEffect, useRef } from 'react';
import { Plus, X, Search, Filter, ChevronDown, CheckSquare } from 'lucide-react';
import { Task, TaskStatus, Client } from '../clients/ClientTypes';
import TaskForm from '../tasks/TaskForm';
import { Button, Card, Input, Select, Table, Badge, Modal } from '../ui';
import { TaskFilter } from '../tasks/TaskFilter';

// Define column type for the task table
interface TaskColumn {
  key: string;
  header: string;
  render?: (task: Task, index: number) => JSX.Element | null;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

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
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  
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
  
  // No longer needed since we're using the Select component
  
  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/tasks`);
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
  
  // Define table columns
  const taskColumns: TaskColumn[] = [
    {
      key: 'title',
      header: 'Task',
      sortable: true,
      render: (task) => (
        <div>
          <div className="font-medium text-gray-900">{task.title}</div>
          {task.description && (
            <div className="text-sm text-gray-500 line-clamp-1">{task.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      render: (task) => {
        const client = clients.find(c => c.id === task.client_id);
        return <span className="text-gray-700">{client?.name || 'Unknown'}</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (task) => {
        const status = statuses.find(s => s.id === task.status_id);
        if (!status) return null;
        
        return (
          <Badge
            variant={status.name.toLowerCase() === 'completed' ? 'success' : 'primary'}
            rounded
          >
            {status.name}
          </Badge>
        );
      },
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: (task) => {
        if (!task.due_date) return <span className="text-gray-400">No date</span>;
        
        const dueDate = new Date(task.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const isOverdue = dueDate < today;
        
        return (
          <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-700'}>
            {dueDate.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (task) => {
        const priorityColors = {
          high: 'danger',
          medium: 'warning',
          low: 'success',
        };
        
        return (
          <Badge
            variant={priorityColors[task.priority as keyof typeof priorityColors] || 'default'}
            size="sm"
            rounded
          >
            {task.priority || 'Medium'}
          </Badge>
        );
      },
    },
  ];
  
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
      const response = await fetch(`${apiUrl}/task-statuses`);
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
      const response = await fetch(`${apiUrl}/clients`);
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
      
      const response = await fetch(`${apiUrl}/tasks`, {
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
    setShowTaskModal(true);
  };
  
  // Handle form cancel
  const handleFormCancel = () => {
    setShowTaskModal(false);
    setEditingTask(null);
  };
  
  // Handle row click
  const handleRowClick = (task: Task) => {
    handleEditTask(task);
  };
  
  // Filter options for the dropdown
  const filterOptions = [
    { value: 'all', label: 'All Tasks' },
    { value: 'active', label: 'Active Tasks' },
    { value: 'completed', label: 'Completed Tasks' },
    { value: 'overdue', label: 'Overdue Tasks' },
  ];
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Tasks</h1>
        <Button 
          variant="primary"
          icon={<Plus className="h-5 w-5" />}
          onClick={() => {
            setEditingTask(null);
            setShowTaskModal(true);
          }}
          disabled={isLoading}
        >
          Add Task
        </Button>
      </div>
      
      {error && (
        <Card className="mb-6 bg-red-50 border border-red-200 text-red-700 relative">
          <div className="flex justify-between items-start">
            <span>{error}</span>
            <Button
              variant="text"
              size="sm"
              onClick={() => setError(null)}
              aria-label="Close error message"
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </Card>
      )}
      
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-5 w-5 text-gray-400" />}
            className="w-full md:w-64"
          />
          
          <Select
            options={filterOptions}
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as TaskFilter)}
            icon={<Filter className="h-5 w-5 text-gray-400" />}
            className="w-full md:w-48"
          />
          
          <div className="text-sm text-gray-500 ml-auto">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} found
          </div>
        </div>
      </Card>
      
      <Card>
        <Table
          data={filteredTasks}
          columns={taskColumns}
          keyExtractor={(task) => task.id}
          onRowClick={handleRowClick}
          isLoading={isLoading && !tasks.length}
          emptyState={
            <div className="text-center py-12">
              <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Tasks Found</h3>
              <p className="text-gray-500 mb-6">
                {searchQuery || activeFilter !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Create your first task to get started'}
              </p>
              <Button 
                variant="primary"
                icon={<Plus className="h-5 w-5" />}
                onClick={() => {
                  setEditingTask(null);
                  setShowTaskModal(true);
                }}
              >
                Add Task
              </Button>
            </div>
          }
          striped
          hoverable
        />
      </Card>
      
      <Modal
        isOpen={showTaskModal}
        onClose={handleFormCancel}
        title={editingTask ? 'Edit Task' : 'Create New Task'}
        size="lg"
      >
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
      </Modal>
    </div>
  );
};

export default TasksPage;
