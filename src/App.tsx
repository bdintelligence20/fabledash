import { useState, useEffect } from 'react';
import { 
  Home, 
  CheckSquare, 
  DollarSign, 
  Bot, 
  Menu, 
  X, 
  UserCircle,
  Search,
  BarChart2,
  Clock,
  Settings,
  Bell
} from 'lucide-react';

// Import page components
import DashboardPage from './components/pages/DashboardPage';
import TasksPage from './components/pages/TasksPage';
import FinancesPage from './components/pages/FinancesPage';
import ClientsPage from './components/pages/ClientsPage';
import AIAgentsPage from './components/pages/AIAgentsPage';

// Main App Component
function App() {
  // Initialize currentPage from localStorage or default to 'dashboard'
  const [currentPage, setCurrentPage] = useState(() => {
    const savedPage = localStorage.getItem('currentPage');
    return savedPage || 'dashboard';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Save currentPage to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('currentPage', currentPage);
  }, [currentPage]);
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  // Render the current page based on state
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'tasks':
        return <TasksPage />;
      case 'finances':
        return <FinancesPage />;
      case 'agents':
        return <AIAgentsPage />;
      case 'clients':
        return <ClientsPage />;
      default:
        return <DashboardPage />;
    }
  };
  
  // Get page title
  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'Dashboard';
      case 'tasks':
        return 'Tasks';
      case 'finances':
        return 'Finances';
      case 'agents':
        return 'AI Agents';
      case 'clients':
        return 'Clients';
      default:
        return 'Dashboard';
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-primary flex">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex md:flex-col md:w-64 bg-white rounded-r-2xl shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-primary-600">FableDash</h1>
        </div>
        
        <nav className="flex-1 p-4">
          <div className="mb-8">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4 px-4">Main</p>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className={`w-full flex items-center px-4 py-3 rounded-xl ${
                    currentPage === 'dashboard'
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Home className="h-5 w-5 mr-3" />
                  Dashboard
                </button>
              </li>
              
              <li>
                <button
                  onClick={() => setCurrentPage('tasks')}
                  className={`w-full flex items-center px-4 py-3 rounded-xl ${
                    currentPage === 'tasks'
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <CheckSquare className="h-5 w-5 mr-3" />
                  Tasks
                </button>
              </li>
              
              <li>
                <button
                  onClick={() => setCurrentPage('finances')}
                  className={`w-full flex items-center px-4 py-3 rounded-xl ${
                    currentPage === 'finances'
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <DollarSign className="h-5 w-5 mr-3" />
                  Finances
                </button>
              </li>
              
              <li>
                <button
                  onClick={() => setCurrentPage('clients')}
                  className={`w-full flex items-center px-4 py-3 rounded-xl ${
                    currentPage === 'clients'
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <UserCircle className="h-5 w-5 mr-3" />
                  Clients
                </button>
              </li>
            </ul>
          </div>
          
          <div className="mb-8">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4 px-4">Tools</p>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setCurrentPage('agents')}
                  className={`w-full flex items-center px-4 py-3 rounded-xl ${
                    currentPage === 'agents'
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Bot className="h-5 w-5 mr-3" />
                  AI Agents
                </button>
              </li>
              
              <li>
                <button
                  className="w-full flex items-center px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  <BarChart2 className="h-5 w-5 mr-3" />
                  Analytics
                </button>
              </li>
              
              <li>
                <button
                  className="w-full flex items-center px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  <Clock className="h-5 w-5 mr-3" />
                  Time Tracking
                </button>
              </li>
            </ul>
          </div>
        </nav>
        
        <div className="p-4 border-t">
          <div className="flex items-center p-2 rounded-xl hover:bg-gray-50 cursor-pointer">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold mr-3">
              JD
            </div>
            <div>
              <p className="font-medium text-gray-800">John Doe</p>
              <p className="text-xs text-gray-500">john@example.com</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <header className="bg-white p-4 md:p-6 flex justify-between items-center shadow-sm rounded-bl-2xl">
          <div className="flex items-center">
            {/* Mobile Menu Button */}
            <button onClick={toggleMobileMenu} className="md:hidden text-gray-600 mr-4">
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
            
            <h1 className="text-xl font-bold text-gray-800 md:hidden">FableDash</h1>
            <h1 className="text-xl font-bold text-gray-800 hidden md:block">{getPageTitle()}</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Search Bar - Desktop */}
            <div className="hidden md:flex items-center bg-gray-100 rounded-lg px-3 py-2">
              <Search className="h-4 w-4 text-gray-500 mr-2" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-transparent border-none focus:outline-none text-sm text-gray-700 w-48"
              />
            </div>
            
            {/* Notification Bell */}
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Bell className="h-5 w-5 text-gray-600" />
            </button>
            
            {/* Settings */}
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Settings className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </header>
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white shadow-lg border-b">
            <nav className="p-4">
              <div className="mb-6">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-2">Main</p>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => {
                        setCurrentPage('dashboard');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-4 py-3 rounded-xl ${
                        currentPage === 'dashboard'
                          ? 'bg-primary-50 text-primary-600 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Home className="h-5 w-5 mr-3" />
                      Dashboard
                    </button>
                  </li>
                  
                  <li>
                    <button
                      onClick={() => {
                        setCurrentPage('tasks');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-4 py-3 rounded-xl ${
                        currentPage === 'tasks'
                          ? 'bg-primary-50 text-primary-600 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <CheckSquare className="h-5 w-5 mr-3" />
                      Tasks
                    </button>
                  </li>
                  
                  <li>
                    <button
                      onClick={() => {
                        setCurrentPage('finances');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-4 py-3 rounded-xl ${
                        currentPage === 'finances'
                          ? 'bg-primary-50 text-primary-600 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <DollarSign className="h-5 w-5 mr-3" />
                      Finances
                    </button>
                  </li>
                  
                  <li>
                    <button
                      onClick={() => {
                        setCurrentPage('clients');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-4 py-3 rounded-xl ${
                        currentPage === 'clients'
                          ? 'bg-primary-50 text-primary-600 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <UserCircle className="h-5 w-5 mr-3" />
                      Clients
                    </button>
                  </li>
                </ul>
              </div>
              
              <div className="mb-6">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-2">Tools</p>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => {
                        setCurrentPage('agents');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-4 py-3 rounded-xl ${
                        currentPage === 'agents'
                          ? 'bg-primary-50 text-primary-600 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Bot className="h-5 w-5 mr-3" />
                      AI Agents
                    </button>
                  </li>
                </ul>
              </div>
              
              {/* Search Bar - Mobile */}
              <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 mb-4">
                <Search className="h-4 w-4 text-gray-500 mr-2" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="bg-transparent border-none focus:outline-none text-sm text-gray-700 w-full"
                />
              </div>
              
              <div className="border-t pt-4">
                <div className="flex items-center p-2">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold mr-3">
                    JD
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">John Doe</p>
                    <p className="text-xs text-gray-500">john@example.com</p>
                  </div>
                </div>
              </div>
            </nav>
          </div>
        )}
        
        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto bg-secondary-50 rounded-tl-2xl">
          <div className="max-w-7xl mx-auto">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
