import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Barcode, Layers, X, Download } from 'lucide-react';
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

export default function ProductList() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Product>({ name: '', code: '', price: 0, stock: 0 });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingProduct?.id) {
        const productRef = doc(db, 'products', editingProduct.id);
        await updateDoc(productRef, {
          name: formData.name,
          code: formData.code,
          price: formData.price,
          stock: formData.stock
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
      setFormData({ name: '', code: '', price: 0, stock: 0 });
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
            Inventory Global Archive
          </div>
          <h1 className="text-5xl font-serif font-black text-slate-900 tracking-tighter">Product Catalog</h1>
          <p className="text-slate-500 font-medium tracking-tight">Full-spectrum management of your shop's stock units and logistical data.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={exportToExcel}
            className="premium-button-secondary border-emerald-100 text-emerald-700 hover:bg-emerald-50"
          >
            <Download size={20} />
            <span className="hidden sm:inline">Export Excel</span>
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
            <span>Add Asset</span>
          </button>
        </div>
      </header>

      <div className="premium-card">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by identity or barcode..." 
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-medium text-sm"
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
                <th className="data-grid-header">Asset Identifier</th>
                <th className="data-grid-header">Registry Code</th>
                <th className="data-grid-header">Unit Valuation</th>
                <th className="data-grid-header">Stock Level</th>
                <th className="data-grid-header text-right">Operational Logic</th>
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
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        product.stock > 10 ? "bg-emerald-500" : product.stock > 0 ? "bg-amber-500" : "bg-rose-500"
                      )} />
                      <span className="text-sm font-bold text-slate-600 tabular-nums">{product.stock} Units</span>
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
                    <label className="detail-label">Available Units</label>
                    <div className="flex items-center justify-end gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        product.stock > 10 ? "bg-emerald-500" : product.stock > 0 ? "bg-amber-500" : "bg-rose-500"
                      )} />
                      <span className="font-bold text-slate-900 tabular-nums">{product.stock} Units</span>
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
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{editingProduct ? 'Modify Asset' : 'Register Asset'}</h3>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Inventory Management Subsystem</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} id="product-form" className="p-10 space-y-8 overflow-y-auto">
                <div className="space-y-6">
                  <div>
                    <label className="detail-label">Asset Nomenclature</label>
                    <div className="relative">
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Premium Silk Scarf"
                        className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 transition-all placeholder:text-slate-300"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="detail-label">Global Registry Code (Barcode)</label>
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
                      <label className="detail-label">Unit Valuation (Price)</label>
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
                      <label className="detail-label">Quantifiable Stock</label>
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
                  Discard Changes
                </button>
                <button 
                  type="submit"
                  form="product-form"
                  className="flex-1 px-6 py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
                >
                  {editingProduct ? 'Update Registry' : 'Commit Registry'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
