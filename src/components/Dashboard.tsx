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
  Download,
  RefreshCcw
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
import { useTheme } from '../context/ThemeContext';

function StatCard({ title, value, icon: Icon, color, trend }: { title: string, value: string | number, icon: any, color: string, trend?: string }) {
  return (
    <div className="premium-card p-5 sm:p-8 group h-full">
      <div className="flex items-start justify-between">
        <div className="space-y-3 sm:space-y-4 flex-1 min-w-0">
          <div className="space-y-1">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] truncate">{title}</p>
            <h3 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight truncate">{value}</h3>
          </div>
          {trend && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] sm:text-[10px] font-bold">
              <TrendingUp size={10} className="sm:w-3 sm:h-3" />
              {trend}
            </div>
          )}
        </div>
        <div className={cn("p-3 sm:p-4 rounded-xl sm:rounded-2xl text-white shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 shrink-0", color)}>
          <Icon size={20} className="sm:w-6 sm:h-6" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const ordersQ = collection(db, 'users', user.uid, 'orders');
      const customersQ = collection(db, 'users', user.uid, 'customers');
      const productsQ = collection(db, 'users', user.uid, 'products');

      const [ordersSnap, customersSnap, productsSnap] = await Promise.all([
        getDocs(ordersQ),
        getDocs(customersQ),
        getDocs(productsQ)
      ]).catch(err => {
        console.error('Firestore Error:', err);
        throw new Error('Failed to reach database. Check your connection.');
      });

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

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-slate-100 border-t-brand-primary rounded-full animate-spin"></div>
        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">{t('loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="premium-card p-8 sm:p-12 max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-50 text-rose-500 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-rose-100">
            <TrendingDown size={32} className="sm:w-10 sm:h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">Sync Interrupted</h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">{error}</p>
          </div>
          <button 
            onClick={fetchDashboardData}
            className="w-full bg-slate-900 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCcw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const chartData = [
    { name: t('orders'), value: data.sales, color: colors.primary },
    { name: t('inventoryAssets'), value: data.purchase, color: '#f59e0b' },
    { name: t('capturedRevenue'), value: data.paid, color: colors.accent },
    { name: t('outstandingCredit'), value: data.due, color: '#f43f5e' },
  ];

  return (
    <div className="space-y-8 sm:space-y-12 pb-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 px-1">
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-3 sm:w-4 h-[2px] bg-slate-200"></div>
            Overview
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif font-black text-slate-900 tracking-tighter leading-tight">{t('executiveOverview')}</h1>
          <p className="text-xs sm:text-base text-slate-500 font-medium">{t('realTimePerformance')}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
        <StatCard 
          title={t('todaySales')}
          value={formatCurrency(data.todaySales)} 
          icon={TrendingUp} 
          color="bg-brand-accent"
        />
        <StatCard 
          title={t('monthlySales')}
          value={formatCurrency(data.monthlySales)} 
          icon={TrendingUp} 
          color="bg-brand-primary"
          trend="This Month"
        />
        <StatCard 
          title={t('totalRevenue')}
          value={formatCurrency(data.sales)} 
          icon={TrendingUp} 
          color="bg-brand-primary"
          trend="Total"
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
          color="bg-brand-primary/80"
        />
        <StatCard 
          title={t('products')}
          value={data.products} 
          icon={Package} 
          color="bg-brand-primary/70"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
        <div className="lg:col-span-3 premium-card p-5 sm:p-8 lg:p-10">
          <div className="flex items-center justify-between mb-8 sm:mb-10">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">{t('salesPerformance')}</h3>
              <p className="text-[9px] sm:text-xs text-slate-400 font-medium uppercase tracking-wider">{t('revenueTrends')}</p>
            </div>
          </div>
          <div className="h-[300px] sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }} 
                  dx={-5}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc', radius: 12 }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '12px' }}
                />
                <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 premium-card p-5 sm:p-8 lg:p-10 flex flex-col">
          <div className="mb-6 sm:mb-10">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">{t('quickActions')}</h3>
            <p className="text-[9px] sm:text-xs text-slate-400 font-medium uppercase tracking-wider">{t('systemUpdate')}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:gap-4 flex-1">
            <Link to="/orders" className="flex items-center gap-4 sm:gap-5 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-50 bg-white sm:bg-slate-50/50 hover:bg-slate-900 hover:text-white transition-all duration-500 group overflow-hidden relative shadow-sm sm:shadow-none">
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900 sm:bg-white text-white sm:text-slate-900 shadow-sm group-hover:scale-110 group-hover:bg-white group-hover:text-slate-900 transition-all duration-500 relative z-10">
                <ShoppingCart size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="relative z-10">
                <span className="text-sm font-bold block">{t('addNewOrder')}</span>
                <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 group-hover:text-white/60 transition-colors">Generate new invoice or quote</span>
              </div>
            </Link>
            <Link to="/customers" className="flex items-center gap-4 sm:gap-5 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-50 bg-white sm:bg-slate-50/50 hover:bg-slate-900 hover:text-white transition-all duration-500 group overflow-hidden relative shadow-sm sm:shadow-none">
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-100 sm:bg-white text-slate-600 sm:text-slate-900 shadow-sm group-hover:scale-110 group-hover:bg-white group-hover:text-slate-900 transition-all duration-500 relative z-10">
                <Users size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="relative z-10">
                <span className="text-sm font-bold block">{t('addCustomer')}</span>
                <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 group-hover:text-white/60 transition-colors">Expand your customer database</span>
              </div>
            </Link>
            <Link to="/products" className="flex items-center gap-4 sm:gap-5 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-50 bg-white sm:bg-slate-50/50 hover:bg-slate-900 hover:text-white transition-all duration-500 group overflow-hidden relative shadow-sm sm:shadow-none">
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-100 sm:bg-white text-slate-600 sm:text-slate-900 shadow-sm group-hover:scale-110 group-hover:bg-white group-hover:text-slate-900 transition-all duration-500 relative z-10">
                <Package size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="relative z-10">
                <span className="text-sm font-bold block">{t('productCatalog')}</span>
                <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 group-hover:text-white/60 transition-colors">Update inventory and pricing</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
