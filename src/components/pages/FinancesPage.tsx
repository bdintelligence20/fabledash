import { DollarSign } from 'lucide-react';

const FinancesPage = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Finances</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-600 uppercase mb-2">Total Income</h2>
          <p className="text-3xl font-bold text-green-500">$12,450</p>
          <p className="text-sm text-gray-600 mt-2">+8% from last month</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-600 uppercase mb-2">Total Expenses</h2>
          <p className="text-3xl font-bold text-red-500">$8,320</p>
          <p className="text-sm text-gray-600 mt-2">-3% from last month</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-600 uppercase mb-2">Net Profit</h2>
          <p className="text-3xl font-bold text-blue-500">$4,130</p>
          <p className="text-sm text-gray-600 mt-2">+15% from last month</p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="p-6 border-b">
          <h2 className="text-lg font-medium">Recent Transactions</h2>
        </div>
        <div className="divide-y">
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">Client Payment - XYZ Corp</p>
              <p className="text-sm text-gray-600">Invoice #1234</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-green-500">+$3,500</p>
              <p className="text-xs text-gray-500">May 12, 2025</p>
            </div>
          </div>
          
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">Office Supplies</p>
              <p className="text-sm text-gray-600">Staples Inc.</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-red-500">-$250</p>
              <p className="text-xs text-gray-500">May 10, 2025</p>
            </div>
          </div>
          
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">Software Subscription</p>
              <p className="text-sm text-gray-600">Adobe Creative Cloud</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-red-500">-$52.99</p>
              <p className="text-xs text-gray-500">May 8, 2025</p>
            </div>
          </div>
          
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">Client Payment - ABC Inc.</p>
              <p className="text-sm text-gray-600">Invoice #1233</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-green-500">+$2,750</p>
              <p className="text-xs text-gray-500">May 5, 2025</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancesPage;
