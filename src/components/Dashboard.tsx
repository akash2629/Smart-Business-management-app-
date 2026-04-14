import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Package, 
  Wallet, 
  Clock,
  ShoppingCart,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { DashboardData } from '../types';
import { formatCurrency } from '../lib/utils';

function StatCard({ title, value, icon: Icon, color, trend }: { title: string, value: string | number, icon: any, color: string, trend?: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {trend && (
            <p className="text-xs font-medium text-green-600 mt-2 flex items-center gap-1">
              <TrendingUp size={12} />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const chartData = [
    { name: 'Sales', value: data.sales, color: '#3b82f6' },
    { name: 'Purchase', value: data.purchase, color: '#f59e0b' },
    { name: 'Paid', value: data.paid, color: '#10b981' },
    { name: 'Due', value: data.due, color: '#ef4444' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <StatCard 
          title="Total Sales" 
          value={formatCurrency(data.sales)} 
          icon={TrendingUp} 
          color="bg-blue-500"
          trend="+12.5% from last month"
        />
        <StatCard 
          title="Total Purchase" 
          value={formatCurrency(data.purchase)} 
          icon={TrendingDown} 
          color="bg-amber-500"
        />
        <StatCard 
          title="Total Customers" 
          value={data.customers} 
          icon={Users} 
          color="bg-purple-500"
        />
        <StatCard 
          title="Total Products" 
          value={data.products} 
          icon={Package} 
          color="bg-indigo-500"
        />
        <StatCard 
          title="Total Paid" 
          value={formatCurrency(data.paid)} 
          icon={Wallet} 
          color="bg-emerald-500"
        />
        <StatCard 
          title="Total Due" 
          value={formatCurrency(data.due)} 
          icon={Clock} 
          color="bg-rose-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Financial Overview</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dx={-10} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="flex flex-col items-center justify-center p-6 rounded-xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-all group">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors mb-3">
                <ShoppingCart size={24} />
              </div>
              <span className="text-sm font-semibold text-gray-700">New Sale</span>
            </button>
            <button className="flex flex-col items-center justify-center p-6 rounded-xl border border-gray-100 hover:bg-purple-50 hover:border-purple-200 transition-all group">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors mb-3">
                <Users size={24} />
              </div>
              <span className="text-sm font-semibold text-gray-700">Add Customer</span>
            </button>
            <button className="flex flex-col items-center justify-center p-6 rounded-xl border border-gray-100 hover:bg-emerald-50 hover:border-emerald-200 transition-all group">
              <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors mb-3">
                <Package size={24} />
              </div>
              <span className="text-sm font-semibold text-gray-700">Add Product</span>
            </button>
            <button className="flex flex-col items-center justify-center p-6 rounded-xl border border-gray-100 hover:bg-rose-50 hover:border-rose-200 transition-all group">
              <div className="p-3 rounded-full bg-rose-100 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors mb-3">
                <Download size={24} />
              </div>
              <span className="text-sm font-semibold text-gray-700">Export Reports</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
