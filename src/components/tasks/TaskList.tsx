import { CheckSquare, Plus } from 'lucide-react';
import { Task, TaskStatus, Client } from '../clients/ClientTypes';
import TaskItem from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  statuses: TaskStatus[];
  clients: Client[];
  isLoading: boolean;
  onToggleComplete: (taskId: number, currentStatusId: number) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
  onEdit: (task: Task) => void;
  onAddTask: () => void;
}

const TaskList = ({
  tasks,
  statuses,
  clients,
  isLoading,
  onToggleComplete,
  onDelete,
  onEdit,
  onAddTask
}: TaskListProps) => {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {tasks.length > 0 ? (
        <div className="divide-y">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              statuses={statuses}
              clients={clients}
              isLoading={isLoading}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Tasks Found</h3>
          <p className="text-gray-500 mb-6">Create your first task to get started</p>
          <button 
            onClick={onAddTask}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg inline-flex items-center transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Task
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskList;
