import { 
  CheckSquare, 
  DollarSign, 
  Bot, 
  Users, 
  ArrowUp, 
  ArrowDown, 
  BarChart2, 
  Calendar, 
  Clock, 
  TrendingUp
} from 'lucide-react';
import Card from '../ui/Card';
import StatCard from '../ui/StatCard';
import Button from '../ui/Button';

const DashboardPage = () => {
  return (
    <div>
      {/* Summary Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Summary</h2>
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-2">This Month</span>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-1" />
              Apr 2025
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="CUSTOMERS" 
            value="54,235" 
            icon={<Users className="h-8 w-8" />}
            bgColor="bg-primary-500"
          />
          
          <StatCard 
            title="INCOME" 
            value="$980,632" 
            icon={<DollarSign className="h-8 w-8" />}
            bgColor="bg-primary-600"
          />
          
          <StatCard 
            title="PRODUCTS SOLD" 
            value="5,490" 
            icon={<TrendingUp className="h-8 w-8" />}
            bgColor="bg-primary-700"
          />
        </div>
      </div>
      
      {/* Marketplace Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Marketplace</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <div className="flex justify-between">
              <div>
                <h3 className="text-lg font-medium mb-2">Data Analytics Overview</h3>
                <p className="text-gray-600 mb-4">See how your account grows and how you can boost it.</p>
              </div>
              <div className="flex items-center">
                <div className="w-16 h-16 rounded-full border-4 border-primary-100 flex items-center justify-center">
                  <span className="text-primary-500 font-semibold">65%</span>
                </div>
              </div>
            </div>
            <Button variant="primary" className="mt-4">
              START
            </Button>
          </Card>
          
          <Card>
            <div className="flex justify-between">
              <div>
                <h3 className="text-lg font-medium mb-2">Finance Flow</h3>
                <p className="text-gray-600 mb-4">$2,530</p>
                <p className="text-sm text-gray-500">September 2025</p>
              </div>
              <div className="flex items-end">
                {/* Simple bar chart visualization */}
                <div className="flex items-end space-x-1">
                  {[3, 5, 2, 7, 4, 6, 8, 5, 9, 4, 6, 7].map((height, index) => (
                    <div 
                      key={index} 
                      className="w-2 bg-primary-200 rounded-t-sm" 
                      style={{ height: `${height * 8}px` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      
      {/* Activity Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Activity</h2>
          <Button variant="text" size="sm">
            SEE ALL
          </Button>
        </div>
        
        <Card>
          <div className="space-y-6">
            <div className="flex items-start">
              <div className="bg-primary-100 p-3 rounded-xl mr-4">
                <CheckSquare className="h-6 w-6 text-primary-500" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">Task Completed</p>
                    <p className="text-sm text-gray-600">Website redesign project</p>
                  </div>
                  <p className="text-primary-500 font-medium">$4,120</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">12:40 am</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-primary-100 p-3 rounded-xl mr-4">
                <DollarSign className="h-6 w-6 text-primary-500" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">Paying Website tax</p>
                    <p className="text-sm text-gray-600">Annual domain renewal</p>
                  </div>
                  <p className="text-red-500 font-medium">- $230</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">10:20 am</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-primary-100 p-3 rounded-xl mr-4">
                <Bot className="h-6 w-6 text-primary-500" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">New AI Agent Created</p>
                    <p className="text-sm text-gray-600">Document Assistant</p>
                  </div>
                  <p className="text-primary-500 font-medium">$0</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">Yesterday</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Top Categories Section */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Top Categories</h2>
        </div>
        
        <p className="text-gray-600 mb-6">Explore your top categories and keep shopping with cashback</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-accent-50 border border-accent-100">
            <div className="flex items-center">
              <div className="bg-accent-200 p-4 rounded-xl mr-4">
                <span className="text-2xl">👟</span>
              </div>
              <div>
                <h3 className="font-medium">Footwear</h3>
                <p className="text-sm text-gray-600">18,941 units</p>
              </div>
            </div>
          </Card>
          
          <Card className="bg-primary-50 border border-primary-100">
            <div className="flex items-center">
              <div className="bg-primary-200 p-4 rounded-xl mr-4">
                <span className="text-2xl">🧢</span>
              </div>
              <div>
                <h3 className="font-medium">Accessories</h3>
                <p className="text-sm text-gray-600">26,061 units</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
