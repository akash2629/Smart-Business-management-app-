import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Trash2, ShoppingCart, User, Calendar, FileText, X, Printer, Download, Package, Phone, MapPin, Edit2, AlertCircle, Layers, Barcode } from 'lucide-react';
import { BdtSign } from './Icons';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Order, Customer, Product, OrderItem } from '../types';
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
  deleteDoc, 
  doc, 
  writeBatch,
  serverTimestamp,
  orderBy,
  increment
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function OrderList() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Quick Product State
  const [quickProduct, setQuickProduct] = useState<Product>({
    name: '',
    code: '',
    price: 0,
    stock: 0
  });

  const handleQuickProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!quickProduct.name || !quickProduct.price) return toast.error('Name and Price are required');

    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'products'), {
        ...quickProduct,
        ownerId: user.uid
      });
      
      toast.success('Product registered successfully');
      
      // Refresh products
      const productsSnap = await getDocs(collection(db, 'users', user.uid, 'products'));
      const updatedProducts = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(updatedProducts);
      
      // Select the new product in the last item if it's empty
      const lastIndex = orderForm.items.length - 1;
      if (lastIndex >= 0) {
        updateItem(lastIndex, 'productId', docRef.id);
      }
      
      setIsQuickProductModalOpen(false);
      setQuickProduct({ name: '', code: '', price: 0, stock: 0 });
    } catch (error) {
      toast.error('Failed to register product');
    }
  };
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  // New/Editing Order State
  const [orderForm, setOrderForm] = useState<{
    customerId: string;
    type: 'Invoice' | 'Quotation' | 'Purchase';
    paidAmount: number;
    items: { productId: string, quantity: number, price: number }[];
  }>({
    customerId: '',
    type: 'Invoice',
    paidAmount: 0,
    items: []
  });

  const resetOrderForm = () => {
    setOrderForm({
      customerId: '',
      type: 'Invoice',
      paidAmount: 0,
      items: []
    });
    setEditingOrderId(null);
  };

  // New Customer State
  const [newCustomer, setNewCustomer] = useState<Customer>({
    name: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ordersQ = query(collection(db, 'users', user.uid, 'orders'), orderBy('createdAt', 'desc'));
      const customersQ = collection(db, 'users', user.uid, 'customers');
      const productsQ = collection(db, 'users', user.uid, 'products');

      const [ordersSnap, customersSnap, productsSnap] = await Promise.all([
        getDocs(ordersQ),
        getDocs(customersQ),
        getDocs(productsQ)
      ]);

      const ordersData = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setOrders(ordersData.map(o => ({
        ...o,
        customerName: o.customerName,
        customerId: o.customerId,
        totalAmount: o.totalAmount,
        paidAmount: o.paidAmount,
        createdAt: o.createdAt?.toDate?.()?.toISOString() || o.createdAt
      })));

      setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[]);
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return orderForm.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!orderForm.customerId) return toast.error('Please select a customer');
    if (orderForm.items.length === 0) return toast.error('Please add at least one product');

    const totalAmount = calculateTotal();
    const status = orderForm.paidAmount >= totalAmount ? 'Paid' : 'Due';
    const customer = customers.find(c => c.id === orderForm.customerId);

    try {
      const batch = writeBatch(db);
      let orderRef;
      const ordersColRef = collection(db, 'users', user.uid, 'orders');
      
      if (editingOrderId) {
        orderRef = doc(ordersColRef, editingOrderId);
        // For updates, we delete existing items first and re-add them 
        // to simplify the "sync" of items list
        const itemsSnap = await getDocs(collection(orderRef, 'items'));
        itemsSnap.docs.forEach(d => batch.delete(d.ref));
      } else {
        orderRef = doc(ordersColRef);
      }
      
      const orderData = {
        customerId: orderForm.customerId,
        customerName: customer?.name || 'Unknown',
        totalAmount,
        paidAmount: orderForm.paidAmount,
        status,
        type: orderForm.type,
        ownerId: user.uid,
        updatedAt: serverTimestamp(),
        ...(editingOrderId ? {} : { createdAt: serverTimestamp() })
      };

      batch.set(orderRef, orderData, { merge: true });

      orderForm.items.forEach(item => {
        const itemRef = doc(collection(orderRef, 'items'));
        batch.set(itemRef, {
          ...item,
          ownerId: user.uid
        });

        // Update Inventory Stock
        if (item.productId && orderForm.type !== 'Quotation') {
          const productRef = doc(db, 'users', user.uid, 'products', item.productId);
          const stockChange = orderForm.type === 'Purchase' ? item.quantity : -item.quantity;
          batch.update(productRef, { stock: increment(stockChange) });
        }
      });

      await batch.commit();
      
      toast.success(editingOrderId ? 'Order updated successfully' : 'Order created successfully');
      setIsModalOpen(false);
      resetOrderForm();
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(editingOrderId ? 'Failed to update order' : 'Failed to create order');
    }
  };

  const handleEdit = async (order: Order) => {
    setLoading(true);
    try {
      if (!user) return;
      // Fetch items for this order
      const itemsSnap = await getDocs(collection(db, 'users', user.uid, 'orders', order.id!, 'items'));
      const items = itemsSnap.docs.map(doc => doc.data() as any);
      
      setEditingOrderId(order.id!);
      setOrderForm({
        customerId: order.customerId!,
        type: order.type as any,
        paidAmount: order.paidAmount,
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          price: i.price
        }))
      });
      setIsModalOpen(true);
    } catch (error) {
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setOrderToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!orderToDelete || !user) return;
    try {
      const orderRef = doc(db, 'users', user.uid, 'orders', orderToDelete);
      const itemsSnap = await getDocs(collection(orderRef, 'items'));
      
      const batch = writeBatch(db);
      
      // Restore stock if it was a real sale/purchase
      const orderDoc = orders.find(o => o.id === orderToDelete);
      if (orderDoc && orderDoc.type !== 'Quotation') {
        itemsSnap.docs.forEach(itemDoc => {
          const item = itemDoc.data();
          if (item.productId) {
            const productRef = doc(db, 'users', user.uid, 'products', item.productId);
            // Reverse the change: if it was a sale (-), we add (+). If it was a purchase (+), we subtract (-).
            const stockRestoration = orderDoc.type === 'Purchase' ? -item.quantity : item.quantity;
            batch.update(productRef, { stock: increment(stockRestoration) });
          }
          batch.delete(itemDoc.ref);
        });
      } else {
        itemsSnap.docs.forEach(itemDoc => batch.delete(itemDoc.ref));
      }

      batch.delete(orderRef);
      await batch.commit();
      
      toast.success('Order purged and stock adjusted');
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Purge failed');
    }
  };

  const addItem = () => {
    setOrderForm({
      ...orderForm,
      items: [...orderForm.items, { productId: '', quantity: 1, price: 0 }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...orderForm.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        updatedItems[index].price = product.price;
      }
    }
    
    setOrderForm({ ...orderForm, items: updatedItems });
  };

  const removeItem = (index: number) => {
    setOrderForm({
      ...orderForm,
      items: orderForm.items.filter((_, i) => i !== index)
    });
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newCustomer.name) return toast.error('Name is required');

    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'customers'), {
        ...newCustomer,
        ownerId: user.uid
      });
      
      toast.success('Customer added successfully');
      
      // Refresh customers list
      const customersSnap = await getDocs(collection(db, 'users', user.uid, 'customers'));
      const updatedCustomers = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
      setCustomers(updatedCustomers);
      
      // Select the newly added customer
      setOrderForm({ ...orderForm, customerId: docRef.id });
      
      // Reset and close
      setIsCustomerModalOpen(false);
      setNewCustomer({ name: '', phone: '', address: '' });
    } catch (error) {
      toast.error('Failed to add customer');
    }
  };

  const exportToPDF = (order: Order) => {
    const doc = new jsPDF() as any;
    doc.setFontSize(20);
    doc.text('SmartShop Invoice', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Order ID: #${order.id}`, 20, 40);
    doc.text(`Date: ${formatDate(order.createdAt!)}`, 20, 45);
    doc.text(`Customer: ${order.customerName}`, 20, 50);
    doc.text(`Type: ${order.type}`, 20, 55);
    
    // This is a simplified version, ideally we'd fetch order items for the specific order
    autoTable(doc, {
      startY: 65,
      head: [['Product', 'Price', 'Qty', 'Total']],
      body: [
        ['Total Order Amount', '', '', formatCurrency(order.totalAmount)],
        ['Paid Amount', '', '', formatCurrency(order.paidAmount)],
        ['Balance Due', '', '', formatCurrency(order.totalAmount - order.paidAmount)],
      ],
    });
    
    doc.save(`Invoice_${order.id}.pdf`);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(orders.map(o => ({
      'Order ID': o.id,
      'Customer': o.customerName,
      'Date': formatDate(o.createdAt!),
      'Total Amount': o.totalAmount,
      'Paid Amount': o.paidAmount,
      'Status': o.status,
      'Type': o.type
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
    XLSX.writeFile(workbook, 'Order_History.xlsx');
    toast.success('Exporting transaction history...');
  };

  const filteredOrders = orders.filter(o => 
    o.customerName?.toLowerCase().includes(search.toLowerCase()) || 
    o.id?.toString().includes(search)
  );

  return (
    <div className="space-y-0 sm:space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 p-4 sm:p-0 bg-white sm:bg-transparent border-b border-slate-100 sm:border-none sticky top-0 z-40">
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            {t('orderRegistry')}
          </div>
          <h1 className="text-sm sm:text-5xl font-serif font-black tracking-tighter leading-tight">{t('orders')}</h1>
          <p className="text-slate-500 font-medium tracking-tight text-xs sm:text-base hidden sm:block">{t('manageSales')}</p>
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
              resetOrderForm();
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-900 font-bold text-white text-[10px] sm:text-base hover:opacity-90 transition-all shadow-lg active:scale-95"
          >
            <Plus size={16} className="sm:w-5 sm:h-5" />
            <span>{t('newOrder')}</span>
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
          {/* Desktop Table */}
          <table className="w-full text-left hidden md:table">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="data-grid-header">{t('orderId')}</th>
                <th className="data-grid-header">{t('customer')}</th>
                <th className="data-grid-header">{t('date')}</th>
                <th className="data-grid-header">{t('total')}</th>
                <th className="data-grid-header">{t('status')}</th>
                <th className="data-grid-header text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse">Syncing...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-medium">Clear Ledger. No records present.</td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group text-sm">
                  <td className="px-6 py-5 font-mono font-bold text-slate-400">#{order.id?.slice(-6)}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs">
                        {order.customerName?.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900 tracking-tight">{order.customerName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-500 font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-300" />
                      {formatDate(order.createdAt!)}
                    </div>
                  </td>
                  <td className="px-6 py-5 font-black text-slate-900 tabular-nums">{formatCurrency(order.totalAmount)}</td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                      order.status === 'Paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => exportToPDF(order)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100"
                        title="Print Invoice"
                      >
                        <Printer size={16} />
                      </button>
                      <button 
                        onClick={() => handleEdit(order)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100"
                        title="Edit Record"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(order.id!)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Delete Record"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Detailed Flow (No Cards) */}
          <div className="md:hidden divide-y divide-slate-100 bg-white">
            {loading ? (
              <div className="p-8 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse text-[10px]">Syncing Universe...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">Registry Empty</div>
            ) : filteredOrders.map((order) => (
              <div key={order.id} className="p-5 space-y-4 hover:bg-slate-50/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm font-black shadow-xl shadow-slate-200">
                      {order.customerName?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-[12px] tracking-tight">{order.customerName}</p>
                      <sm className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">#{order.id?.slice(-6)} • {order.type === 'Quotation' ? 'Quote' : 'Invoice'}</sm>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-black text-slate-900 tabular-nums">{formatCurrency(order.totalAmount)}</p>
                    <span className={cn(
                      "inline-block px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border mt-1",
                      order.status === 'Paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {order.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Calendar size={12} className="text-slate-300" />
                    <span className="text-[9px] font-bold text-slate-400">{formatDate(order.createdAt!)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => exportToPDF(order)} className="p-2 sm:p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-colors border border-slate-100">
                      <Printer size={14} />
                    </button>
                    <button onClick={() => handleEdit(order)} className="p-2 sm:p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-colors border border-slate-100">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(order.id!)} className="p-2 sm:p-2.5 bg-rose-50 rounded-xl text-rose-300 hover:text-rose-600 transition-colors border border-rose-100">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Customer Modal (Nested) */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
              onClick={() => setIsCustomerModalOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="bg-white rounded-none sm:rounded-[3rem] w-full max-w-md h-full sm:h-auto sm:max-h-[90vh] shadow-2xl relative z-10 flex flex-col overflow-hidden"
            >
              <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white sm:bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-3 sm:gap-5">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-900 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200">
                    <User size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-xl font-bold text-slate-900 tracking-tight">{t('addCustomer')}</h3>
                    <p className="text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest mt-0.5 sm:mt-1">{t('manualEntry')}</p>
                  </div>
                </div>
                <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
              
              <form onSubmit={handleCustomerSubmit} className="p-4 sm:p-10 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
                <div>
                  <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('customer')}</label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      required
                      type="text"
                      className="w-full pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 text-xs sm:text-sm h-11 sm:h-auto placeholder:font-normal placeholder:text-slate-300"
                      placeholder="Search or Enter Name"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('mobile')}</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="text"
                      className="w-full pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 text-xs sm:text-sm h-11 sm:h-auto placeholder:font-normal placeholder:text-slate-300"
                      placeholder="+880..."
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('address')}</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-4 sm:top-5 text-slate-300" />
                    <textarea
                      className="w-full pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 text-xs sm:text-sm min-h-[80px] sm:min-h-[110px] placeholder:font-normal placeholder:text-slate-300"
                      placeholder="Registry Address"
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 shrink-0 sm:pb-0 pb-10">
                  <button 
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
                    className="flex-1 px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] hover:bg-gray-50 transition-all h-12"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-[9px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 h-12"
                  >
                    {t('save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* New Order Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white rounded-none sm:rounded-[3.5rem] w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] shadow-2xl overflow-hidden relative z-10 flex flex-col">
              <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white sm:bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-3 sm:gap-6">
                  <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-xl sm:rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-200">
                    <ShoppingCart size={18} className="sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-2xl font-bold text-slate-900 tracking-tight">
                      {editingOrderId ? t('edit') + ' ' + t('orders') : t('newOrder')}
                    </h3>
                    <p className="text-[8px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 sm:mt-1">
                      {editingOrderId ? `Modifying Record ${editingOrderId.slice(-6)}` : t('financialReports')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={18} className="sm:w-6 sm:h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-10 space-y-4 sm:space-y-12 bg-white pb-32 sm:pb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-10">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2 px-1">
                      <label className="detail-label text-[9px] sm:text-[10px]">{t('selectCustomer')}</label>
                      <button 
                        type="button"
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="text-[9px] sm:text-[10px] font-black text-slate-900 hover:underline flex items-center gap-1 uppercase tracking-widest"
                      >
                        <Plus size={10} />
                        {t('addCustomer')}
                      </button>
                    </div>
                    <select 
                      required
                      className="w-full px-4 sm:px-5 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all cursor-pointer text-[10px] sm:text-sm h-11 sm:h-auto"
                      value={orderForm.customerId}
                      onChange={(e) => setOrderForm({...orderForm, customerId: e.target.value})}
                    >
                      <option value="">{t('selectCustomer')}</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="detail-label text-[9px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('paymentMethod')}</label>
                    <div className="flex gap-2 sm:gap-3">
                      {['Invoice', 'Quotation', 'Purchase'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setOrderForm({...orderForm, type: type as any})}
                          className={cn(
                            "flex-1 py-1.5 sm:py-4 rounded-lg sm:rounded-2xl text-[7px] sm:text-[10px] font-black uppercase tracking-widest border transition-all h-10 sm:h-auto min-w-[60px]",
                            orderForm.type === type 
                              ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-100" 
                              : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                          )}
                        >
                          {type === 'Quotation' ? 'Quote' : type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center justify-between bg-slate-50/50 p-3 sm:p-6 rounded-xl sm:rounded-[2rem] border border-slate-50 gap-2">
                    <h4 className="text-[10px] sm:text-lg font-bold text-slate-900 flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white flex items-center justify-center border border-slate-100 text-slate-400 shadow-sm">
                        <Package size={14} className="sm:w-5 sm:h-5" />
                      </div>
                      {t('items')}
                    </h4>
                    <button 
                      type="button"
                      onClick={addItem}
                      className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg bg-white border border-slate-100 text-[8px] sm:text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      <Plus size={14} className="sm:w-4 sm:h-4 text-brand-primary" />
                      <span>{t('addItems')}</span>
                    </button>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {orderForm.items.map((item, index) => (
                      <div key={index} className="bg-white sm:premium-card p-3 sm:p-8 rounded-xl sm:rounded-[2rem] border border-slate-100 sm:border-slate-100 relative group/item hover:bg-slate-50/20 transition-all">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-6 items-end">
                          <div className="md:col-span-5">
                            <div className="flex items-center justify-between mb-1 sm:mb-2">
                              <label className="detail-label text-[8px] sm:text-[10px]">{t('product')}</label>
                              <button 
                                type="button"
                                onClick={() => setIsQuickProductModalOpen(true)}
                                className="text-[8px] sm:text-[9px] font-black text-slate-900 hover:underline flex items-center gap-1 uppercase tracking-widest sm:hidden"
                              >
                                <Plus size={8} />
                                Asset
                              </button>
                            </div>
                            <select
                              required
                              className="w-full px-3 sm:px-4 py-2 sm:py-3.5 rounded-lg border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all text-[10px] sm:text-sm h-11 sm:h-auto"
                              value={item.productId}
                              onChange={(e) => updateItem(index, 'productId', e.target.value)}
                            >
                              <option value="">{t('selectProduct')}</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({t('stockLevel')}: {p.stock})</option>)}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 min-[440px]:grid-cols-3 md:col-span-6 gap-2 sm:gap-4">
                            <div>
                              <label className="detail-label text-[8px] sm:text-[10px]">{t('unitPrice')}</label>
                              <input
                                required
                                type="number"
                                className="w-full px-2 sm:px-4 py-2 sm:py-3.5 rounded-lg border border-slate-100 bg-slate-50/50 outline-none font-bold text-slate-900 text-[10px] sm:text-sm tabular-nums h-11 sm:h-auto text-center sm:text-left"
                                value={item.price || 0}
                                onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <label className="detail-label text-[8px] sm:text-[10px]">{t('quantity')}</label>
                              <input
                                required
                                type="number"
                                className="w-full px-2 sm:px-4 py-2 sm:py-3.5 rounded-lg border border-slate-100 bg-slate-50/50 outline-none font-bold text-slate-900 text-[10px] sm:text-sm tabular-nums h-11 sm:h-auto text-center sm:text-left"
                                value={item.quantity || 0}
                                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                              />
                            </div>
                            <div className="col-span-2 min-[440px]:col-span-1">
                              <label className="detail-label text-[8px] sm:text-[10px] sm:hidden">{t('subtotal')}</label>
                              <div className="px-2 sm:px-4 py-2 sm:py-3.5 bg-slate-900 text-white rounded-lg text-[10px] sm:text-sm font-black tabular-nums shadow-lg shadow-slate-100 truncate flex items-center justify-center sm:justify-start h-11 sm:h-auto">
                                {formatCurrency(item.price * item.quantity)}
                              </div>
                            </div>
                          </div>
                          <div className="md:col-span-1 flex justify-end">
                            <button 
                              type="button"
                              onClick={() => removeItem(index)}
                              className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg sm:rounded-xl transition-all border border-transparent hover:border-rose-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {orderForm.items.length === 0 && (
                      <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
                        <Package size={48} className="mx-auto mb-4 text-slate-200" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Null Assets Selected</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sticky bottom-0 left-0 right-0 p-4 sm:p-0 bg-white sm:bg-transparent border-t border-slate-100 sm:border-none flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 sm:mt-12 bg-white/80 backdrop-blur-md sm:translate-y-0 translate-y-4">
                  <div className="flex flex-col items-center sm:items-start">
                    <p className="text-[7px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest sm:tracking-[0.2em] mb-0.5">{t('total')}</p>
                    <h5 className="text-xl sm:text-4xl font-black text-brand-primary tracking-tighter tabular-nums leading-none">
                      {formatCurrency(calculateTotal())}
                    </h5>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex-1 sm:w-40">
                      <p className="text-[7px] sm:hidden font-black text-slate-300 uppercase tracking-widest mb-1 text-center">{t('paid')}</p>
                      <input 
                        type="number"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 sm:px-4 py-3 sm:py-4 text-base sm:text-xl font-black text-slate-900 focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all tabular-nums text-center h-12 sm:h-auto"
                        value={orderForm.paidAmount || 0}
                        onChange={(e) => setOrderForm({...orderForm, paidAmount: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="flex-[1.5] sm:flex-none px-6 sm:px-12 py-3 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-[2rem] font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 h-12 sm:h-auto"
                    >
                      {editingOrderId ? t('save') : t('newOrder')}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Quick Product Modal */}
      {isQuickProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsQuickProductModalOpen(false)} />
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200">
            <div className="p-6 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-900 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200">
                  <Package size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{t('registerProduct')}</h3>
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">{t('manualEntry')}</p>
                </div>
              </div>
              <button onClick={() => setIsQuickProductModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
            
            <form onSubmit={handleQuickProductSubmit} className="p-6 sm:p-10 space-y-4 sm:space-y-6">
              <div>
                <label className="detail-label text-[9px] sm:text-[10px] mb-1.5 sm:mb-2">{t('assetIdentifier')}</label>
                <div className="relative">
                  <Package size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    required
                    type="text"
                    className="w-full pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 text-sm h-11 sm:h-auto"
                    placeholder={t('assetIdentifier')}
                    value={quickProduct.name}
                    onChange={(e) => setQuickProduct({...quickProduct, name: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="detail-label text-[9px] sm:text-[10px] mb-1.5 sm:mb-2">{t('unitValuation')}</label>
                  <div className="relative">
                    <BdtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="w-full pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 tabular-nums text-sm h-11 sm:h-auto"
                      placeholder="0.00"
                      value={quickProduct.price || 0}
                      onChange={(e) => setQuickProduct({...quickProduct, price: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div>
                  <label className="detail-label text-[9px] sm:text-[10px] mb-1.5 sm:mb-2">{t('stockLevel')}</label>
                  <div className="relative">
                   <Layers size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      required
                      type="number"
                      className="w-full pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 tabular-nums text-sm h-11 sm:h-auto"
                      placeholder="0"
                      value={quickProduct.stock || 0}
                      onChange={(e) => setQuickProduct({...quickProduct, stock: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="detail-label text-[9px] sm:text-[10px] mb-1.5 sm:mb-2">{t('registryCode')}</label>
                <div className="relative">
                  <Barcode size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    className="w-full pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 text-sm h-11 sm:h-auto"
                    placeholder="Code/SKU"
                    value={quickProduct.code}
                    onChange={(e) => setQuickProduct({...quickProduct, code: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsQuickProductModalOpen(false)}
                  className="flex-1 px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-gray-50 transition-all h-12 sm:h-auto"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 h-12 sm:h-auto"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{t('confirmDelete')}</h3>
              <p className="text-sm text-slate-500 font-medium">
                {t('confirmDelete')}
              </p>
            </div>
            <div className="p-6 bg-slate-50/50 flex gap-3">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
