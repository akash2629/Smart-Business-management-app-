import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Barcode, Layers, X, Download, Image as ImageIcon, Upload, Loader2, Camera } from 'lucide-react';
import { BdtSign } from './Icons';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';
import { formatCurrency, cn } from '../lib/utils';
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
  doc 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function ProductList() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Product>({ 
    name: '', 
    code: '', 
    price: 0, 
    stock: 0,
    images: []
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user]);

  const fetchProducts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), where('ownerId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(data);
    } catch (error) {
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          // Compress to 70% quality JPG
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    const newImages = [...(formData.images || [])];

    try {
      for (let i = 0; i < files.length; i++) {
        if (newImages.length >= 10) break; // Hard limit for safety
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (>5MB)`);
          continue;
        }
        const compressed = await compressImage(file);
        newImages.push(compressed);
      }
      setFormData({ ...formData, images: newImages });
      toast.success('Images processed and added');
    } catch (error) {
      console.error(error);
      toast.error('Image processing failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...(formData.images || [])];
    newImages.splice(index, 1);
    setFormData({ ...formData, images: newImages });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if ((formData.images?.length || 0) < 6) {
      if (!confirm('You have strictly fewer than 6 images. Proceed anyway?')) return;
    }

    try {
      if (editingProduct?.id) {
        const productRef = doc(db, 'products', editingProduct.id);
        await updateDoc(productRef, {
          name: formData.name,
          code: formData.code,
          price: formData.price,
          stock: formData.stock,
          images: formData.images || []
        });
        toast.success('Product updated');
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          ownerId: user.uid
        });
        toast.success('Product added');
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', code: '', price: 0, stock: 0, images: [] });
      fetchProducts();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('Product deleted');
      fetchProducts();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(products.map(p => ({
      'Product Name': p.name,
      'Barcode/Code': p.code,
      'Price': p.price,
      'Current Stock': p.stock
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'Product_Catalog.xlsx');
    toast.success('Exporting catalog to Excel...');
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            {t('inventoryGlobal')}
          </div>
          <h1 className="text-5xl font-serif font-black text-slate-900 tracking-tighter">{t('productCatalog')}</h1>
          <p className="text-slate-500 font-medium tracking-tight">{t('inventoryGlobal')}</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={exportToExcel}
            className="premium-button-secondary border-brand-accent/20 text-brand-accent hover:bg-brand-accent/5"
          >
            <Download size={20} />
            <span className="hidden sm:inline">{t('exportExcel')}</span>
          </button>
          <button 
            onClick={() => {
              setEditingProduct(null);
              setFormData({ name: '', code: '', price: 0, stock: 0 });
              setIsModalOpen(true);
            }}
            className="premium-button-primary"
          >
            <Plus size={20} />
            <span>{t('addAsset')}</span>
          </button>
        </div>
      </header>

      <div className="premium-card">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={t('search')} 
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 bg-white focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all font-medium text-sm"
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
                <th className="data-grid-header">{t('assetIdentifier')}</th>
                <th className="data-grid-header">{t('registryCode')}</th>
                <th className="data-grid-header">{t('unitValuation')}</th>
                <th className="data-grid-header">{t('stockLevel')}</th>
                <th className="data-grid-header text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse">Syncing...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">Clear Archive. No records present.</td>
                </tr>
              ) : filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200 group-hover:scale-110 transition-transform duration-500">
                        <Package size={20} />
                      </div>
                      <span className="font-bold text-slate-900 tracking-tight">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-100">
                      <Barcode size={12} />
                      {product.code}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-bold text-slate-900 tabular-nums text-sm">{formatCurrency(product.price)}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full shadow-sm",
                          product.stock > 10 ? "bg-emerald-500" : product.stock > 0 ? "bg-amber-500 animate-pulse" : "bg-rose-500"
                        )} />
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          product.stock > 10 ? "text-slate-600" : product.stock > 0 ? "text-amber-600" : "text-rose-600"
                        )}>{product.stock} Units</span>
                      </div>
                      {product.stock <= 10 && (
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit",
                          product.stock === 0 
                            ? "bg-rose-50 text-rose-600 border border-rose-100" 
                            : "bg-amber-50 text-amber-600 border border-amber-100"
                        )}>
                          <div className={cn("w-1 h-1 rounded-full", product.stock === 0 ? "bg-rose-600" : "bg-amber-600")} />
                          {product.stock === 0 ? t('outOfStock') : t('lowStock')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button 
                        onClick={() => {
                          setEditingProduct(product);
                          setFormData(product);
                          setIsModalOpen(true);
                        }}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id!)}
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
              <div className="p-10 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse">Syncing...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-medium">Null Registry.</div>
            ) : filteredProducts.map((product) => (
              <div key={product.id} className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 tracking-tight">{product.name}</p>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{product.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        setEditingProduct(product);
                        setFormData(product);
                        setIsModalOpen(true);
                      }}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(product.id!)}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
                  <div>
                    <label className="detail-label">Valuation</label>
                    <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(product.price)}</span>
                  </div>
                  <div className="text-right">
                    <label className="detail-label">{t('stockLevel')}</label>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          product.stock > 10 ? "bg-emerald-500" : product.stock > 0 ? "bg-amber-500" : "bg-rose-500"
                        )} />
                        <span className={cn(
                          "font-bold tabular-nums",
                          product.stock > 10 ? "text-slate-900" : product.stock > 0 ? "text-amber-600" : "text-rose-600"
                        )}>{product.stock} {t('items')}</span>
                      </div>
                      {product.stock <= 10 && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                          product.stock === 0 
                            ? "bg-rose-50 text-rose-600 border-rose-100" 
                            : "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                          {product.stock === 0 ? t('outOfStock') : t('lowStock')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[3rem] w-full max-w-lg shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden relative z-10 max-h-[90vh] flex flex-col"
            >
              <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-200">
                    <Package size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{editingProduct ? t('edit') : t('newOrder')}</h3>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">{t('manualEntry')}</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} id="product-form" className="p-10 space-y-8 overflow-y-auto">
                <div className="space-y-6">
                  {/* Image Upload Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="detail-label">Asset Visuals</label>
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                        (formData.images?.length || 0) < 6 
                          ? "bg-amber-50 text-amber-600 border-amber-100" 
                          : "bg-emerald-50 text-emerald-600 border-emerald-100"
                      )}>
                        {(formData.images?.length || 0)} / 6 Minimum
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {formData.images?.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 group">
                          <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute inset-0 bg-rose-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-brand-primary hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all group"
                      >
                        {uploading ? (
                          <Loader2 size={20} className="animate-spin text-brand-primary" />
                        ) : (
                          <>
                            <Upload size={20} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Add {6 - (formData.images?.length || 0) > 0 ? 6 - (formData.images?.length || 0) : ''} More</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      multiple 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </div>

                  <div>
                    <label className="detail-label">{t('assetIdentifier')}</label>
                    <div className="relative">
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <input 
                        required
                        type="text" 
                        placeholder={t('assetIdentifier')}
                        className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="detail-label">{t('registryCode')}</label>
                    <div className="relative">
                      <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <input 
                        required
                        type="text" 
                        placeholder="SKU-9982-X"
                        className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="detail-label">{t('unitValuation')}</label>
                      <div className="relative">
                        <BdtSign size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300 tabular-nums"
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="detail-label">{t('stockLevel')}</label>
                      <div className="relative">
                        <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                        <input 
                          required
                          type="number" 
                          placeholder="0"
                          className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300 tabular-nums"
                          value={formData.stock}
                          onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
              <div className="p-10 border-t border-slate-50 bg-slate-50/30 flex gap-4 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 rounded-2xl border border-slate-100 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-white transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  form="product-form"
                  className="flex-1 px-6 py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
                >
                  {editingProduct ? t('save') : t('registerProduct')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
