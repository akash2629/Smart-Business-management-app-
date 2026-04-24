import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, User, Phone, MapPin, X, Download, History, Eye, Calendar, ShoppingCart, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Customer, Order } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  orderBy
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';

export default function CustomerList() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [formData, setFormData] = useState<Customer>({ name: '', phone: '', address: '' });

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  const fetchCustomers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'customers'), where('ownerId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(data);
    } catch (error) {
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingCustomer?.id) {
        const customerRef = doc(db, 'customers', editingCustomer.id);
        await updateDoc(customerRef, {
          name: formData.name,
          phone: formData.phone,
          address: formData.address
        });
        toast.success('Customer updated');
      } else {
        await addDoc(collection(db, 'customers'), {
          ...formData,
          ownerId: user.uid
        });
        toast.success('Customer added');
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', address: '' });
      fetchCustomers();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const exportToExcel = async () => {
    if (!user) return;
    toast.info('Synthesizing comprehensive customer audit...');
    
    try {
      const [ordersSnap, paymentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'orders'), where('ownerId', '==', user.uid))),
        getDocs(query(collection(db, 'payments'), where('ownerId', '==', user.uid)))
      ]);

      const allOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const allPayments = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      const worksheetData = customers.map(customer => {
        const customerOrders = allOrders.filter(o => o.customerId === customer.id);
        const customerPayments = allPayments
          .filter(p => p.customerId === customer.id)
          .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

        const totalAmount = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalDue = totalAmount - totalPaid;
        
        const buyDates = customerOrders
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateA - dateB;
          })
          .map(o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toLocaleDateString() : 'N/A')
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(', ');

        const paidDates = customerPayments.map(p => p.paymentDate).join(', ');
        const paidAmounts = customerPayments.map(p => p.amount).join(', ');

        return {
          'Customer Name': customer.name,
          'Mobile Number': customer.phone || 'N/A',
          'Address': customer.address || 'N/A',
          'Product Buy Date': buyDates || 'No purchases',
          'Date Wise Due Paid Date': paidDates || 'No payments',
          'Paid Money': paidAmounts || '0',
          'Total Paid': totalPaid,
          'Total Due': totalDue
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const wscols = [
        { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }
      ];
      worksheet['!cols'] = wscols;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer_Audit');
      XLSX.writeFile(workbook, `Customer_Registry_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Enterprise XLSX report exported');
    } catch (error) {
      console.error(error);
      toast.error('Export failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      toast.success('Customer deleted');
      fetchCustomers();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  const fetchPurchaseHistory = async (customer: Customer) => {
    if (!user || !customer.id) return;
    setLoading(true);
    setSelectedCustomerHistory(customer);
    try {
      const q = query(
        collection(db, 'orders'), 
        where('ownerId', '==', user.uid), 
        where('customerId', '==', customer.id),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const orders = await Promise.all(querySnapshot.docs.map(async (orderDoc) => {
        const orderData = orderDoc.data();
        const itemsSnap = await getDocs(query(collection(db, 'orders', orderDoc.id, 'items'), where('ownerId', '==', user.uid)));
        const items = itemsSnap.docs.map(d => d.data());
        return {
          id: orderDoc.id,
          ...orderData,
          items,
          createdAt: orderData.createdAt?.toDate?.()?.toISOString() || orderData.createdAt
        };
      }));
      setCustomerOrders(orders);
      setIsHistoryModalOpen(true);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch purchase history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            {t('clientNetwork')}
          </div>
          <h1 className="tracking-tighter">{t('customers')}</h1>
          <p className="text-slate-500 font-medium tracking-tight text-xs sm:text-base hidden sm:block">{t('manageRelationships')}</p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-3 sm:gap-4">
          <button 
            onClick={exportToExcel}
            className="premium-button-secondary border-brand-accent/20 text-brand-accent hover:bg-brand-accent/5 p-2 sm:p-3"
          >
            <Download size={18} className="sm:w-5 sm:h-5" />
            <span>{t('exportExcel')}</span>
          </button>
          <button 
            onClick={() => {
              setEditingCustomer(null);
              setFormData({ name: '', phone: '', address: '' });
              setIsModalOpen(true);
            }}
            className="premium-button-primary p-2 sm:p-3"
          >
            <Plus size={18} className="sm:w-5 sm:h-5" />
            <span>{t('addCustomer')}</span>
          </button>
        </div>
      </header>

      <div className="premium-card">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder={t('search')} 
              className="w-full pl-10 sm:pl-12 pr-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-100 bg-white focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all font-medium text-xs sm:text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table */}
          <table className="w-full text-left hidden md:table">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="data-grid-header">{t('customer')}</th>
                <th className="data-grid-header">{t('mobile')}</th>
                <th className="data-grid-header">{t('address')}</th>
                <th className="data-grid-header text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse">Syncing...</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-medium">Archive Empty. No records identified.</td>
                </tr>
              ) : filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-lg border border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-900 tracking-tight">{customer.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                      <Phone size={14} className="text-slate-300" />
                      {customer.phone || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm truncate max-w-xs">
                      <MapPin size={14} className="text-slate-300" />
                      {customer.address || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button 
                        onClick={() => fetchPurchaseHistory(customer)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-emerald-100"
                        title={t('history')}
                      >
                        <History size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingCustomer(customer);
                          setFormData(customer);
                          setIsModalOpen(true);
                        }}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(customer.id!)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-50">
            {loading ? (
              <div className="p-8 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse text-[10px]">Syncing...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium text-xs">Null Registry.</div>
            ) : filteredCustomers.map((customer) => (
              <div key={customer.id} className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-base border border-slate-200">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 tracking-tight text-sm">{customer.name}</p>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mt-1">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => fetchPurchaseHistory(customer)}
                      className="w-8 h-8 flex items-center justify-center text-emerald-500 bg-emerald-50 rounded-lg"
                    >
                      <History size={14} />
                    </button>
                    <button 
                      onClick={() => {
                        setEditingCustomer(customer);
                        setFormData(customer);
                        setIsModalOpen(true);
                      }}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(customer.id!)}
                      className="w-8 h-8 flex items-center justify-center text-rose-300 bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm text-slate-300">
                    <MapPin size={12} />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500 leading-snug tracking-tight line-clamp-1">{customer.address || 'No address provided'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
              onClick={() => setIsModalOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[1.5rem] sm:rounded-[3rem] w-full max-w-lg shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden relative z-10 max-h-[90vh] flex flex-col mx-4"
            >
            <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 shrink-0">
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-xl sm:rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-200">
                  <User size={20} className="sm:w-[28px] sm:h-[28px]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-2xl font-bold text-slate-900 tracking-tight">{editingCustomer ? t('edit') : t('newOrder')}</h3>
                  <p className="text-[8px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 sm:mt-1">{t('manualEntry')}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all">
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-10 space-y-4 sm:space-y-8 overflow-y-auto">
              <div>
                <label className="detail-label">{t('customer')}</label>
                <div className="relative">
                  <User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    required
                    type="text" 
                    placeholder={t('customer')}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="detail-label">{t('mobile')}</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    required
                    type="tel" 
                    placeholder={t('mobile')}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all font-mono"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="detail-label">{t('address')}</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-5 top-5 text-slate-300" />
                  <textarea 
                    placeholder={t('address')}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all min-h-[120px]"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>
            </form>
            <div className="p-4 sm:p-10 border-t border-slate-50 bg-slate-50/30 flex gap-2 sm:gap-4 shrink-0">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 text-slate-400 font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-white transition-all"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSubmit}
                className="flex-1 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
              >
                {editingCustomer ? t('save') : t('registerProduct')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedCustomerHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[3rem] w-full max-w-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden relative z-10 max-h-[90vh] flex flex-col"
            >
              <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-200">
                    <History size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{t('history')}</h3>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">{selectedCustomerHistory.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>
              <div className="p-10 space-y-12 overflow-y-auto">
                {customerOrders.length === 0 ? (
                  <div className="py-20 text-center">
                    <ShoppingCart size={48} className="mx-auto mb-4 text-slate-100" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t('noData')}</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {customerOrders.map((order) => (
                      <div key={order.id} className="premium-card p-8 space-y-6 hover:border-slate-200 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-100">
                              <Eye size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Ref: #{order.id.slice(-6)}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar size={12} className="text-slate-300" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(order.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <span className={cn(
                            "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border w-fit",
                            order.status === 'Paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                          )}>
                            {order.status}
                          </span>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                            <ArrowRight size={12} /> {t('items')}
                          </h4>
                          <div className="space-y-2">
                            {order.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-50">
                                <span className="text-xs font-bold text-slate-700">{item.name}</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-[10px] font-black text-slate-300 tabular-nums">{item.quantity} × {formatCurrency(item.price)}</span>
                                  <span className="text-xs font-black text-slate-900 tabular-nums">{formatCurrency(item.quantity * item.price)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-50 bg-slate-50/10 p-4 rounded-xl">
                          <div>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{t('total')}</p>
                            <p className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(order.totalAmount)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{t('paid')}</p>
                            <p className="text-xl font-black text-emerald-600 tabular-nums">{formatCurrency(order.paidAmount)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-10 border-t border-slate-50 bg-slate-50/30 shrink-0">
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
                >
                  {t('close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
