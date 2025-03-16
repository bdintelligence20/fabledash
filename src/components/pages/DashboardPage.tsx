import { CheckSquare, DollarSign, Bot } from 'lucide-react';

const DashboardPage = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-2">Tasks</h2>
          <p className="text-gray-600 mb-4">You have 5 tasks due today</p>
          <div className="h-2 bg-blue-100 rounded-full">
            <div className="h-2 bg-blue-500 rounded-full w-2/3"></div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-2">Finances</h2>
          <p className="text-gray-600 mb-4">Monthly budget: $3,450</p>
          <div className="h-2 bg-green-100 rounded-full">
            <div className="h-2 bg-green-500 rounded-full w-1/2"></div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-2">AI Agents</h2>
          <p className="text-gray-600 mb-4">3 active agents</p>
          <div className="h-2 bg-purple-100 rounded-full">
            <div className="h-2 bg-purple-500 rounded-full w-3/4"></div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="bg-blue-100 p-2 rounded-full mr-4">
              <CheckSquare className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium">Task Completed</p>
              <p className="text-sm text-gray-600">Website redesign project</p>
              <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-green-100 p-2 rounded-full mr-4">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Invoice Paid</p>
              <p className="text-sm text-gray-600">Client XYZ Corp</p>
              <p className="text-xs text-gray-500 mt-1">Yesterday</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-purple-100 p-2 rounded-full mr-4">
              <Bot className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="font-medium">New AI Agent Created</p>
              <p className="text-sm text-gray-600">Document Assistant</p>
              <p className="text-xs text-gray-500 mt-1">2 days ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
