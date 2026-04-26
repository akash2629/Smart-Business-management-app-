import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Trash2, ShoppingBasket, Truck, Calendar, FileText, X, Printer, Download, Package, Phone, MapPin, Edit2, AlertCircle, Store } from 'lucide-react';
import { BdtSign } from './Icons';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Purchase, Supplier, Product, OrderItem } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
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
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function PurchaseList() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  
  const [purchaseForm, setPurchaseForm] = useState<{
    supplierId: string;
    paidAmount: number;
    items: { productId: string, productName: string, quantity: number, price: number }[];
    note: string;
  }>({
    supplierId: '',
    paidAmount: 0,
    items: [],
    note: ''
  });

  const [newSupplier, setNewSupplier] = useState<Supplier>({
    name: '',
    phone: '',
    shopName: '',
    shopAddress: '',
    email: ''
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
      const purchasesQ = query(collection(db, 'users', user.uid, 'purchases'), orderBy('createdAt', 'desc'));
      const [purchasesSnap, suppliersSnap, productsSnap] = await Promise.all([
        getDocs(purchasesQ),
        getDocs(collection(db, 'users', user.uid, 'suppliers')),
        getDocs(collection(db, 'users', user.uid, 'products'))
      ]);

      const purchasesData = purchasesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setPurchases(purchasesData.map(p => ({
        ...p,
        createdAt: p.createdAt?.toDate?.()?.toISOString() || p.createdAt
      })));

      setSuppliers(suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Supplier[]);
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return purchaseForm.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!purchaseForm.supplierId) return toast.error('Please select a supplier');
    if (purchaseForm.items.length === 0) return toast.error('Please add at least one product');

    const totalAmount = calculateTotal();
    const status = purchaseForm.paidAmount >= totalAmount ? 'Paid' : 'Due';
    const supplier = suppliers.find(s => s.id === purchaseForm.supplierId);

    try {
      const batch = writeBatch(db);
      const purchaseRef = doc(collection(db, 'users', user.uid, 'purchases'));
      
      const purchaseData = {
        supplierId: purchaseForm.supplierId,
        supplierName: supplier?.name || 'Unknown',
        shopName: supplier?.shopName || 'Unknown Shop',
        totalAmount,
        paidAmount: purchaseForm.paidAmount,
        status,
        note: purchaseForm.note,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      };

      batch.set(purchaseRef, purchaseData);

      purchaseForm.items.forEach(item => {
        const itemRef = doc(collection(purchaseRef, 'items'));
        batch.set(itemRef, {
          ...item,
          ownerId: user.uid
        });

        if (item.productId) {
          const productRef = doc(db, 'users', user.uid, 'products', item.productId);
          batch.update(productRef, { stock: increment(item.quantity) });
        }
      });

      await batch.commit();
      
      toast.success('Purchase recorded successfully');
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to record purchase');
    }
  };

  const resetForm = () => {
    setPurchaseForm({
      supplierId: '',
      paidAmount: 0,
      items: [],
      note: ''
    });
  };

  const handleDelete = async (id: string) => {
    setPurchaseToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!purchaseToDelete || !user) return;
    try {
      const purchaseRef = doc(db, 'users', user.uid, 'purchases', purchaseToDelete);
      const itemsSnap = await getDocs(collection(purchaseRef, 'items'));
      
      const batch = writeBatch(db);
      
      itemsSnap.docs.forEach(itemDoc => {
        const item = itemDoc.data();
        if (item.productId) {
          const productRef = doc(db, 'users', user.uid, 'products', item.productId);
          batch.update(productRef, { stock: increment(-item.quantity) });
        }
        batch.delete(itemDoc.ref);
      });

      batch.delete(purchaseRef);
      await batch.commit();
      
      toast.success('Purchase deleted and stock adjusted');
      setIsDeleteModalOpen(false);
      setPurchaseToDelete(null);
      fetchData();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const addItem = (product: Product) => {
    setPurchaseForm({
      ...purchaseForm,
      items: [
        ...purchaseForm.items, 
        { 
          productId: product.id!, 
          productName: product.name,
          quantity: 1, 
          price: product.buyPrice || 0
        }
      ]
    });
    setIsProductPickerOpen(false);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...purchaseForm.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setPurchaseForm({ ...purchaseForm, items: updatedItems });
  };

  const removeItem = (index: number) => {
    setPurchaseForm({
      ...purchaseForm,
      items: purchaseForm.items.filter((_, i) => i !== index)
    });
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'suppliers'), {
        ...newSupplier,
        ownerId: user.uid
      });
      fetchData();
      setPurchaseForm({ ...purchaseForm, supplierId: docRef.id });
      setIsSupplierModalOpen(false);
      setNewSupplier({ name: '', phone: '', shopName: '', shopAddress: '', email: '' });
      toast.success('Supplier added');
    } catch (error) {
      toast.error('Failed to add supplier');
    }
  };

  const filteredPurchases = purchases.filter(p => 
    p.supplierName?.toLowerCase().includes(search.toLowerCase()) || 
    p.id?.toString().includes(search)
  );

  return (
    <div className="space-y-0 sm:space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 p-4 sm:p-0 bg-white sm:bg-transparent border-b border-slate-100 sm:border-none sticky top-0 z-40">
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            {t('purchases')}
          </div>
          <h1 className="text-sm sm:text-5xl font-serif font-black tracking-tighter leading-tight">{t('purchases')}</h1>
          <p className="text-slate-500 font-medium tracking-tight text-xs sm:text-base hidden sm:block">{t('managePurchases')}</p>
        </div>
        <button 
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-900 font-bold text-white text-[10px] sm:text-base hover:opacity-90 transition-all shadow-lg active:scale-95"
        >
          <Plus size={16} className="sm:w-5 sm:h-5" />
          <span>{t('newPurchase')}</span>
        </button>
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
          <table className="w-full text-left hidden md:table">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="data-grid-header">{t('id')}</th>
                <th className="data-grid-header">{t('supplierName')}</th>
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
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-medium">No purchases recorded.</td>
                </tr>
              ) : filteredPurchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-slate-50/50 transition-colors group text-sm">
                  <td className="px-6 py-5 font-mono font-bold text-slate-400">#{purchase.id?.slice(-6)}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <Store size={14} className="text-slate-400" />
                      <span className="font-bold text-slate-900 tracking-tight">{purchase.supplierName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-500 font-medium">
                    {formatDate(purchase.createdAt!)}
                  </td>
                  <td className="px-6 py-5 font-black text-slate-900 tabular-nums">{formatCurrency(purchase.totalAmount)}</td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                      purchase.status === 'Paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {purchase.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => handleDelete(purchase.id!)}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-slate-100 bg-white">
            {loading ? (
              <div className="p-8 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse text-[10px]">Loading...</div>
            ) : filteredPurchases.length === 0 ? (
              <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No Purchases Found</div>
            ) : filteredPurchases.map((purchase) => (
              <div key={purchase.id} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-slate-900 text-[12px] tracking-tight">{purchase.supplierName}</p>
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">#{purchase.id?.slice(-6)}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-black text-slate-900 tabular-nums">{formatCurrency(purchase.totalAmount)}</p>
                    <span className={cn(
                      "inline-block px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border mt-1",
                      purchase.status === 'Paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {purchase.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400">{formatDate(purchase.createdAt!)}</span>
                  <button onClick={() => handleDelete(purchase.id!)} className="p-2 bg-rose-50 rounded-xl text-rose-300 hover:text-rose-600 transition-colors border border-rose-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Purchase Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white rounded-none sm:rounded-[3.5rem] w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] shadow-2xl overflow-hidden relative z-10 flex flex-col">
              <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white sm:bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-3 sm:gap-6">
                  <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-xl sm:rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-200">
                    <ShoppingBasket size={18} className="sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-2xl font-bold text-slate-900 tracking-tight">{t('newPurchase')}</h3>
                    <p className="text-[8px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 sm:mt-1">{t('buyProduct') || 'Record product purchase'}</p>
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
                      <label className="detail-label text-[9px] sm:text-[10px]">{t('supplierName')}</label>
                      <button 
                        type="button"
                        onClick={() => setIsSupplierModalOpen(true)}
                        className="text-[9px] sm:text-[10px] font-black text-slate-900 hover:underline flex items-center gap-1 uppercase tracking-widest"
                      >
                        <Plus size={10} />
                        {t('addSupplier')}
                      </button>
                    </div>
                    <select 
                      required
                      className="w-full px-4 sm:px-5 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all cursor-pointer text-[10px] sm:text-sm h-11 sm:h-auto"
                      value={purchaseForm.supplierId}
                      onChange={(e) => setPurchaseForm({...purchaseForm, supplierId: e.target.value})}
                    >
                      <option value="">{t('selectSupplier') || 'Select Supplier'}</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.shopName})</option>)}
                    </select>
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
                      onClick={() => setIsProductPickerOpen(true)}
                      className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg bg-white border border-slate-100 text-[8px] sm:text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      <Plus size={14} className="sm:w-4 sm:h-4 text-brand-primary" />
                      <span>{t('addItems')}</span>
                    </button>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {purchaseForm.items.map((item, index) => (
                      <div key={index} className="bg-white p-3 sm:p-8 rounded-xl sm:rounded-[2rem] border border-slate-100 relative group/item hover:bg-slate-50/20 transition-all shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-6 items-end">
                          <div className="md:col-span-6">
                            <label className="detail-label text-[8px] sm:text-[10px] mb-1 sm:mb-2">{t('product')}</label>
                            <input 
                              disabled 
                              className="w-full px-4 sm:px-5 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-100/50 font-bold text-slate-900 text-[10px] sm:text-sm h-11 sm:h-auto"
                              value={item.productName}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="detail-label text-[8px] sm:text-[10px] mb-1 sm:mb-2">{t('price')}</label>
                            <input 
                              required
                              type="number"
                              className="w-full px-4 sm:px-5 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 font-bold text-slate-700 text-[10px] sm:text-sm h-11 sm:h-auto"
                              value={item.price}
                              onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="detail-label text-[8px] sm:text-[10px] mb-1 sm:mb-2">{t('quantity')}</label>
                            <input 
                              required
                              type="number"
                              className="w-full px-4 sm:px-5 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 font-bold text-slate-700 text-[10px] sm:text-sm h-11 sm:h-auto"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                            />
                          </div>
                          <div className="md:col-span-2 flex items-center justify-between gap-4">
                             <div className="flex-1">
                               <label className="detail-label text-[8px] sm:text-[10px] mb-1 sm:mb-2">{t('total')}</label>
                               <div className="font-black text-slate-900 tabular-nums px-2 text-[10px] sm:text-sm pb-2 sm:pb-4">{formatCurrency(item.quantity * item.price)}</div>
                             </div>
                             <button 
                              type="button"
                              onClick={() => removeItem(index)}
                              className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl sm:rounded-2xl transition-all border border-transparent hover:border-rose-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                   <div className="md:col-span-7 space-y-6">
                    <div>
                      <label className="detail-label text-[9px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('note')}</label>
                      <textarea 
                        className="w-full px-5 py-4 rounded-[2rem] border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-medium text-slate-700 transition-all min-h-[140px] text-xs sm:text-sm"
                        placeholder={t('note') || 'Add a note...'}
                        value={purchaseForm.note}
                        onChange={(e) => setPurchaseForm({...purchaseForm, note: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-5 space-y-4">
                    <div className="bg-slate-900 text-white p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl shadow-slate-100 space-y-6 sm:space-y-8">
                       <div className="flex justify-between items-center opacity-40">
                         <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">Summary</span>
                         <div className="w-8 h-[1px] bg-white/20"></div>
                       </div>
                       
                       <div className="space-y-4">
                         <div className="flex justify-between items-center group/price">
                           <span className="text-[10px] sm:text-xs font-bold text-white/50 uppercase tracking-widest">{t('subtotal')}</span>
                           <span className="text-xl sm:text-2xl font-black tabular-nums">{formatCurrency(calculateTotal())}</span>
                         </div>
                       </div>

                       <div className="pt-6 sm:pt-8 border-t border-white/10 space-y-4 sm:space-y-6">
                          <div>
                            <div className="flex justify-between items-center mb-2 sm:mb-3">
                              <label className="text-[10px] sm:text-xs font-black text-white/40 uppercase tracking-widest">{t('paidAmount')}</label>
                              <span className="text-[10px] sm:text-xs font-black text-emerald-400 uppercase tracking-widest">{t('ready')}</span>
                            </div>
                            <div className="relative group">
                              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-400 transition-colors">
                                 <BdtSign size={18} />
                              </div>
                              <input 
                                type="number"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-2xl sm:rounded-3xl pl-12 sm:pl-14 pr-6 py-4 sm:py-5 font-black text-white text-lg sm:text-2xl focus:ring-4 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all tabular-nums"
                                value={purchaseForm.paidAmount}
                                onChange={(e) => setPurchaseForm({...purchaseForm, paidAmount: parseFloat(e.target.value) || 0})}
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center p-5 sm:p-8 bg-white/5 rounded-3xl sm:rounded-[2.5rem] border border-white/5">
                            <span className="text-[10px] sm:text-xs font-black text-white/40 uppercase tracking-[0.2em]">{t('due')}</span>
                            <span className={cn(
                              "text-xl sm:text-3xl font-black tabular-nums",
                              calculateTotal() - purchaseForm.paidAmount > 0 ? "text-rose-400" : "text-emerald-400"
                            )}>
                              {formatCurrency(calculateTotal() - purchaseForm.paidAmount)}
                            </span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-0 sm:relative bg-white/80 backdrop-blur-md sm:bg-transparent flex gap-3 sm:gap-6 pt-4 shrink-0 z-[60]">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] border border-slate-100 bg-white text-slate-400 font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] px-8 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] bg-slate-900 text-white font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
                  >
                    {t('newPurchase')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white p-6 sm:p-12 rounded-[2.5rem] sm:rounded-[3.5rem] max-w-md w-full relative z-10 text-center space-y-6 sm:space-y-8 shadow-2xl">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle size={32} className="sm:w-10 sm:h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">Purge Purchase Record?</h3>
                <p className="text-slate-400 font-medium text-xs sm:text-sm leading-relaxed px-4">Inventory stock will be adjusted. This action is irreversible.</p>
              </div>
              <div className="flex gap-3 sm:gap-4">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                  {t('cancel')}
                </button>
                <button onClick={confirmDelete} className="flex-1 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-xl shadow-rose-200">
                  {t('archive')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Picker */}
      <AnimatePresence>
        {isProductPickerOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsProductPickerOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white rounded-[2.5rem] sm:rounded-[3.5rem] w-full max-w-2xl h-full sm:h-auto sm:max-h-[80vh] shadow-2xl overflow-hidden relative z-10 flex flex-col">
              <div className="p-6 sm:p-10 border-b border-slate-50 flex items-center justify-between shrink-0">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">{t('selectProduct')}</h3>
                <button onClick={() => setIsProductPickerOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 hover:bg-slate-50 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 sm:p-10 flex-1 overflow-y-auto space-y-3 sm:space-y-4">
                {products.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Registry Empty</div>
                ) : products.map(product => (
                  <button 
                    key={product.id}
                    type="button"
                    onClick={() => addItem(product)}
                    className="w-full flex items-center justify-between p-4 sm:p-6 bg-slate-50/50 hover:bg-white border border-slate-50 hover:border-slate-200 rounded-2xl sm:rounded-3xl transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center border border-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                        <Package size={18} className="sm:w-6 sm:h-6" />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-900 text-sm sm:text-base tracking-tight">{product.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.code} • Stock: {product.stock}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 tabular-nums">{formatCurrency(product.buyPrice || 0)}</p>
                      <p className="text-[8px] font-black text-brand-primary uppercase tracking-[0.2em]">{t('select')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supplier Modal */}
      <AnimatePresence>
        {isSupplierModalOpen && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsSupplierModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white rounded-[2.5rem] sm:rounded-[3.5rem] w-full max-w-lg shadow-2xl relative z-10 overflow-hidden flex flex-col">
              <div className="p-6 sm:p-10 border-b border-slate-50 flex items-center justify-between shrink-0">
                 <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">{t('addSupplier')}</h3>
                 <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 hover:bg-slate-50 rounded-xl transition-all">
                   <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleSupplierSubmit} className="p-6 sm:p-10 space-y-4 sm:space-y-6 overflow-y-auto max-h-[80vh]">
                 <div>
                    <label className="detail-label text-[10px] mb-1.5">{t('supplierName')}</label>
                    <input 
                      required
                      className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 font-bold text-slate-700 outline-none"
                      value={newSupplier.name}
                      onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="detail-label text-[10px] mb-1.5">{t('shopName')}</label>
                    <input 
                      required
                      className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 font-bold text-slate-700 outline-none"
                      value={newSupplier.shopName}
                      onChange={(e) => setNewSupplier({...newSupplier, shopName: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="detail-label text-[10px] mb-1.5">{t('mobile')}</label>
                    <input 
                      required
                      className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 font-bold text-slate-700 outline-none"
                      value={newSupplier.phone}
                      onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                    />
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="flex-1 py-4 border border-slate-100 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest">{t('cancel')}</button>
                    <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">{t('save')}</button>
                 </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
