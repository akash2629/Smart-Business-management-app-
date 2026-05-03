import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, User, Phone, MapPin, X, Download, History, Eye, Calendar, ShoppingCart, ArrowRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Customer, Order } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [formData, setFormData] = useState<Customer>({ name: '', phone: '', address: '' });
  const [profileTab, setProfileTab] = useState<'orders' | 'payments'>('orders');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  const fetchCustomers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users', user.uid, 'customers'));
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
        const customerRef = doc(db, 'users', user.uid, 'customers', editingCustomer.id);
        await updateDoc(customerRef, {
          name: formData.name,
          phone: formData.phone,
          address: formData.address
        });
        toast.success('Customer updated');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'customers'), {
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
        getDocs(collection(db, 'users', user.uid, 'orders')),
        getDocs(collection(db, 'users', user.uid, 'payments'))
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
    if (!confirm('Are you sure you want to delete this customer?') || !user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'customers', id));
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

  const viewProfile = async (customer: Customer) => {
    if (!user || !customer.id) return;
    setLoading(true);
    setSelectedCustomer(customer);
    setProfileTab('orders');
    try {
      const ordersQ = query(
        collection(db, 'users', user.uid, 'orders'), 
        where('customerId', '==', customer.id)
      );
      const paymentsQ = query(
        collection(db, 'users', user.uid, 'payments'),
        where('customerId', '==', customer.id)
      );

      const [ordersSnap, paymentsSnap] = await Promise.all([
        getDocs(ordersQ),
        getDocs(paymentsQ)
      ]);
      
      const orders = await Promise.all(ordersSnap.docs.map(async (orderDoc) => {
        const orderData = orderDoc.data();
        const itemsSnap = await getDocs(collection(db, 'users', user.uid, 'orders', orderDoc.id, 'items'));
        const items = itemsSnap.docs.map(d => d.data());
        return {
          id: orderDoc.id,
          ...orderData,
          items,
          createdAt: orderData.createdAt?.toDate?.() || orderData.createdAt
        };
      }));

      const payments = paymentsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

      setCustomerOrders(orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setCustomerPayments(payments);
      setIsProfileOpen(true);
    } catch (error) {
      console.error('Profile Fetch Error:', error);
      toast.error('Failed to fetch profile details');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalDue = () => {
    const totalOrdered = customerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalPaid = customerOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
    return totalOrdered - totalPaid;
  };

  const exportProfileToPDF = async () => {
    if (!selectedCustomer || !user) return;
    toast.info('Generating PDF Report...');

    try {
      const doc = new jsPDF() as any;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;

      // Header
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text('Customer Transaction Statement', margin, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Slate 400
      doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, 38);

      // Customer Info
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`Customer Name: ${selectedCustomer.name}`, margin, 50);
      doc.text(`Mobile: ${selectedCustomer.phone || 'N/A'}`, margin, 57);
      doc.text(`Address: ${selectedCustomer.address || 'N/A'}`, margin, 64);

      // Financial Summary
      const totalDue = calculateTotalDue();
      doc.setFontSize(11);
      doc.text(`Total Due: ${formatCurrency(totalDue)}`, margin, 75);

      let currentY = 85;

      // Orders Table
      doc.setFontSize(14);
      doc.text('Purchase History', margin, currentY);
      currentY += 5;

      const orderRows = customerOrders.map(order => [
        formatDate(order.createdAt),
        `Invoice #${order.id.slice(-6)}`,
        order.items?.map((i: any) => `${i.name} (x${i.quantity})`).join(', ') || order.type,
        formatCurrency(order.totalAmount),
        formatCurrency(order.paidAmount),
        order.status
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Bill ID', 'Items/Note', 'Total', 'Paid', 'Status']],
        body: orderRows,
        margin: { left: margin, right: margin },
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Payments Table
      if (customerPayments.length > 0) {
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        doc.setFontSize(14);
        doc.text('Payment History', margin, currentY);
        currentY += 5;

        const paymentRows = customerPayments.map(p => [
          p.paymentDate,
          formatCurrency(p.amount),
          'Cash'
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Payment Date', 'Amount Paid', 'Method']],
          body: paymentRows,
          margin: { left: margin, right: margin },
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129] } // Emerald 500
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // Notes and Images
      customerOrders.forEach((order, index) => {
        const hasNote = order.note;
        const hasImages = order.images && order.images.length > 0;

        if (hasNote || hasImages) {
          if (currentY > 220) { doc.addPage(); currentY = 20; }
          
          doc.setFontSize(11);
          doc.setTextColor(100, 116, 139);
          doc.text(`Details for Bill #${order.id.slice(-6)}:`, margin, currentY);
          currentY += 8;

          if (hasNote) {
            doc.setFontSize(10);
            doc.setTextColor(51, 65, 85);
            doc.text(`Note: ${order.note}`, margin + 5, currentY);
            currentY += 10;
          }

          if (hasImages) {
            order.images.forEach((img: string) => {
              if (currentY > 150) { doc.addPage(); currentY = 30; }
              const imgW = (pageWidth - margin * 2) * 0.8;
              const imgH = imgW * 0.8; // User requested 80% height relative to width or ratio? 
              // User said "picture view size (width:80%: height:80%)". 
              // In PDF context, usually 80% of page width.
              
              try {
                doc.addImage(img, 'JPEG', (pageWidth - imgW) / 2, currentY, imgW, imgH);
                currentY += imgH + 15;
              } catch (e) {
                console.error('PDF Image error:', e);
              }
            });
          }
          currentY += 5;
        }
      });

      doc.save(`Statement_${selectedCustomer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Professional PDF statement exported');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <div className="space-y-0 sm:space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 p-4 sm:p-0 bg-white sm:bg-transparent border-b border-slate-100 sm:border-none sticky top-[60px] sm:top-[80px] z-40 transition-all duration-300">
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            {t('clientNetwork')}
          </div>
          <h1 className="text-sm sm:text-5xl font-serif font-black tracking-tighter leading-tight">{t('customers')}</h1>
          <p className="text-slate-500 font-medium tracking-tight text-xs sm:text-base hidden sm:block">{t('manageRelationships')}</p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-3 sm:gap-4">
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-brand-accent/20 text-brand-accent font-bold text-[10px] sm:text-base bg-white sm:bg-white hover:bg-brand-accent/5 transition-all shadow-sm"
          >
            <Download size={16} className="sm:w-5 sm:h-5" />
            <span>{t('exportExcel')}</span>
          </button>
          <button 
            onClick={() => {
              setEditingCustomer(null);
              setFormData({ name: '', phone: '', address: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-900 font-bold text-white text-[10px] sm:text-base hover:opacity-90 transition-all shadow-lg active:scale-95"
          >
            <Plus size={16} className="sm:w-5 sm:h-5" />
            <span>{t('addCustomer')}</span>
          </button>
        </div>
      </header>

      <div className="bg-white sm:premium-card border-b border-slate-100 sm:border-none">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/20">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder={t('search')} 
              className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-white focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all font-bold text-[10px] sm:text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table View */}
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
                        onClick={() => viewProfile(customer)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-emerald-100"
                        title={t('viewProfile')}
                      >
                        <User size={16} />
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

          {/* Mobile Card Layout */}
          <div className="md:hidden p-4 space-y-4 bg-slate-50/30">
            {loading ? (
              <div className="p-8 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse text-[10px]">Loading...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No Customers Found</div>
            ) : filteredCustomers.map((customer) => (
              <div key={customer.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg font-black shadow-lg shadow-slate-200">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-[15px] tracking-tight truncate max-w-[150px]">{customer.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone size={10} className="text-slate-300" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{customer.phone}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => viewProfile(customer)} 
                      className="w-9 h-9 flex items-center justify-center bg-emerald-50 rounded-xl text-emerald-500 hover:bg-emerald-100 transition-colors border border-emerald-100 shadow-sm shadow-emerald-100/50"
                      title={t('viewProfile')}
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        setEditingCustomer(customer);
                        setFormData(customer);
                        setIsModalOpen(true);
                      }}
                      className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-colors border border-slate-100"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(customer.id!)} 
                      className="w-9 h-9 flex items-center justify-center bg-rose-50 rounded-xl text-rose-300 hover:text-rose-600 transition-colors border border-rose-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {customer.address && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <MapPin size={14} className="text-slate-300 mt-0.5" />
                    <p className="text-[11px] font-bold text-slate-500 leading-snug tracking-tight">{customer.address}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center sm:p-4">
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
              className="bg-white rounded-none sm:rounded-[3rem] w-full max-w-lg shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden relative z-10 h-full sm:h-auto sm:max-h-[90vh] flex flex-col"
            >
            <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white sm:bg-slate-50/30 shrink-0">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-xl sm:rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-200">
                  <User size={20} className="sm:w-[28px] sm:h-[28px]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-2xl font-bold text-slate-900 tracking-tight">{editingCustomer ? t('edit') : t('addCustomer')}</h3>
                  <p className="text-[8px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 sm:mt-1">{t('manualEntry')}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all">
                <X size={18} className="sm:w-6 sm:h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-10 space-y-4 sm:space-y-8 overflow-y-auto flex-1 pb-20 sm:pb-10">
              <div>
                <label className="detail-label text-[10px] sm:text-xs mb-1.5">{t('customer')}</label>
                <div className="relative">
                  <User size={14} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    required
                    type="text" 
                    placeholder={t('customer')}
                    className="w-full pl-11 sm:pl-14 pr-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all text-xs sm:text-base h-11 sm:h-auto"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="detail-label text-[10px] sm:text-xs mb-1.5">{t('mobile')}</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    required
                    type="tel" 
                    placeholder={t('mobile')}
                    className="w-full pl-11 sm:pl-14 pr-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all font-mono text-xs sm:text-base h-11 sm:h-auto"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="detail-label text-[10px] sm:text-xs mb-1.5">{t('address')}</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-4 sm:left-5 top-4 sm:top-5 text-slate-300" />
                  <textarea 
                    placeholder={t('address')}
                    className="w-full pl-11 sm:pl-14 pr-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all min-h-[100px] sm:min-h-[120px] text-xs sm:text-base"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-2 sm:pt-4 flex gap-3 sm:gap-4 shrink-0 mt-auto">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 text-slate-400 font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-white transition-all h-12 sm:h-auto"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleSubmit}
                  className="flex-1 px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 h-12 sm:h-auto"
                >
                  {editingCustomer ? t('save') : t('newOrder')}
                </button>
              </div>
            </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileOpen && selectedCustomer && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-none sm:rounded-[3rem] w-full max-w-4xl shadow-2xl overflow-hidden relative z-10 h-full sm:h-auto sm:max-h-[90vh] flex flex-col"
            >
              <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3 sm:gap-6">
                  <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-xl sm:rounded-3xl flex items-center justify-center shadow-lg">
                    <User size={20} className="sm:w-8 sm:h-8" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-2xl font-black text-slate-900 leading-tight truncate">{selectedCustomer.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 mt-0.5 sm:mt-2">
                       <span className="text-[8px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{selectedCustomer.phone}</span>
                       <div className="hidden min-[400px]:block w-1 h-1 rounded-full bg-slate-200"></div>
                       <span className={cn(
                         "text-[8px] sm:text-xs font-black uppercase tracking-widest",
                         calculateTotalDue() > 0 ? "text-rose-500" : "text-emerald-500"
                       )}>
                         {t('due')}: {formatCurrency(calculateTotalDue())}
                       </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <button 
                    onClick={exportProfileToPDF}
                    className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-xl bg-slate-900 border border-slate-900 text-white font-bold text-[10px] sm:text-xs hover:bg-slate-800 transition-all shadow-sm"
                  >
                    <FileText size={14} className="sm:w-4 sm:h-4" />
                    <span>{t('exportPdf')}</span>
                  </button>
                  <button onClick={() => setIsProfileOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-xl transition-all">
                    <X size={18} className="sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex px-4 sm:px-8 border-b border-slate-50 bg-white sticky top-0 z-20 shrink-0">
                <button 
                  onClick={() => setProfileTab('orders')}
                  className={cn(
                    "flex-1 sm:flex-none px-4 py-3 sm:py-5 text-[9px] sm:text-xs font-black uppercase tracking-[0.2em] relative transition-all",
                    profileTab === 'orders' ? "text-slate-900" : "text-slate-300 hover:text-slate-500"
                  )}
                >
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <ShoppingCart size={12} className="sm:w-3.5 sm:h-3.5" />
                    <span>{t('orders')}</span>
                    <span className="opacity-50">({customerOrders.length})</span>
                  </div>
                  {profileTab === 'orders' && <motion.div layoutId="profileTab" className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 bg-slate-900 rounded-t-full" />}
                </button>
                <button 
                  onClick={() => setProfileTab('payments')}
                  className={cn(
                    "flex-1 sm:flex-none px-4 py-3 sm:py-5 text-[9px] sm:text-xs font-black uppercase tracking-[0.2em] relative transition-all",
                    profileTab === 'payments' ? "text-slate-900" : "text-slate-300 hover:text-slate-500"
                  )}
                >
                   <div className="flex items-center justify-center sm:justify-start gap-2">
                    <History size={12} className="sm:w-3.5 sm:h-3.5" />
                    <span>{t('payments')}</span>
                    <span className="opacity-50">({customerPayments.length})</span>
                  </div>
                  {profileTab === 'payments' && <motion.div layoutId="profileTab" className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 bg-slate-900 rounded-t-full" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/30 pb-24 sm:pb-8">
                {profileTab === 'orders' ? (
                  <div className="space-y-4 sm:space-y-6">
                    {customerOrders.length === 0 ? (
                      <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold tracking-widest text-[8px] sm:text-[10px] uppercase">No transactional records identified.</p>
                      </div>
                    ) : (
                      customerOrders.map(order => (
                        <div key={order.id} className="premium-card p-4 sm:p-8 space-y-4 sm:space-y-6 bg-white border border-slate-100 !rounded-3xl sm:!rounded-[3rem]">
                          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                                <Search size={14} className="sm:w-[18px] sm:h-[18px]" />
                              </div>
                              <div>
                                <p className="text-[10px] sm:text-xs font-black text-slate-900 uppercase tracking-tight">Invoice #{order.id.slice(-6)}</p>
                                <p className="text-[7px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">{formatDate(order.createdAt)}</p>
                              </div>
                            </div>
                            <span className={cn(
                              "px-2 sm:px-3 py-1 rounded-lg sm:rounded-xl text-[7px] sm:text-[9px] font-black uppercase tracking-widest border",
                              order.status === 'Paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                            )}>
                              {order.status}
                            </span>
                          </div>
                          
                          <div className="space-y-1.5 sm:space-y-4">
                            {order.items?.length > 0 ? (
                              order.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[9px] sm:text-xs font-bold text-slate-600 px-3 sm:px-4 py-2 bg-slate-50 rounded-xl gap-1 sm:gap-0">
                                  <span className="text-slate-900 uppercase tracking-tight">{item.name}</span>
                                  <div className="flex justify-between sm:contents">
                                    <span className="tabular-nums opacity-60 font-medium">{item.quantity} × {formatCurrency(item.price)}</span>
                                    <span className="tabular-nums text-slate-900">{formatCurrency(item.quantity * item.price)}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                               <div className="px-3 sm:px-4 py-2 bg-slate-50 rounded-xl">
                                 <p className="text-[9px] sm:text-xs font-bold text-slate-400 italic">{order.type} — {order.note || 'No additional notes'}</p>
                               </div>
                            )}

                            {/* Order Images */}
                            {order.images && order.images.length > 0 && (
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2">
                                {order.images.map((img: string, i: number) => (
                                  <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-100 bg-white group cursor-pointer" onClick={() => setPreviewImage(img)}>
                                    <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2 sm:pt-4">
                            <div className="p-3 sm:p-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl shadow-lg shadow-slate-200">
                              <p className="text-[7px] sm:text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5 sm:mb-1">Total</p>
                              <p className="text-xs sm:text-lg font-black tabular-nums">{formatCurrency(order.totalAmount)}</p>
                            </div>
                            <div className="p-3 sm:p-4 bg-emerald-50 text-emerald-900 rounded-xl sm:rounded-2xl border border-emerald-100">
                              <p className="text-[7px] sm:text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-0.5 sm:mb-1">Paid</p>
                              <p className="text-xs sm:text-lg font-black tabular-nums">{formatCurrency(order.paidAmount)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-4">
                    {customerPayments.length === 0 ? (
                       <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                         <p className="text-slate-400 font-bold tracking-widest text-[8px] sm:text-[10px] uppercase">No payment archives recorded.</p>
                       </div>
                    ) : (
                      customerPayments.map(payment => (
                        <div key={payment.id} className="flex items-center justify-between p-3.5 sm:p-6 bg-white border border-slate-100 rounded-xl sm:rounded-2xl shadow-sm hover:border-emerald-200 transition-all group">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                              <Download size={14} className="sm:w-[18px] sm:h-[18px]" />
                            </div>
                            <div>
                               <p className="text-sm sm:text-base font-black text-slate-900 tabular-nums">{formatCurrency(payment.amount)}</p>
                               <p className="text-[8px] sm:text-[10px] font-medium text-slate-400 mt-0.5">{payment.paymentDate}</p>
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100">
                            <Calendar size={12} className="sm:w-3.5 sm:h-3.5" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-10 bg-white border-t border-slate-100 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Financial Standing</p>
                  <p className={cn(
                    "text-lg sm:text-2xl font-black tabular-nums mt-0.5 flex items-center gap-2",
                    calculateTotalDue() > 0 ? "text-rose-500" : "text-emerald-500"
                  )}>
                    {formatCurrency(calculateTotalDue())} 
                    <span className="text-[9px] opacity-100 uppercase tracking-widest font-black flex items-center gap-1">
                      {calculateTotalDue() > 0 ? (
                        <>
                          <div className="w-1 h-1 rounded-full bg-rose-500" />
                          Due
                        </>
                      ) : (
                        <>
                          <div className="w-1 h-1 rounded-full bg-emerald-500" />
                          Balanced
                        </>
                      )}
                    </span>
                  </p>
                </div>
                <button 
                  onClick={() => setIsProfileOpen(false)}
                  className="w-full sm:w-auto px-10 py-3.5 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 h-11 sm:h-auto"
                >
                  {t('close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImage(null)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative z-10 max-w-4xl w-full aspect-auto rounded-3xl overflow-hidden shadow-2xl"
            >
              <img src={previewImage} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white transition-all focus:outline-none"
              >
                <X size={24} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
