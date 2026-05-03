import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, User, Phone, MapPin, X, Download, Mail, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Supplier } from '../types';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';

export default function SupplierList() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<Supplier>({ 
    name: '', 
    phone: '', 
    shopName: '', 
    shopAddress: '',
    email: ''
  });

  useEffect(() => {
    if (user) {
      fetchSuppliers();
    }
  }, [user]);

  const fetchSuppliers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users', user.uid, 'suppliers'));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Supplier[];
      setSuppliers(data);
    } catch (error) {
      toast.error('Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingSupplier?.id) {
        const supplierRef = doc(db, 'users', user.uid, 'suppliers', editingSupplier.id);
        await updateDoc(supplierRef, {
          name: formData.name,
          phone: formData.phone,
          shopName: formData.shopName,
          shopAddress: formData.shopAddress,
          email: formData.email
        });
        toast.success('Supplier updated');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'suppliers'), {
          ...formData,
          ownerId: user.uid
        });
        toast.success('Supplier added');
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({ name: '', phone: '', shopName: '', shopAddress: '', email: '' });
      fetchSuppliers();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const exportToExcel = () => {
    const worksheetData = suppliers.map(s => ({
      'Supplier Name': s.name,
      'Mobile': s.phone,
      'Shop Name': s.shopName,
      'Address': s.shopAddress,
      'Email': s.email || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
    XLSX.writeFile(workbook, `Suppliers_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Suppliers list exported');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete')) || !user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'suppliers', id));
      toast.success('Supplier deleted');
      fetchSuppliers();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.shopName.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  );

  return (
    <div className="space-y-0 sm:space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 p-4 sm:p-0 bg-white sm:bg-transparent border-b border-slate-100 sm:border-none sticky top-0 z-40">
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            {t('suppliers')}
          </div>
          <h1 className="text-sm sm:text-5xl font-serif font-black tracking-tighter leading-tight">{t('suppliers')}</h1>
          <p className="text-slate-500 font-medium tracking-tight text-xs sm:text-base hidden sm:block">{t('manageSuppliers')}</p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-3 sm:gap-4">
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-brand-accent/20 text-brand-accent font-bold text-[10px] sm:text-base bg-white hover:bg-brand-accent/5 transition-all shadow-sm"
          >
            <Download size={16} className="sm:w-5 sm:h-5" />
            <span>{t('exportExcel')}</span>
          </button>
          <button 
            onClick={() => {
              setEditingSupplier(null);
              setFormData({ name: '', phone: '', shopName: '', shopAddress: '', email: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-900 font-bold text-white text-[10px] sm:text-base hover:opacity-90 transition-all shadow-lg active:scale-95"
          >
            <Plus size={16} className="sm:w-5 sm:h-5" />
            <span>{t('addSupplier')}</span>
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
          <table className="w-full text-left hidden md:table">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="data-grid-header">{t('supplierName')}</th>
                <th className="data-grid-header">{t('shopName')}</th>
                <th className="data-grid-header">{t('mobile')}</th>
                <th className="data-grid-header text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse">{t('syncing')}</td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-medium">{t('noSuppliersFound') || 'No suppliers identified.'}</td>
                </tr>
              ) : filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-lg border border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                        {supplier.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-900 tracking-tight">{supplier.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                      <Store size={14} className="text-slate-300" />
                      {supplier.shopName}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                      <Phone size={14} className="text-slate-300" />
                      {supplier.phone}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button 
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setFormData(supplier);
                          setIsModalOpen(true);
                        }}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(supplier.id!)}
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
              <div className="p-8 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse text-[10px]">{t('loading')}</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">{t('noSuppliersFound')}</div>
            ) : filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg font-black shadow-lg shadow-slate-200">
                      {supplier.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-[15px] tracking-tight">{supplier.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">{supplier.shopName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingSupplier(supplier);
                        setFormData(supplier);
                        setIsModalOpen(true);
                      }}
                      className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-colors border border-slate-100"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(supplier.id!)} 
                      className="w-9 h-9 flex items-center justify-center bg-rose-50 rounded-xl text-rose-300 hover:text-rose-600 transition-colors border border-rose-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 border-t border-slate-50 pt-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-300 border border-slate-100">
                      <Phone size={12} />
                    </div>
                    <p className="text-[11px] font-bold text-slate-600 tracking-tight">{supplier.phone}</p>
                  </div>
                  {supplier.shopAddress && (
                    <div className="flex items-start gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-300 border border-slate-100 shrink-0">
                        <MapPin size={12} />
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 leading-snug tracking-tight">{supplier.shopAddress}</p>
                    </div>
                  )}
                </div>
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
                    <h3 className="text-sm sm:text-2xl font-bold text-slate-900 tracking-tight">{editingSupplier ? t('edit') : t('addSupplier')}</h3>
                    <p className="text-[8px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 sm:mt-1">{t('manualEntry')}</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={18} className="sm:w-6 sm:h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-10 space-y-4 sm:space-y-6 overflow-y-auto flex-1 pb-20 sm:pb-10">
                <div>
                  <label className="detail-label text-[10px] sm:text-xs mb-1.5">{t('supplierName')}</label>
                  <div className="relative">
                    <User size={14} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input 
                      required
                      type="text" 
                      placeholder={t('supplierName')}
                      className="w-full pl-11 sm:pl-14 pr-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all text-xs sm:text-base h-11 sm:h-auto"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <label className="detail-label text-[10px] sm:text-xs mb-1.5">{t('email')} ({t('optional')})</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input 
                        type="email" 
                        placeholder={t('email')}
                        className="w-full pl-11 sm:pl-14 pr-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all text-xs sm:text-base h-11 sm:h-auto"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="detail-label text-[10px] sm:text-xs mb-1.5">{t('shopName')}</label>
                  <div className="relative">
                    <Store size={14} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input 
                      required
                      type="text" 
                      placeholder={t('shopName')}
                      className="w-full pl-11 sm:pl-14 pr-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all text-xs sm:text-base h-11 sm:h-auto"
                      value={formData.shopName}
                      onChange={(e) => setFormData({...formData, shopName: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="detail-label text-[10px] sm:text-xs mb-1.5">{t('shopAddress')}</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-4 sm:left-5 top-4 sm:top-5 text-slate-300" />
                    <textarea 
                      placeholder={t('shopAddress')}
                      className="w-full pl-11 sm:pl-14 pr-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all min-h-[100px] text-xs sm:text-base"
                      value={formData.shopAddress}
                      onChange={(e) => setFormData({...formData, shopAddress: e.target.value})}
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
                    type="submit"
                    className="flex-1 px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 h-12 sm:h-auto"
                  >
                    {t('save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
