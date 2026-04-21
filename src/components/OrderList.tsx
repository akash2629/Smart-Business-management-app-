import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Trash2, ShoppingCart, User, Calendar, FileText, X, Printer, Download, Package, Phone, MapPin, Edit2, AlertCircle, Layers, Barcode } from 'lucide-react';
import { BdtSign } from './Icons';
import { toast } from 'sonner';
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
  orderBy
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
      const docRef = await addDoc(collection(db, 'products'), {
        ...quickProduct,
        ownerId: user.uid
      });
      
      toast.success('Product registered successfully');
      
      // Refresh products
      const productsQ = query(collection(db, 'products'), where('ownerId', '==', user.uid));
      const productsSnap = await getDocs(productsQ);
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
      const ordersQ = query(collection(db, 'orders'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));
      const customersQ = query(collection(db, 'customers'), where('ownerId', '==', user.uid));
      const productsQ = query(collection(db, 'products'), where('ownerId', '==', user.uid));

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
      
      if (editingOrderId) {
        orderRef = doc(db, 'orders', editingOrderId);
        // For updates, we delete existing items first and re-add them 
        // to simplify the "sync" of items list
        const itemsSnap = await getDocs(query(collection(orderRef, 'items'), where('ownerId', '==', user.uid)));
        itemsSnap.docs.forEach(d => batch.delete(d.ref));
      } else {
        orderRef = doc(collection(db, 'orders'));
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
      // Fetch items for this order
      const itemsSnap = await getDocs(query(collection(db, 'orders', order.id!, 'items'), where('ownerId', '==', user.uid)));
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
    if (!orderToDelete) return;
    try {
      await deleteDoc(doc(db, 'orders', orderToDelete));
      toast.success('Order deleted');
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
      fetchData();
    } catch (error) {
      toast.error('Delete failed');
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
      const docRef = await addDoc(collection(db, 'customers'), {
        ...newCustomer,
        ownerId: user.uid
      });
      
      toast.success('Customer added successfully');
      
      // Refresh customers list
      const customersQ = query(collection(db, 'customers'), where('ownerId', '==', user.uid));
      const customersSnap = await getDocs(customersQ);
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
    <div className="space-y-6 sm:space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            {t('orderRegistry')}
          </div>
          <h1 className="tracking-tighter">{t('orders')}</h1>
          <p className="text-slate-500 font-medium tracking-tight text-xs sm:text-base hidden sm:block">{t('manageSales')}</p>
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
              resetOrderForm();
              setIsModalOpen(true);
            }}
            className="premium-button-primary p-2 sm:p-3"
          >
            <Plus size={18} className="sm:w-5 sm:h-5" />
            <span>{t('newOrder')}</span>
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

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-50">
            {loading ? (
              <div className="p-8 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse text-[10px]">Syncing...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium text-xs">Null Registry.</div>
            ) : filteredOrders.map((order) => (
              <div key={order.id} className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] font-black text-slate-300 uppercase tracking-widest">Ref: #{order.id?.slice(-6)}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                    order.status === 'Paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                  )}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-base border border-slate-200">
                      {order.customerName?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 tracking-tight text-sm">{order.customerName}</p>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mt-1">{formatDate(order.createdAt!).split(',')[0]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => exportToPDF(order)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg"
                    >
                      <Printer size={14} />
                    </button>
                    <button 
                      onClick={() => handleEdit(order)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(order.id!)}
                      className="w-8 h-8 flex items-center justify-center text-rose-300 bg-rose-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Valuation</p>
                  <span className="text-lg font-black text-slate-900 tabular-nums">{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Customer Modal (Nested) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsCustomerModalOpen(false)} />
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{t('addCustomer')}</h3>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">{t('manualEntry')}</p>
                </div>
              </div>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCustomerSubmit} className="p-10 space-y-6">
              <div>
                <label className="detail-label">{t('customer')}</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    required
                    type="text"
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700"
                    placeholder={t('search')}
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="detail-label">{t('mobile')}</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700"
                    placeholder={t('mobile')}
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="detail-label">{t('address')}</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-4 top-5 text-slate-300" />
                  <textarea
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 min-h-[80px]"
                    placeholder={t('address')}
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-2xl border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-gray-50 transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white rounded-[3rem] w-full max-w-5xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-200">
                  <ShoppingCart size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {editingOrderId ? t('edit') + ' ' + t('orders') : t('newOrder')}
                  </h3>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
                    {editingOrderId ? `Modifying Record ${editingOrderId.slice(-6)}` : t('financialReports')}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-100 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="detail-label">{t('selectCustomer')}</label>
                    <button 
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="text-[10px] font-black text-slate-900 hover:underline flex items-center gap-1 uppercase tracking-widest"
                    >
                      <Plus size={10} />
                      {t('addCustomer')}
                    </button>
                  </div>
                  <select 
                    required
                    className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all cursor-pointer"
                    value={orderForm.customerId}
                    onChange={(e) => setOrderForm({...orderForm, customerId: e.target.value})}
                  >
                    <option value="">{t('selectCustomer')}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                  </select>
                </div>
                <div>
                  <label className="detail-label">{t('paymentMethod')}</label>
                  <div className="flex gap-3">
                    {['Invoice', 'Quotation', 'Purchase'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setOrderForm({...orderForm, type: type as any})}
                        className={cn(
                          "flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all",
                          orderForm.type === type 
                            ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-100" 
                            : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between bg-slate-50/50 p-6 rounded-[2rem] border border-slate-50">
                  <h4 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-slate-100 text-slate-400 shadow-sm">
                      <Package size={20} />
                    </div>
                    {t('items')}
                  </h4>
                  <button 
                    type="button"
                    onClick={addItem}
                    className="premium-button-secondary py-2 px-4 text-xs"
                  >
                    <Plus size={16} />
                    <span>{t('addItems')}</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {orderForm.items.map((item, index) => (
                    <div key={index} className="premium-card p-6 md:p-8 bg-white hover:bg-slate-50/20 transition-all border-slate-50">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        <div className="md:col-span-5">
                          <div className="flex items-center justify-between mb-2">
                            <label className="detail-label">{t('product')}</label>
                            <button 
                              type="button"
                              onClick={() => {
                                setIsQuickProductModalOpen(true);
                              }}
                              className="text-[10px] font-black text-slate-900 hover:underline flex items-center gap-1 uppercase tracking-widest"
                            >
                              <Plus size={10} />
                              {t('newOrder')}
                            </button>
                          </div>
                          <select
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all text-sm"
                            value={item.productId}
                            onChange={(e) => updateItem(index, 'productId', e.target.value)}
                          >
                            <option value="">{t('selectProduct')}</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({t('stockLevel')}: {p.stock})</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-3 md:col-span-6 gap-4">
                          <div>
                            <label className="detail-label">{t('unitPrice')}</label>
                            <input
                              required
                              type="number"
                              className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 text-sm tabular-nums"
                              value={item.price || 0}
                              onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <label className="detail-label">{t('quantity')}</label>
                            <input
                              required
                              type="number"
                              className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 text-sm tabular-nums"
                              value={item.quantity || 0}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <label className="detail-label">{t('subtotal')}</label>
                            <div className="px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-black tabular-nums shadow-lg shadow-slate-100 truncate">
                              {formatCurrency(item.price * item.quantity)}
                            </div>
                          </div>
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                          <button 
                            type="button"
                            onClick={() => removeItem(index)}
                            className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
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

              <div className="bg-slate-900 text-white p-10 md:p-12 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 items-center">
                  <div className="text-center sm:text-left">
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('total')}</p>
                    <h2 className="text-5xl font-black tracking-tighter tabular-nums">{formatCurrency(calculateTotal())}</h2>
                  </div>
                  <div>
                    <label className="block text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-3">{t('paid')}</label>
                    <div className="relative">
                      <BdtSign size={24} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" />
                      <input
                        required
                        type="number"
                        className="w-full pl-14 pr-6 py-5 rounded-3xl bg-white/5 border border-white/10 focus:ring-4 focus:ring-white/10 focus:border-white outline-none text-3xl font-black tabular-nums tracking-tighter transition-all"
                        value={orderForm.paidAmount || 0}
                        onChange={(e) => setOrderForm({...orderForm, paidAmount: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div className="text-center sm:text-right sm:col-span-2 lg:col-span-1">
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('due')}</p>
                    <h2 className={cn(
                      "text-3xl md:text-4xl font-black tabular-nums tracking-tight",
                      calculateTotal() - orderForm.paidAmount > 0 ? "text-rose-400" : "text-emerald-400"
                    )}>
                      {formatCurrency(Math.max(0, calculateTotal() - orderForm.paidAmount))}
                    </h2>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-all duration-1000" />
              </div>
            </form>

            <div className="p-10 border-t border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row gap-4 shrink-0">
              <button 
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  resetOrderForm();
                }}
                className="flex-1 px-8 py-5 rounded-[2rem] border border-slate-100 text-slate-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-white transition-all"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSubmit}
                className="flex-[2] px-8 py-5 rounded-[2rem] bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
              >
                {editingOrderId ? t('save') : t('newOrder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Product Modal */}
      {isQuickProductModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsQuickProductModalOpen(false)} />
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200">
                  <Package size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{t('registerProduct')}</h3>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Quick Asset Entry</p>
                </div>
              </div>
              <button onClick={() => setIsQuickProductModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleQuickProductSubmit} className="p-10 space-y-6">
              <div>
                <label className="detail-label">{t('assetIdentifier')}</label>
                <div className="relative">
                  <Package size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    required
                    type="text"
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700"
                    placeholder={t('assetIdentifier')}
                    value={quickProduct.name}
                    onChange={(e) => setQuickProduct({...quickProduct, name: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="detail-label">{t('unitValuation')}</label>
                  <div className="relative">
                    <BdtSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 tabular-nums"
                      placeholder="0.00"
                      value={quickProduct.price}
                      onChange={(e) => setQuickProduct({...quickProduct, price: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <div>
                  <label className="detail-label">{t('stockLevel')}</label>
                  <div className="relative">
                   <Layers size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      required
                      type="number"
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 tabular-nums"
                      placeholder="0"
                      value={quickProduct.stock}
                      onChange={(e) => setQuickProduct({...quickProduct, stock: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="detail-label">{t('registryCode')}</label>
                <div className="relative">
                  <Barcode size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700"
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
                  className="flex-1 px-4 py-3 rounded-2xl border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-gray-50 transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
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
