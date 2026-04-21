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
  doc
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

function StatCard({ title, value, icon: Icon, color, trend }: { title: string, value: string | number, icon: any, color: string, trend?: string }) {
  return (
    <div className="premium-card p-6 group">
      <div className="flex items-start justify-between">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">{title}</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{value}</h3>
          </div>
          {trend && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold">
              <TrendingUp size={10} />
              {trend}
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl text-white shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6", color)}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function UnifiedDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  
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

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = orders.filter(o => {
        const d = new Date(o.createdAt?.toDate?.() || o.createdAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });
      const todaySales = todayOrders.filter(o => o.type === 'Invoice').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const todayDue = todayOrders.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.paidAmount || 0)), 0);

      setData({
        sales, purchase, customers: customersSnap.size, products: productsSnap.size,
        paid: totalPaid, due: totalDue, todaySales, todayDue,
        monthlySales: 0, monthlyDue: 0 // Placeholder
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
      const customersSnap = await getDocs(query(collection(db, 'customers'), where('ownerId', '==', user.uid)));
      const productsSnap = await getDocs(query(collection(db, 'products'), where('ownerId', '==', user.uid)));
      setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[]);
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    } catch (e) { console.error(e); }
  };

  const fetchRecentOrders = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'orders'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'), where('type', '==', 'Invoice'));
      const snap = await getDocs(q);
      setRecentOrders(snap.docs.slice(0, 5).map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
    } catch (e) { console.error(e); }
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
      const orderRef = doc(collection(db, 'orders'));
      
      batch.set(orderRef, {
        customerId: orderForm.customerId,
        customerName: customer?.name || 'Unknown',
        totalAmount: total,
        paidAmount: orderForm.paidAmount,
        status: orderForm.paidAmount >= total ? 'Paid' : 'Due',
        type: orderForm.type,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      orderForm.items.forEach(item => {
        const itemRef = doc(collection(orderRef, 'items'));
        batch.set(itemRef, { ...item, ownerId: user.uid });
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
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
            <div className="w-6 h-[2px] bg-brand-primary"></div>
            Management Terminal
          </div>
          <h1 className="text-4xl font-serif font-black text-slate-900 tracking-tighter">Unified Command Center</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Real-Time Intelligence & Operations</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="px-5 py-3 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Online</span>
           </div>
        </div>
      </header>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loadingMetrics ? (
          Array(4).fill(0).map((_, i) => <div key={i} className="h-24 bg-slate-50 rounded-3xl animate-pulse" />)
        ) : (
          <>
            <StatCard title={t('todaySales')} value={formatCurrency(data?.todaySales || 0)} icon={TrendingUp} color="bg-brand-primary" />
            <StatCard title="Global Revenue" value={formatCurrency(data?.sales || 0)} icon={TrendingUp} color="bg-indigo-600" />
            <StatCard title="Outstanding Credit" value={formatCurrency(data?.due || 0)} icon={Clock} color="bg-rose-500" />
            <StatCard title="Active Inventory" value={data?.products || 0} icon={Package} color="bg-amber-500" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        
        {/* Left Column: Operation Zone */}
        <div className="xl:col-span-8 space-y-10">
          
          {/* New Order Form (Directly on Page) */}
          <section className="premium-card overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                  <ShoppingCart size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Direct Invoice Node</h2>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Immediate Transaction Emission</p>
                </div>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => setIsCustomerModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">
                    <Users size={14} /> {t('addCustomer')}
                 </button>
                 <button onClick={() => setIsQuickProductModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">
                    <Package size={14} /> New Product
                 </button>
              </div>
            </div>
            
            <form onSubmit={handleOrderSubmit} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="detail-label">Asset Recipient (Customer)</label>
                  <select 
                    required
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none font-bold text-slate-700 transition-all"
                    value={orderForm.customerId}
                    onChange={(e) => setOrderForm({...orderForm, customerId: e.target.value})}
                  >
                    <option value="">Select Recipient</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                  </select>
                </div>
                <div>
                  <label className="detail-label">Document Type</label>
                  <div className="flex gap-2">
                    {['Invoice', 'Quotation'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setOrderForm({...orderForm, type: type as any})}
                        className={cn(
                          "flex-1 py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all",
                          orderForm.type === type ? "bg-slate-900 border-slate-900 text-white shadow-xl" : "bg-white border-slate-100 text-slate-400"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={14} className="text-slate-300" /> Items List
                  </h3>
                  <button type="button" onClick={addItem} className="text-[10px] font-black text-brand-primary border-b border-brand-primary/20 hover:border-brand-primary pb-0.5 tracking-widest uppercase">
                    Add Line Item +
                  </button>
                </div>
                
                <div className="space-y-3">
                  {orderForm.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50/30 p-4 rounded-[1.5rem] border border-slate-50 group hover:border-slate-100 transition-colors">
                      <div className="md:col-span-6">
                        <label className="text-[10px] font-black text-slate-300 uppercase mb-2 block">Product Reference</label>
                        <select
                          required
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-white focus:border-brand-primary outline-none font-bold text-slate-700 text-sm"
                          value={item.productId}
                          onChange={(e) => updateItem(index, 'productId', e.target.value)}
                        >
                          <option value="">Select Item</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price)})</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-slate-300 uppercase mb-2 block">Valuation</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-white outline-none font-bold text-slate-900 text-sm tabular-nums"
                          value={item.price}
                          onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-slate-300 uppercase mb-2 block">Qty</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-white outline-none font-bold text-slate-900 text-sm tabular-nums"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button type="button" onClick={() => removeItem(index)} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-600 transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
                <div>
                   <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">Aggregate Valuation</p>
                   <h3 className="text-4xl font-black tracking-tighter tabular-nums">{formatCurrency(calculateTotal())}</h3>
                </div>
                <div className="flex items-center gap-6 w-full md:w-auto">
                   <div className="flex-1 md:w-48">
                      <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-3">Tendered Amount</p>
                      <input 
                        type="number"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-2xl font-black outline-none focus:border-white transition-all tabular-nums"
                        value={orderForm.paidAmount}
                        onChange={(e) => setOrderForm({...orderForm, paidAmount: parseFloat(e.target.value) || 0})}
                      />
                   </div>
                   <button type="submit" className="px-8 py-5 bg-white text-slate-900 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all">
                      Emit Invoice
                   </button>
                </div>
              </div>
            </form>
          </section>

          {/* Financial Reports Node */}
          <section className="premium-card p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">Financial Intelligence</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Performance Reports</p>
              </div>
              <button 
                onClick={() => {
                  toast.success('Generating Intelligence Report...');
                  // Logic for quick report export
                }}
                className="w-10 h-10 flex items-center justify-center bg-slate-900 text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all"
              >
                <Download size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-50 transition-all hover:bg-white hover:border-slate-100 cursor-pointer group">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                       <FileText size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Daily Revenue Summary</span>
                 </div>
                 <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-50 transition-all hover:bg-white hover:border-slate-100 cursor-pointer group">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                       <Users size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Customer Credit Report</span>
                 </div>
                 <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </section>

          {/* Sales Trends Chart */}
          <section className="premium-card p-8">
            <div className="mb-10">
              <h3 className="text-xl font-bold text-slate-900 mb-1">Financial Intelligence</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Allocation Analytics</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc', radius: 12 }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={50}>
                    {chartData.map((e, index) => <Cell key={index} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Right Column: Intelligent Overview & Reports */}
        <div className="xl:col-span-4 space-y-10">
          
          {/* Intelligence Reports */}
          <section className="premium-card p-8 flex flex-col h-full">
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Operation Journal</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recent Activity Stream</p>
            </div>
            <div className="space-y-4 flex-1">
              {recentOrders.map((o) => (
                <div key={o.id} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-50 flex items-center justify-between hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all group">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                         <FileText size={18} />
                      </div>
                      <div>
                         <p className="text-sm font-bold text-slate-900 tracking-tight">{o.customerName}</p>
                         <p className="text-[10px] font-medium text-slate-400 uppercase">Ref: #{o.id?.slice(-6)}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(o.totalAmount)}</p>
                      <p className={cn("text-[9px] font-black uppercase tracking-widest", o.status === 'Paid' ? "text-emerald-500" : "text-amber-500")}>
                        {o.status}
                      </p>
                   </div>
                </div>
              ))}
              {recentOrders.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                   <Clock size={40} className="mb-4" />
                   <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Transactions</p>
                </div>
              )}
            </div>
            <div className="mt-8 pt-8 border-t border-slate-50">
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                     <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Conversion</p>
                     <p className="text-xl font-black text-indigo-700">92%</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                     <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Efficiency</p>
                     <p className="text-xl font-black text-emerald-700">High</p>
                  </div>
               </div>
            </div>
          </section>

          {/* Quick Stats Grid */}
          <section className="space-y-4">
             <div className="premium-card p-6 border-l-4 border-emerald-500">
                <div className="flex items-center justify-between">
                   <div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Capital Reserves</p>
                      <h4 className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(data?.paid || 0)}</h4>
                   </div>
                   <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Wallet size={20} />
                   </div>
                </div>
             </div>
             <div className="premium-card p-6 border-l-4 border-rose-500">
                <div className="flex items-center justify-between">
                   <div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Risk Exposure</p>
                      <h4 className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(data?.due || 0)}</h4>
                   </div>
                   <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                      <RefreshCcw size={20} />
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCustomerModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl relative z-10 p-10">
              <h2 className="text-2xl font-black text-slate-900 mb-8">Register Customer</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                await addDoc(collection(db, 'customers'), { ...newCustomer, ownerId: user?.uid });
                toast.success('Customer Captured');
                setIsCustomerModalOpen(false);
                fetchStaticData();
              }} className="space-y-6">
                <input required placeholder="Name" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold" onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                <input placeholder="Phone" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold" onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
                <textarea placeholder="Address" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold min-h-[100px]" onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} />
                <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs">Execute Entry</button>
              </form>
            </motion.div>
          </div>
        )}

        {isQuickProductModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsQuickProductModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl relative z-10 p-10">
              <h2 className="text-2xl font-black text-slate-900 mb-8">Quick Product Capture</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                await addDoc(collection(db, 'products'), { ...quickProduct, ownerId: user?.uid });
                toast.success('Asset Cataloged');
                setIsQuickProductModalOpen(false);
                fetchStaticData();
              }} className="space-y-6">
                <input required placeholder="Product Name" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold" onChange={e => setQuickProduct({...quickProduct, name: e.target.value})} />
                <input required type="number" placeholder="Unit Price" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold" onChange={e => setQuickProduct({...quickProduct, price: parseFloat(e.target.value)})} />
                <input required type="number" placeholder="Initial Stock" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold" onChange={e => setQuickProduct({...quickProduct, stock: parseInt(e.target.value)})} />
                <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs">Register Asset</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
