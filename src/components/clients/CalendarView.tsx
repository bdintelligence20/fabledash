import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from './ClientTypes';

interface CalendarViewProps {
  clientId: number;
}

const CalendarView = ({ clientId }: CalendarViewProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  
  // Fetch tasks for the calendar view
  useEffect(() => {
    fetchCalendarTasks();
  }, [clientId, currentMonth]);
  
  const fetchCalendarTasks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Calculate start and end dates for the current month
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const response = await fetch(
        `${apiUrl}/tasks/calendar?start_date=${startDateStr}&end_date=${endDateStr}&client_id=${clientId}`
      );
      
      const data = await response.json();
      
      if (data.success) {
        setTasks(data.tasks);
      } else {
        setError(data.message || 'Failed to fetch calendar tasks');
      }
    } catch (error) {
      console.error("Error fetching calendar tasks:", error);
      setError('Network error while fetching calendar tasks');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  // Get day of week for the first day of the month (0 = Sunday, 6 = Saturday)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };
  
  // Get tasks for a specific day
  const getTasksForDay = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0];
    
    return tasks.filter(task => {
      // Check if the task's due date or start date matches this day
      return (task.due_date && task.due_date.split('T')[0] === dateStr) || 
             (task.start_date && task.start_date.split('T')[0] === dateStr);
    });
  };
  
  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  // Format month name
  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };
  
  // Render calendar
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    
    // Create array of day cells
    const dayCells = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      dayCells.push(
        <div key={`empty-${i}`} className="h-24 border border-gray-200 bg-gray-50"></div>
      );
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayTasks = getTasksForDay(day);
      const isToday = new Date().getDate() === day && 
                      new Date().getMonth() === month && 
                      new Date().getFullYear() === year;
      
      dayCells.push(
        <div 
          key={`day-${day}`} 
          className={`h-24 border border-gray-200 p-1 overflow-hidden ${isToday ? 'bg-blue-50' : ''}`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : ''}`}>{day}</span>
            {dayTasks.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">
                {dayTasks.length}
              </span>
            )}
          </div>
          <div className="space-y-1 overflow-y-auto max-h-16">
            {dayTasks.slice(0, 2).map(task => (
              <div 
                key={task.id} 
                className="text-xs p-1 rounded truncate"
                style={{ 
                  backgroundColor: task.status_color ? `${task.status_color}20` : '#e5e7eb',
                  color: task.status_color || '#374151'
                }}
              >
                {task.title}
              </div>
            ))}
            {dayTasks.length > 2 && (
              <div className="text-xs text-gray-500">+{dayTasks.length - 2} more</div>
            )}
          </div>
        </div>
      );
    }
    
    return dayCells;
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <CalendarIcon className="h-5 w-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-medium">Calendar View</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={goToPreviousMonth}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium">{formatMonth(currentMonth)}</span>
          <button 
            onClick={goToNextMonth}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {renderCalendar()}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
