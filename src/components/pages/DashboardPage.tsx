import React from 'react';
import { Settings, ChevronUp, RefreshCw, X, Plus } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Table from '../ui/Table';
import Select from '../ui/Select';

// Define types for our data
interface TodoItem {
  id: number;
  count: number;
  description: string;
  amount: string;
}

interface BankAccount {
  value: string;
  label: string;
}

interface BankingChartPoint {
  date: string;
  balance: number;
}

interface SalesHistoryPoint {
  month: string;
  lastYear: number;
  thisYear: number;
}

interface Customer {
  id: number;
  name: string;
  salesValue: string;
}

const DashboardPage: React.FC = () => {
  // To Do List data
  const todoItems: TodoItem[] = [
    { id: 1, count: 16, description: 'Due Tax Invoices', amount: 'R230,821.89' },
    { id: 2, count: 26, description: 'Expired Quotes', amount: 'R1,652,005.10' },
    { id: 3, count: 21, description: 'Overdue Tax Invoices', amount: 'R337,968.34' },
    { id: 4, count: 3, description: 'Quotes Expiring Today', amount: 'R1,840,223.06' }
  ];

  // Banking data
  const bankAccounts: BankAccount[] = [
    { value: 'fnb', label: 'FNB Gold Business Account' }
  ];

  // Banking chart data - account balance over time
  const bankingChartData: BankingChartPoint[] = [
    { date: '03 Feb', balance: 120000 },
    { date: '10 Feb', balance: 125000 },
    { date: '17 Feb', balance: 125000 },
    { date: '24 Feb', balance: 85000 },
    { date: '03 Mar', balance: 85000 },
    { date: '10 Mar', balance: 85000 },
    { date: '17 Mar', balance: 85000 },
    { date: '24 Mar', balance: 85000 },
    { date: '31 Mar', balance: 85000 }
  ];

  // Sales History data
  const salesHistoryData: SalesHistoryPoint[] = [
    { month: 'Apr', lastYear: 80000, thisYear: 70000 },
    { month: 'May', lastYear: 180000, thisYear: 260000 },
    { month: 'Jun', lastYear: 200000, thisYear: 200000 },
    { month: 'Jul', lastYear: 150000, thisYear: 120000 },
    { month: 'Aug', lastYear: 100000, thisYear: 110000 },
    { month: 'Sep', lastYear: 170000, thisYear: 100000 },
    { month: 'Oct', lastYear: 200000, thisYear: 250000 },
    { month: 'Nov', lastYear: -20000, thisYear: 100000 },
    { month: 'Dec', lastYear: 190000, thisYear: 240000 },
    { month: 'Jan', lastYear: 130000, thisYear: 140000 },
    { month: 'Feb', lastYear: 220000, thisYear: 180000 },
    { month: 'Mar', lastYear: 70000, thisYear: 260000 }
  ];

  // Top Customers data
  const topCustomersData: Customer[] = [
    { id: 1, name: 'EVERT DAVIDSON CREATIVE PARTNERSHIP', salesValue: 'R 454,554.50' },
    { id: 2, name: 'AGEN-C', salesValue: 'R 468,720.00' },
    { id: 3, name: 'Binghatti', salesValue: 'R 226,800.00' },
    { id: 4, name: 'Devmark', salesValue: 'R 155,838.00' },
    { id: 5, name: 'Mirrored Media LLC', salesValue: 'R 138,120.00' }
  ];

  // Top Customers table columns
  const topCustomersColumns = [
    {
      key: 'name',
      header: 'Name',
      render: (item: Customer) => (
        <div className="flex items-center">
          <span className="text-blue-500 mr-2">detail</span>
          <span>{item.name}</span>
        </div>
      )
    },
    {
      key: 'salesValue',
      header: 'Sales Value',
      align: 'right' as const
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* To Do List Widget */}
      <Card className="relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">To Do List</h2>
          <div className="flex space-x-2">
            <button className="text-gray-500 hover:text-gray-700">
              <Settings size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <ChevronUp size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <RefreshCw size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="bg-gray-600 text-white rounded-t-md">
          <div className="grid grid-cols-4 p-3 text-xs">
            <div>Name</div>
            <div>Description</div>
            <div>Due Date</div>
            <div className="text-right">Amount</div>
          </div>
        </div>

        <div className="divide-y">
          {todoItems.map((item) => (
            <div key={item.id} className="py-3 hover:bg-gray-50">
              <div className="flex items-center">
                <button className="mr-2 text-gray-400">
                  <Plus size={16} />
                </button>
                <div className="grid grid-cols-4 w-full">
                  <div>{item.count} {item.description.split(' ')[0]}</div>
                  <div>{item.description.split(' ').slice(1).join(' ')}</div>
                  <div></div>
                  <div className="text-right">{item.amount}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Banking Widget */}
      <Card className="relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Banking</h2>
          <div className="flex space-x-2">
            <button className="text-gray-500 hover:text-gray-700">
              <Settings size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <ChevronUp size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <RefreshCw size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <span className="text-sm mr-2">Bank Account:</span>
              <Select 
                options={bankAccounts}
                value="fnb"
                className="w-64"
              />
            </div>
            <Button variant="outline" size="sm">
              Import Bank Statement
            </Button>
          </div>
          <div className="text-sm">
            <div>Balance as at 31 March 2025: <span className="font-medium">R85,355.31</span></div>
            <div>Last refresh was on: <span className="font-medium">31 March 2025</span> (up to date)</div>
          </div>
        </div>

        <div className="h-48 relative">
          {/* Banking Chart */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-right pr-2 text-xs text-gray-600">
            <div>R140,000</div>
            <div>R120,000</div>
            <div>R100,000</div>
            <div>R80,000</div>
            <div>R60,000</div>
            <div>R40,000</div>
            <div>R20,000</div>
            <div>R0</div>
          </div>
          
          <div className="absolute left-16 right-0 top-0 bottom-0">
            <div className="h-full flex flex-col justify-between">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="border-t border-gray-200 h-0"></div>
              ))}
            </div>
            
            <div className="absolute inset-0 pt-2">
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  points="
                    0,16.7 
                    12.5,12.5 
                    25,12.5 
                    37.5,37.5 
                    50,37.5 
                    62.5,37.5 
                    75,37.5 
                    87.5,37.5 
                    100,37.5
                  "
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                />
                {bankingChartData.map((point, i) => (
                  <circle
                    key={i}
                    cx={i * (100 / (bankingChartData.length - 1))}
                    cy={100 - (point.balance / 140000 * 100)}
                    r="1.5"
                    fill="#F59E0B"
                    stroke="#F59E0B"
                    strokeWidth="1"
                  />
                ))}
              </svg>
            </div>
          </div>
          
          <div className="absolute left-16 right-0 bottom-0 flex justify-between text-xs text-gray-600 pt-1">
            {bankingChartData.map((point, i) => (
              <div key={i}>{point.date.split(' ')[0]} {point.date.split(' ')[1]}</div>
            ))}
          </div>
        </div>
      </Card>

      {/* Sales History Widget */}
      <Card className="relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Sales History</h2>
          <div className="flex space-x-2">
            <button className="text-gray-500 hover:text-gray-700">
              <Settings size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <ChevronUp size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <RefreshCw size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="h-64 relative">
          {/* Sales History Chart */}
          <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-right pr-2 text-xs text-gray-600">
            <div>R300,000</div>
            <div>R250,000</div>
            <div>R200,000</div>
            <div>R150,000</div>
            <div>R100,000</div>
            <div>R50,000</div>
            <div>R0</div>
            <div>R-50,000</div>
          </div>
          
          <div className="absolute left-16 right-0 top-0 bottom-8">
            <div className="h-full flex flex-col justify-between">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="border-t border-gray-200 h-0"></div>
              ))}
            </div>
            
            <div className="absolute inset-0">
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                {salesHistoryData.map((month, i) => {
                  const x = i * (100 / (salesHistoryData.length - 1));
                  const barWidth = 3;
                  const gap = 1;
                  
                  // Calculate heights based on max value of 300000
                  const lastYearHeight = (month.lastYear / 300000) * 87.5;
                  const thisYearHeight = (month.thisYear / 300000) * 87.5;
                  
                  // Handle negative values
                  const lastYearY = month.lastYear < 0 ? 87.5 : 87.5 - lastYearHeight;
                  const thisYearY = month.thisYear < 0 ? 87.5 : 87.5 - thisYearHeight;
                  
                  return (
                    <g key={i}>
                      {/* Last Year Bar */}
                      <rect
                        x={x - barWidth - gap/2}
                        y={lastYearY}
                        width={barWidth}
                        height={Math.abs(lastYearHeight)}
                        fill="#3B82F6"
                      />
                      
                      {/* This Year Bar */}
                      <rect
                        x={x + gap/2}
                        y={thisYearY}
                        width={barWidth}
                        height={Math.abs(thisYearHeight)}
                        fill="#06B6D4"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          
          <div className="absolute left-16 right-0 bottom-0 flex justify-between text-xs text-gray-600">
            {salesHistoryData.map((month, i) => (
              <div key={i}>{month.month}</div>
            ))}
          </div>
          
          <div className="absolute bottom-0 right-0 flex items-center text-xs">
            <div className="flex items-center mr-4">
              <div className="w-3 h-3 bg-blue-500 mr-1"></div>
              <span>Last Year</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-cyan-500 mr-1"></div>
              <span>This Year</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Top Customers by Sales Widget */}
      <Card className="relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Top Customers by Sales</h2>
          <div className="flex space-x-2">
            <button className="text-gray-500 hover:text-gray-700">
              <Settings size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <ChevronUp size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <RefreshCw size={18} />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="bg-gray-600 text-white rounded-t-md">
          <div className="grid grid-cols-2 p-3 text-xs">
            <div>Name</div>
            <div className="text-right">Sales Value</div>
          </div>
        </div>

        <div className="divide-y">
          {topCustomersData.map((customer) => (
            <div key={customer.id} className="py-3 hover:bg-gray-50">
              <div className="grid grid-cols-2">
                <div>
                  <span className="text-blue-500 mr-2">detail</span>
                  {customer.name}
                </div>
                <div className="text-right">{customer.salesValue}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
