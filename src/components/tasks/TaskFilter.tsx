import { useRef } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';

// Define filter types
export type TaskFilter = 'all' | 'active' | 'completed' | 'overdue';

interface TaskFilterProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: TaskFilter;
  setActiveFilter: (filter: TaskFilter) => void;
  showFilterDropdown: boolean;
  setShowFilterDropdown: (show: boolean) => void;
  filterDropdownRef: React.RefObject<HTMLDivElement>;
  tasksCount: number;
}

const TaskFilterComponent = ({
  searchQuery,
  setSearchQuery,
  activeFilter,
  setActiveFilter,
  showFilterDropdown,
  setShowFilterDropdown,
  filterDropdownRef,
  tasksCount
}: TaskFilterProps) => {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-64"
          />
        </div>
        
        {/* Filter Dropdown */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 w-full sm:w-auto"
          >
            <div className="flex items-center">
              <Filter className="h-5 w-5 text-gray-500 mr-2" />
              <span>
                {activeFilter === 'all' ? 'All Tasks' : 
                 activeFilter === 'active' ? 'Active Tasks' :
                 activeFilter === 'completed' ? 'Completed Tasks' : 
                 'Overdue Tasks'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-500 ml-2" />
          </button>
          
          {showFilterDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200">
              <ul className="py-1">
                <li>
                  <button
                    onClick={() => {
                      setActiveFilter('all');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${activeFilter === 'all' ? 'bg-purple-50 text-purple-700' : ''}`}
                  >
                    All Tasks
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveFilter('active');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${activeFilter === 'active' ? 'bg-purple-50 text-purple-700' : ''}`}
                  >
                    Active Tasks
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveFilter('completed');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${activeFilter === 'completed' ? 'bg-purple-50 text-purple-700' : ''}`}
                  >
                    Completed Tasks
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveFilter('overdue');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${activeFilter === 'overdue' ? 'bg-purple-50 text-purple-700' : ''}`}
                  >
                    Overdue Tasks
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {/* Results summary */}
      <div className="mt-4 text-sm text-gray-500">
        {tasksCount === 0 ? (
          <p>No tasks found</p>
        ) : (
          <p>Showing {tasksCount} {tasksCount === 1 ? 'task' : 'tasks'}</p>
        )}
      </div>
    </div>
  );
};

export default TaskFilterComponent;
