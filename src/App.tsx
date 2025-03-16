import { useState, useEffect } from 'react';
import { 
  Home, 
  CheckSquare, 
  DollarSign, 
  Bot, 
  Menu, 
  X, 
  UserCircle
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
  
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex md:flex-col md:w-64 bg-white shadow">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-purple-600">WorkflowAI</h1>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`w-full flex items-center px-4 py-3 rounded-lg ${
                  currentPage === 'dashboard'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Home className="h-5 w-5 mr-3" />
                Dashboard
              </button>
            </li>
            
            <li>
              <button
                onClick={() => setCurrentPage('tasks')}
                className={`w-full flex items-center px-4 py-3 rounded-lg ${
                  currentPage === 'tasks'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <CheckSquare className="h-5 w-5 mr-3" />
                Tasks
              </button>
            </li>
            
            <li>
              <button
                onClick={() => setCurrentPage('finances')}
                className={`w-full flex items-center px-4 py-3 rounded-lg ${
                  currentPage === 'finances'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <DollarSign className="h-5 w-5 mr-3" />
                Finances
              </button>
            </li>
            
            <li>
              <button
                onClick={() => setCurrentPage('agents')}
                className={`w-full flex items-center px-4 py-3 rounded-lg ${
                  currentPage === 'agents'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Bot className="h-5 w-5 mr-3" />
                AI Agents
              </button>
            </li>
            
            <li>
              <button
                onClick={() => setCurrentPage('clients')}
                className={`w-full flex items-center px-4 py-3 rounded-lg ${
                  currentPage === 'clients'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <UserCircle className="h-5 w-5 mr-3" />
                Clients
              </button>
            </li>
          </ul>
        </nav>
        
        <div className="p-4 border-t">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-purple-200 flex items-center justify-center text-purple-600 font-semibold mr-3">
              JD
            </div>
            <div>
              <p className="font-medium">John Doe</p>
              <p className="text-xs text-gray-500">john@example.com</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu Button and Header */}
      <div className="flex flex-col flex-1">
        <header className="bg-white shadow md:hidden">
          <div className="flex justify-between items-center p-4">
            <h1 className="text-xl font-bold text-purple-600">WorkflowAI</h1>
            <button onClick={toggleMobileMenu} className="text-gray-600">
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
          
          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <nav className="p-4 border-t">
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => {
                      setCurrentPage('dashboard');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg ${
                      currentPage === 'dashboard'
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-gray-700 hover:bg-gray-100'
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
                    className={`w-full flex items-center px-4 py-3 rounded-lg ${
                      currentPage === 'tasks'
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-gray-700 hover:bg-gray-100'
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
                    className={`w-full flex items-center px-4 py-3 rounded-lg ${
                      currentPage === 'finances'
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <DollarSign className="h-5 w-5 mr-3" />
                    Finances
                  </button>
                </li>
                
                <li>
                  <button
                    onClick={() => {
                      setCurrentPage('agents');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg ${
                      currentPage === 'agents'
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Bot className="h-5 w-5 mr-3" />
                    AI Agents
                  </button>
                </li>
                
                <li>
                  <button
                    onClick={() => {
                      setCurrentPage('clients');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg ${
                      currentPage === 'clients'
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <UserCircle className="h-5 w-5 mr-3" />
                    Clients
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </header>
        
        {/* Main Content */}
        <main className="flex-1">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
