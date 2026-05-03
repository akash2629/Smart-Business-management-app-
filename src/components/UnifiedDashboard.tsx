import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Users, 
  Package, 
  Clock, 
  Plus, 
  Trash2, 
  ChevronRight,
  Filter,
  Download,
  Calendar,
  Layers,
  Barcode,
  Search,
  ArrowUpRight,
  FileText,
  User as UserIcon,
  Phone,
  MapPin,
  X,
  Wallet,
  RefreshCcw,
  RotateCcw
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
import { BdtSign } from './Icons';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardData, Order, Customer, Product } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  orderBy,
  serverTimestamp,
  writeBatch,
  doc,
  increment,
  limit
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

function StatCard({ title, value, icon: Icon, color, trend }: { title: string, value: string | number, icon: any, color: string, trend?: string }) {
  return (
    <div className="bg-white sm:premium-card p-4 sm:p-6 group border-b border-slate-100 sm:border-none">
      <div className="flex items-start justify-between gap-1">
        <div className="space-y-2 sm:space-y-4">
          <div className="space-y-1">
            <p className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest sm:tracking-[0.2em]">{title}</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight tabular-nums truncate max-w-full leading-none">{value}</h3>
          </div>
          {trend && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[8px] font-bold">
              <TrendingUp size={10} />
              {trend}
            </div>
          )}
        </div>
        <div className={cn("p-2 sm:p-3 rounded-lg sm:rounded-xl text-white shadow-lg shrink-0", color)}>
          <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
        </div>
      </div>
    </div>
  );
}

export default function UnifiedDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const navigate = useNavigate();
  
  // Dashboard Metrics State
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  
  // Order Form State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<{
    customerId: string;
    type: 'Invoice' | 'Quotation' | 'Purchase';
    paidAmount: number;
    items: { productId: string, quantity: number, price: number }[];
  }>({
    customerId: '',
    type: 'Invoice',
    paidAmount: 0,
    items: [{ productId: '', quantity: 1, price: 0 }]
  });

  // Quick Forms State
  const [newCustomer, setNewCustomer] = useState<Customer>({ name: '', phone: '', address: '' });
  const [quickProduct, setQuickProduct] = useState<Product>({ name: '', code: '', price: 0, stock: 0 });

  // History State
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchStaticData();
      fetchRecentOrders();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoadingMetrics(true);
    try {
      const ordersQ = collection(db, 'users', user.uid, 'orders');
      const customersQ = collection(db, 'users', user.uid, 'customers');
      const productsQ = collection(db, 'users', user.uid, 'products');
      const expensesQ = collection(db, 'users', user.uid, 'expenses');

      const [ordersSnap, customersSnap, productsSnap, expensesSnap] = await Promise.all([
        getDocs(ordersQ),
        getDocs(customersQ),
        getDocs(productsQ),
        getDocs(expensesQ)
      ]);

      const orders = ordersSnap.docs.map(doc => doc.data());
      const expenses = expensesSnap.docs.map(doc => doc.data());
      
      const sales = orders.filter(o => o.type === 'Invoice').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const purchase = orders.filter(o => o.type === 'Purchase').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const totalPaid = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
      const totalDue = orders.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.paidAmount || 0)), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayOrders = orders.filter(o => {
        const d = new Date(o.createdAt?.toDate?.() || o.createdAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });

      const todayExpensesData = expenses.filter(e => {
        const d = new Date(e.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });

      const monthOrders = orders.filter(o => {
        const d = new Date(o.createdAt?.toDate?.() || o.createdAt);
        return d >= firstDayOfMonth;
      });

      const monthExpensesData = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= firstDayOfMonth;
      });

      const todaySales = todayOrders.filter(o => o.type === 'Invoice').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const todayDue = todayOrders.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.paidAmount || 0)), 0);
      const todayExpenses = todayExpensesData.reduce((sum, e) => sum + (e.amount || 0), 0);

      const monthlySales = monthOrders.filter(o => o.type === 'Invoice').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const monthlyDue = monthOrders.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.paidAmount || 0)), 0);
      const monthlyExpenses = monthExpensesData.reduce((sum, e) => sum + (e.amount || 0), 0);

      setData({
        sales, purchase, customers: customersSnap.size, products: productsSnap.size,
        paid: totalPaid, due: totalDue, todaySales, todayDue,
        monthlySales, monthlyDue, totalExpenses, todayExpenses, monthlyExpenses
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchStaticData = async () => {
    if (!user) return;
    try {
      const customersSnap = await getDocs(collection(db, 'users', user.uid, 'customers'));
      const productsSnap = await getDocs(collection(db, 'users', user.uid, 'products'));
      setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[]);
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    } catch (e) { console.error(e); }
  };

  const fetchRecentOrders = async () => {
    if (!user) return;
    try {
      // Simplified query to avoid composite index requirements in dev environments
      const q = query(collection(db, 'users', user.uid, 'orders'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      // Filter client-side
      setRecentOrders(orders.filter(o => o.type === 'Invoice').slice(0, 5));
    } catch (e) { 
      console.error('Recent Orders Fetch Error:', e);
    }
  };

  const calculateTotal = () => orderForm.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!orderForm.customerId) return toast.error('Select a Customer');
    
    const total = calculateTotal();
    const customer = customers.find(c => c.id === orderForm.customerId);

    try {
      const batch = writeBatch(db);
      const ordersColRef = collection(db, 'users', user.uid, 'orders');
      const orderRef = doc(ordersColRef);
      
      batch.set(orderRef, {
        customerId: orderForm.customerId,
        customerName: customer?.name || 'Unknown',
        totalAmount: total,
        paidAmount: orderForm.paidAmount,
        status: orderForm.paidAmount >= total ? 'Paid' : 'Due',
        type: orderForm.type,
        ownerId: user.uid, // Keeping ownerId for backward compatibility within subcoll if needed, but path is primary
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      orderForm.items.forEach(item => {
        const itemRef = doc(collection(orderRef, 'items'));
        batch.set(itemRef, { ...item, ownerId: user.uid });
        
        // Update Inventory Stock
        if (item.productId && orderForm.type !== 'Quotation') {
          const productRef = doc(db, 'users', user.uid, 'products', item.productId);
          // If it's a purchase from vendor, we increment stock, otherwise decrement
          const stockChange = orderForm.type === 'Purchase' ? item.quantity : -item.quantity;
          batch.update(productRef, { stock: increment(stockChange) });
        }
      });

      await batch.commit();
      toast.success('Order Registered Successfully');
      setOrderForm({ customerId: '', type: 'Invoice', paidAmount: 0, items: [{ productId: '', quantity: 1, price: 0 }] });
      fetchDashboardData();
      fetchRecentOrders();
    } catch (e) { toast.error('Emission Failed'); }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...orderForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'productId') {
      const p = products.find(prod => prod.id === value);
      if (p) newItems[index].price = p.price;
    }
    setOrderForm({ ...orderForm, items: newItems });
  };

  const addItem = () => setOrderForm({ ...orderForm, items: [...orderForm.items, { productId: '', quantity: 1, price: 0 }] });
  const removeItem = (index: number) => setOrderForm({ ...orderForm, items: orderForm.items.filter((_, i) => i !== index) });

  const chartData = data ? [
    { name: t('orders'), value: data.sales, color: colors.primary },
    { name: 'Stock', value: data.purchase, color: '#f59e0b' },
    { name: 'Cash', value: data.paid, color: colors.accent },
    { name: 'Credit', value: data.due, color: '#f43f5e' },
  ] : [];

  return (
    <div className="space-y-0 sm:space-y-10 max-w-[1600px] mx-auto pb-4 sm:pb-20 px-0 sm:px-0 bg-[#FDFCFB]">
      {/* Header Section */}
      <header className="flex flex-row items-center justify-between gap-2 sm:gap-6 px-4 py-2 sm:px-6 sm:py-3 bg-white/95 backdrop-blur-xl border-b border-slate-100 sticky top-[60px] sm:top-[70px] lg:top-[110px] z-40 transition-all duration-300 -mx-4 sm:-mx-6 sm:mb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 sm:gap-3 text-[7px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">
            <div className="w-3 sm:w-5 h-[1.5px] bg-brand-primary"></div>
            Management Terminal
          </div>
          <h1 className="text-lg sm:text-3xl font-serif font-black text-slate-900 tracking-tighter leading-none">SmartShop</h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Real-Time Intelligence</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
           <button 
             onClick={() => navigate('/settings')}
             className="flex items-center justify-center p-2.5 sm:p-3 bg-white border border-rose-100 rounded-xl sm:rounded-2xl text-rose-600 hover:bg-rose-50 transition-all shadow-sm"
             title="System Restart"
           >
             <RotateCcw size={16} className="sm:w-[20px] sm:h-[20px]" />
           </button>
           <div className="px-3 sm:px-5 py-2 sm:py-3 bg-white border border-slate-100 rounded-xl sm:rounded-3xl shadow-sm flex items-center gap-2 sm:gap-3">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-ping"></div>
              <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Live</span>
           </div>
        </div>
      </header>

      {/* KPI Section - Flush on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 sm:gap-6 border-b border-slate-100 sm:border-none">
        {loadingMetrics ? (
          Array(4).fill(0).map((_, i) => <div key={i} className="h-14 sm:h-24 bg-slate-50 animate-pulse border-r border-slate-50 last:border-none" />)
        ) : (
          <>
            <StatCard title={t('todaySales')} value={formatCurrency(data?.todaySales || 0)} icon={TrendingUp} color="bg-brand-primary" />
            <StatCard title={t('totalRevenue')} value={formatCurrency(data?.sales || 0)} icon={TrendingUp} color="bg-indigo-600" />
            <StatCard title={t('totalDue')} value={formatCurrency(data?.due || 0)} icon={Clock} color="bg-rose-500" />
            <StatCard title={t('products')} value={data?.products || 0} icon={Package} color="bg-amber-500" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-0 sm:gap-10">
        
        {/* Left Column: Operation Zone */}
        <div className="xl:col-span-8 space-y-0 sm:space-y-10">
          
          {/* New Order Form (Directly on Page) */}
          <section className="bg-white sm:premium-card overflow-hidden">
            <div className="p-4 sm:p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200 shrink-0">
                  <ShoppingCart size={18} className="sm:w-[18px] sm:h-[18px]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">{t('invoiceNode')}</h2>
                  <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('marketEmission')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => setIsCustomerModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                    <Users size={12} /> {t('addCustomer').split(' ')[0]}
                 </button>
                 <button onClick={() => setIsQuickProductModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                    <Package size={12} /> + {t('product')}
                 </button>
              </div>
            </div>
            
            <form onSubmit={handleOrderSubmit} className="p-3 sm:p-8 space-y-4 sm:space-y-8 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
                <div className="md:col-span-2">
                  <label className="detail-label text-[7px] sm:text-[9px] mb-1 sm:mb-2 px-1">{t('recipientProfile')}</label>
                  <select 
                    required
                    className="w-full px-3 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none font-bold text-slate-700 transition-all cursor-pointer text-[10px] sm:text-base h-11 sm:h-auto"
                    value={orderForm.customerId}
                    onChange={(e) => setOrderForm({...orderForm, customerId: e.target.value})}
                  >
                    <option value="">{t('targetCustomer')}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                  </select>
                </div>
                <div>
                  <label className="detail-label text-[7px] sm:text-[9px] mb-1 sm:mb-2 px-1">{t('documentClass')}</label>
                  <div className="flex gap-2">
                    {['Invoice', 'Quotation'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setOrderForm({...orderForm, type: type as any})}
                        className={cn(
                          "flex-1 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest border transition-all h-11 sm:h-auto",
                          orderForm.type === type ? "bg-slate-900 border-slate-900 text-white shadow-xl" : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                        )}
                      >
                        {type === 'Quotation' ? 'Quote' : type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-4">
                <div className="flex items-center justify-between mb-1 sm:mb-2 px-1">
                  <h3 className="text-[8px] sm:text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
                    <Layers size={10} className="sm:w-[12px] sm:h-[12px] text-slate-300" /> {t('items')}
                  </h3>
                  <button type="button" onClick={addItem} className="text-[7px] sm:text-[10px] font-black text-brand-primary border-b border-brand-primary/20 hover:border-brand-primary pb-0.5 tracking-widest uppercase">
                    {t('addItems')} +
                  </button>
                </div>
                
                <div className="space-y-3 sm:space-y-3">
                  {orderForm.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-end bg-slate-50/20 p-4 sm:p-4 rounded-xl sm:rounded-[1.5rem] border border-slate-100 group hover:border-slate-200 transition-colors relative">
                      <div className="md:col-span-6">
                        <label className="detail-label text-[7px] sm:text-[9px] mb-1.5 sm:hidden px-1">{t('product')}</label>
                        <select
                          required
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-100 bg-white focus:border-brand-primary outline-none font-bold text-slate-700 text-[10px] sm:text-sm h-11 sm:h-auto"
                          value={item.productId}
                          onChange={(e) => updateItem(index, 'productId', e.target.value)}
                        >
                          <option value="">{t('assetName')}</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 min-[440px]:grid-cols-3 md:col-span-4 gap-3">
                        <div>
                          <label className="detail-label text-[7px] sm:text-[9px] mb-1.5 sm:hidden px-1">{t('unitPrice')}</label>
                          <input
                            type="number"
                            className="w-full px-2 py-2.5 rounded-lg border border-slate-100 bg-white outline-none font-bold text-slate-900 text-[10px] sm:text-sm tabular-nums text-center h-11 sm:h-auto"
                            value={item.price || 0}
                            onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="detail-label text-[7px] sm:text-[9px] mb-1.5 sm:hidden px-1">{t('quantity')}</label>
                          <input
                            type="number"
                            className="w-full px-2 py-2.5 rounded-lg border border-slate-100 bg-white outline-none font-bold text-slate-900 text-[10px] sm:text-sm tabular-nums text-center h-11 sm:h-auto"
                            value={item.quantity || 0}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-span-2 min-[440px]:col-span-1 md:hidden">
                           <label className="detail-label text-[7px] sm:text-[9px] mb-1.5 px-1">{t('subtotal')}</label>
                           <div className="px-2 py-2.5 bg-slate-900 text-white rounded-lg text-[10px] font-black text-center h-11 flex items-center justify-center">
                              {formatCurrency(item.price * item.quantity)}
                           </div>
                        </div>
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button type="button" onClick={() => removeItem(index)} className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center text-slate-300 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 rounded-lg">
                          <Trash2 size={18} className="sm:w-[16px] sm:h-[16px]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-8 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col items-center sm:items-start w-full sm:w-auto">
                   <p className="text-white/40 text-[7px] sm:text-[9px] font-black uppercase tracking-widest mb-1 sm:mb-1 text-center sm:text-left">{t('totalValuation')}</p>
                   <h3 className="text-2xl sm:text-4xl font-black tracking-tighter tabular-nums text-brand-accent truncate max-w-full leading-none">{formatCurrency(calculateTotal())}</h3>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                   <div className="flex-1 sm:w-40">
                      <p className="text-white/40 text-[7px] sm:text-[9px] font-black uppercase tracking-widest mb-1 sm:hidden text-center">{t('paidAmount')}</p>
                      <input 
                        type="number"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-2 sm:px-4 py-2 sm:py-3 text-xl sm:text-xl font-black outline-none focus:border-brand-accent transition-all tabular-nums text-center h-12 sm:h-auto"
                        value={orderForm.paidAmount || 0}
                        onChange={(e) => setOrderForm({...orderForm, paidAmount: parseFloat(e.target.value) || 0})}
                      />
                   </div>
                   <button type="submit" className="px-6 sm:px-6 py-2 sm:py-4 bg-brand-accent text-slate-900 rounded-xl font-black text-xs sm:text-[10px] uppercase tracking-widest sm:tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-accent/20 h-12 sm:h-auto">
                      {t('commit')}
                   </button>
                </div>
                {/* Visual decoration for compact mobile view */}
                <div className="absolute top-0 right-0 w-10 sm:w-20 h-10 sm:h-20 bg-brand-accent/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              </div>
            </form>
          </section>

          {/* Financial Reports Node */}
          <section className="bg-white sm:premium-card p-4 sm:p-8 border-b border-slate-100 sm:border-none">
            <div className="flex items-center justify-between mb-4 sm:mb-8">
              <div>
                <h3 className="text-sm sm:text-xl font-bold text-slate-900 mb-0.5 sm:mb-1">{t('financialReports')}</h3>
                <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('aggregateReports')}</p>
              </div>
              <button 
                onClick={() => {
                  toast.success('Generating Intelligence Report...');
                }}
                className="w-10 h-10 flex items-center justify-center bg-slate-900 text-white rounded-xl shadow-lg hover:scale-110 transition-all"
              >
                <Download size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div onClick={() => navigate('/costing')} className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-50 transition-all hover:bg-white hover:border-slate-100 cursor-pointer group">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                       <TrendingDown size={14} />
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold text-slate-700">{t('costing')}</span>
                 </div>
                 <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 transition-all hover:bg-white hover:border-slate-100 cursor-pointer group">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Today</span>
                    <span className="text-xs font-black text-slate-900 tabular-nums">{formatCurrency(data?.todayExpenses || 0)}</span>
                 </div>
                 <div className="flex flex-col text-right">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Month</span>
                    <span className="text-xs font-black text-slate-900 tabular-nums">{formatCurrency(data?.monthlyExpenses || 0)}</span>
                 </div>
              </div>
              <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-50 transition-all hover:bg-white hover:border-slate-100 cursor-pointer group">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                       <FileText size={14} />
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold text-slate-700">Daily Summary</span>
                 </div>
                 <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-50 transition-all hover:bg-white hover:border-slate-100 cursor-pointer group">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                       <Users size={14} />
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold text-slate-700">Credit Matrix</span>
                 </div>
                 <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </section>

          {/* Sales Trends Chart */}
          <section className="bg-white sm:premium-card p-4 sm:p-8 border-b border-slate-100 sm:border-none">
            <div className="mb-6 sm:mb-10">
              <h3 className="text-sm sm:text-xl font-bold text-slate-900 mb-0.5 sm:mb-1">{t('salesPerformance')}</h3>
              <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('revenueAllocation')}</p>
            </div>
            <div className="h-48 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={5} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dx={-5} />
                  <Tooltip cursor={{ fill: '#f8fafc', radius: 10 }} contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.1)', fontSize: '10px' }} />
                  <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={40}>
                    {chartData.map((e, index) => <Cell key={index} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Right Column: Intelligent Overview & Reports */}
        <div className="xl:col-span-4 space-y-0 sm:space-y-10">
          
          {/* Intelligence Reports */}
          <section className="bg-white sm:premium-card p-4 sm:p-8 flex flex-col h-full border-b border-slate-100 sm:border-none">
            <div className="mb-3 sm:mb-8">
              <h3 className="text-sm sm:text-lg font-bold text-slate-900 mb-0.5 sm:mb-1">{t('journal')}</h3>
              <p className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest text-wrap">{t('recentInteraction')}</p>
            </div>
            <div className="space-y-2 sm:space-y-4 flex-1">
              {recentOrders.map((o) => (
                <div key={o.id} className="p-2 sm:p-4 rounded-lg sm:rounded-2xl bg-slate-50/50 border border-slate-50 flex items-center justify-between hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all group">
                   <div className="flex items-center gap-2 sm:gap-4">
                      <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-md sm:rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                         <FileText size={12} className="sm:w-[18px] sm:h-[18px]" />
                      </div>
                      <div className="min-w-0">
                         <p className="text-[10px] sm:text-sm font-bold text-slate-900 tracking-tight truncate max-w-[80px] sm:max-w-none">{o.customerName}</p>
                         <p className="text-[6px] sm:text-[10px] font-medium text-slate-400 uppercase tabular-nums">#{o.id?.slice(-4)}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] sm:text-sm font-black text-slate-900 tabular-nums">{formatCurrency(o.totalAmount)}</p>
                      <p className={cn("text-[6px] sm:text-[9px] font-black uppercase tracking-widest", o.status === 'Paid' ? "text-emerald-500" : "text-amber-500")}>
                        {o.status}
                      </p>
                   </div>
                </div>
              ))}
              {recentOrders.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                   <Clock size={30} className="mb-2" />
                   <p className="text-[8px] font-black uppercase tracking-widest">{t('awaitingTransactions')}</p>
                </div>
              )}
            </div>
            <div className="mt-4 sm:mt-8 pt-4 sm:pt-8 border-t border-slate-50">
               <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-indigo-50/50 border border-indigo-100">
                     <p className="text-[7px] sm:text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5 sm:mb-1">Conv.</p>
                     <p className="text-sm sm:text-xl font-black text-indigo-700">92%</p>
                  </div>
                  <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50/50 border border-emerald-100">
                     <p className="text-[7px] sm:text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-0.5 sm:mb-1">Eff.</p>
                     <p className="text-sm sm:text-xl font-black text-emerald-700">Full</p>
                  </div>
               </div>
            </div>
          </section>

          {/* Quick Stats Grid */}
          <section className="grid grid-cols-2 xl:grid-cols-1 gap-0 sm:gap-4 border-b border-slate-100 sm:border-none">
             <div className="bg-white sm:premium-card p-4 sm:p-6 border-r border-slate-100 sm:border-l-4 sm:border-emerald-500 sm:border-r-0">
                <div className="flex items-center justify-between gap-1">
                   <div>
                      <p className="text-[7px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5 sm:mb-1">Reserves</p>
                      <h4 className="text-[11px] sm:text-xl font-black text-slate-900 tabular-nums truncate max-w-[60px] sm:max-w-none leading-none">{formatCurrency(data?.paid || 0)}</h4>
                   </div>
                   <div className="w-6 h-6 sm:w-12 sm:h-12 rounded-md sm:rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                      <Wallet size={12} className="sm:w-[20px] sm:h-[20px]" />
                   </div>
                </div>
             </div>
             <div className="bg-white sm:premium-card p-4 sm:p-6 sm:border-l-4 sm:border-rose-500">
                <div className="flex items-center justify-between gap-1">
                   <div>
                      <p className="text-[7px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5 sm:mb-1">Risk</p>
                      <h4 className="text-[11px] sm:text-xl font-black text-slate-900 tabular-nums truncate max-w-[60px] sm:max-w-none leading-none">{formatCurrency(data?.due || 0)}</h4>
                   </div>
                   <div className="w-6 h-6 sm:w-12 sm:h-12 rounded-md sm:rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                      <RefreshCcw size={12} className="sm:w-[20px] sm:h-[20px]" />
                   </div>
                </div>
             </div>
          </section>
        </div>
      </div>

      {/* Modals copied from OrderList logic for functional coverage */}
      {/* (Customer Modal and Quick Product Modal) */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsCustomerModalOpen(false)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="bg-white rounded-none sm:rounded-[3rem] w-full max-w-md h-full sm:h-auto sm:max-h-[90vh] shadow-2xl relative z-10 overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white sm:bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-3 sm:gap-6">
                  <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-xl sm:rounded-3xl flex items-center justify-center shadow-xl shadow-slate-200">
                    <UserIcon size={20} className="sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight">{t('registerCustomer')}</h2>
                    <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('addCustomer')}</p>
                  </div>
                </div>
                <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={18} className="sm:w-6 sm:h-6" />
                </button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!user) return;
                try {
                  const docRef = await addDoc(collection(db, 'users', user.uid, 'customers'), { 
                    ...newCustomer, 
                    ownerId: user.uid,
                    total_amount: 0,
                    total_paid: 0,
                    remaining_balance: 0,
                    createdAt: serverTimestamp()
                  });
                  toast.success(t('assetCataloged'));
                  setIsCustomerModalOpen(false);
                  
                  // Refetch and auto-select
                  await fetchStaticData();
                  setOrderForm(prev => ({ ...prev, customerId: docRef.id }));
                  
                } catch (err) {
                  toast.error(t('operationFailed'));
                }
              }} className="p-4 sm:p-10 space-y-4 sm:space-y-6 overflow-y-auto flex-1 pb-20 sm:pb-10">
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('fullName')}</label>
                    <input 
                      required 
                      placeholder={t('fullName')} 
                      className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-50/50 border border-slate-100 outline-none font-bold text-[10px] sm:text-sm h-11 sm:h-auto focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all" 
                      onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('contactReference')}</label>
                    <input 
                      required
                      placeholder="e.g. +880 1XXX XXXXXX" 
                      className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-50/50 border border-slate-100 outline-none font-bold text-[10px] sm:text-sm h-11 sm:h-auto focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all" 
                      onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('territoryAddress')}</label>
                    <textarea 
                      placeholder={t('addressPlaceholder')} 
                      className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-50/50 border border-slate-100 outline-none font-bold text-[10px] sm:text-sm min-h-[80px] sm:min-h-[120px] focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all" 
                      onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="pt-2 sm:pt-4 shrink-0 mt-auto">
                  <button type="submit" className="w-full py-3.5 sm:py-5 bg-slate-900 text-white rounded-xl sm:rounded-[2rem] font-black uppercase tracking-widest text-[10px] sm:text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 h-12 sm:h-auto">
                    {t('executionEntry')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

         {isQuickProductModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsQuickProductModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white rounded-none sm:rounded-[3rem] w-full max-w-md shadow-2xl relative z-10 overflow-hidden h-full sm:h-auto flex flex-col">
              <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white sm:bg-transparent shrink-0">
                 <div>
                    <h2 className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight">{t('quickProductCapture')}</h2>
                    <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('registerAsset')}</p>
                 </div>
                 <button onClick={() => setIsQuickProductModalOpen(false)} className="text-slate-300 p-2"><X size={18} /></button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!user) return;
                await addDoc(collection(db, 'users', user.uid, 'products'), { ...quickProduct, ownerId: user.uid });
                toast.success(t('assetCataloged'));
                setIsQuickProductModalOpen(false);
                fetchStaticData();
              }} className="p-4 sm:p-10 space-y-4 sm:space-y-6 flex-1 overflow-y-auto pb-20 sm:pb-10">
                <input required placeholder={t('productName')} className="w-full px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold text-sm h-12 sm:h-auto" onChange={e => setQuickProduct({...quickProduct, name: e.target.value})} />
                <input required type="number" placeholder={t('unitPricePlaceholder')} className="w-full px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold text-sm h-12 sm:h-auto" value={quickProduct.price || 0} onChange={e => setQuickProduct({...quickProduct, price: parseFloat(e.target.value) || 0})} />
                <input required type="number" placeholder={t('initialStockPlaceholder')} className="w-full px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold text-sm h-12 sm:h-auto" value={quickProduct.stock || 0} onChange={e => setQuickProduct({...quickProduct, stock: parseInt(e.target.value) || 0})} />
                <div className="mt-auto shrink-0 pt-4">
                  <button type="submit" className="w-full py-3.5 sm:py-5 bg-slate-900 text-white rounded-xl sm:rounded-[2rem] font-black uppercase tracking-widest text-[10px] sm:text-xs">{t('registerAsset')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
