import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import { formatCurrency, cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function StatCard({ title, value, icon: Icon, color, trend }: { title: string, value: string | number, icon: any, color: string, trend?: string }) {
  return (
    <div className="premium-card p-8 group">
      <div className="flex items-start justify-between">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{title}</p>
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
          </div>
          {trend && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">
              <TrendingUp size={12} />
              {trend}
            </div>
          )}
        </div>
        <div className={cn("p-4 rounded-2xl text-white shadow-xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6", color)}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ordersQ = query(collection(db, 'orders'), where('ownerId', '==', user.uid));
      const customersQ = query(collection(db, 'customers'), where('ownerId', '==', user.uid));
      const productsQ = query(collection(db, 'products'), where('ownerId', '==', user.uid));

      const [ordersSnap, customersSnap, productsSnap] = await Promise.all([
        getDocs(ordersQ),
        getDocs(customersQ),
        getDocs(productsQ)
      ]);

      const orders = ordersSnap.docs.map(doc => doc.data());
      
      const sales = orders.filter(o => o.type === 'Invoice').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const purchase = orders.filter(o => o.type === 'Purchase').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const totalPaid = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
      const totalDue = orders.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.paidAmount || 0)), 0);

      // Today's metrics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt?.toDate?.() || o.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      });

      const todaySales = todayOrders.filter(o => o.type === 'Invoice').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const todayDue = todayOrders.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.paidAmount || 0)), 0);

      // Monthly metrics
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      const monthlyOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt?.toDate?.() || o.createdAt);
        return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
      });

      const monthlySales = monthlyOrders.filter(o => o.type === 'Invoice').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const monthlyDue = monthlyOrders.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.paidAmount || 0)), 0);

      setData({
        sales,
        purchase,
        customers: customersSnap.size,
        products: productsSnap.size,
        paid: totalPaid,
        due: totalDue,
        todaySales,
        todayDue,
        monthlySales,
        monthlyDue
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">{t('loading')}</p>
      </div>
    );
  }

  const chartData = [
    { name: t('orders'), value: data.sales, color: '#0f172a' },
    { name: t('inventoryAssets'), value: data.purchase, color: '#f59e0b' },
    { name: t('capturedRevenue'), value: data.paid, color: '#10b981' },
    { name: t('outstandingCredit'), value: data.due, color: '#f43f5e' },
  ];

  return (
    <div className="space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            Market Overview
          </div>
          <h1 className="text-5xl font-serif font-black text-slate-900 tracking-tighter">{t('executiveOverview')}</h1>
          <p className="text-slate-500 font-medium">{t('realTimePerformance')}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        <StatCard 
          title={t('todaySales')}
          value={formatCurrency(data.todaySales)} 
          icon={TrendingUp} 
          color="bg-emerald-500"
        />
        <StatCard 
          title={t('monthlySales')}
          value={formatCurrency(data.monthlySales)} 
          icon={TrendingUp} 
          color="bg-slate-900"
          trend="Current Period"
        />
        <StatCard 
          title={t('totalRevenue')}
          value={formatCurrency(data.sales)} 
          icon={TrendingUp} 
          color="bg-slate-900"
          trend="Lifetime"
        />
        <StatCard 
          title={t('todayDue')}
          value={formatCurrency(data.todayDue)} 
          icon={Clock} 
          color="bg-rose-400"
        />
        <StatCard 
          title={t('monthlyDue')}
          value={formatCurrency(data.monthlyDue)} 
          icon={Clock} 
          color="bg-rose-500"
        />
        <StatCard 
          title={t('outstandingCredit')}
          value={formatCurrency(data.due)} 
          icon={Clock} 
          color="bg-rose-600"
        />
        <StatCard 
          title={t('inventoryAssets')}
          value={formatCurrency(data.purchase)} 
          icon={TrendingDown} 
          color="bg-amber-500"
        />
        <StatCard 
          title={t('totalCustomers')}
          value={data.customers} 
          icon={Users} 
          color="bg-slate-800"
        />
        <StatCard 
          title={t('products')}
          value={data.products} 
          icon={Package} 
          color="bg-slate-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 premium-card p-8 lg:p-10">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">{t('salesPerformance')}</h3>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{t('revenueTrends')}</p>
            </div>
          </div>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                  dx={-15}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc', radius: 12 }}
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '16px' }}
                />
                <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={50}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 premium-card p-8 lg:p-10 flex flex-col">
          <div className="mb-10">
            <h3 className="text-xl font-bold text-slate-900 mb-1">{t('quickActions')}</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{t('systemUpdate')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 flex-1">
            <Link to="/orders" className="flex items-center gap-5 p-5 rounded-3xl border border-slate-50 bg-slate-50/50 hover:bg-slate-900 hover:text-white transition-all duration-500 group overflow-hidden relative">
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm group-hover:scale-110 transition-transform duration-500 relative z-10">
                <ShoppingCart size={24} />
              </div>
              <div className="relative z-10">
                <span className="text-sm font-bold block">{t('addNewOrder')}</span>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-white/60 transition-colors">Generate new invoice or quote</span>
              </div>
            </Link>
            <Link to="/customers" className="flex items-center gap-5 p-5 rounded-3xl border border-slate-50 bg-slate-50/50 hover:bg-slate-900 hover:text-white transition-all duration-500 group overflow-hidden relative">
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm group-hover:scale-110 transition-transform duration-500 relative z-10">
                <Users size={24} />
              </div>
              <div className="relative z-10">
                <span className="text-sm font-bold block">{t('addCustomer')}</span>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-white/60 transition-colors">Expand your customer database</span>
              </div>
            </Link>
            <Link to="/products" className="flex items-center gap-5 p-5 rounded-3xl border border-slate-50 bg-slate-50/50 hover:bg-slate-900 hover:text-white transition-all duration-500 group overflow-hidden relative">
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm group-hover:scale-110 transition-transform duration-500 relative z-10">
                <Package size={24} />
              </div>
              <div className="relative z-10">
                <span className="text-sm font-bold block">{t('productCatalog')}</span>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-white/60 transition-colors">Update inventory and pricing</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
