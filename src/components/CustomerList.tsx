import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, User, Phone, MapPin, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Customer } from '../types';
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

export default function CustomerList() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
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

  const exportToCSV = () => {
    const headers = ['Name', 'Phone', 'Address'];
    const rows = customers.map(c => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`
    ].join(','));
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Customer_Directory.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exporting customer directory...');
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

  return (
    <div className="space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            Client Relations
          </div>
          <h1 className="text-5xl font-serif font-black text-slate-900 tracking-tighter">Customer Directory</h1>
          <p className="text-slate-500 font-medium tracking-tight">Manage your client relationships and strategic contact details.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={exportToCSV}
            className="premium-button-secondary border-emerald-100 text-emerald-700 hover:bg-emerald-50"
          >
            <Download size={20} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button 
            onClick={() => {
              setEditingCustomer(null);
              setFormData({ name: '', phone: '', address: '' });
              setIsModalOpen(true);
            }}
            className="premium-button-primary"
          >
            <Plus size={20} />
            <span>Onboard Entity</span>
          </button>
        </div>
      </header>

      <div className="premium-card">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Locate customer record..." 
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
                <th className="data-grid-header">Entity Identity</th>
                <th className="data-grid-header">Operational Registry (Phone)</th>
                <th className="data-grid-header">Locality Details</th>
                <th className="data-grid-header text-right">Operational Logic</th>
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
              <div className="p-10 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse">Syncing...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-medium">Null Registry.</div>
            ) : filteredCustomers.map((customer) => (
              <div key={customer.id} className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-lg border border-slate-200">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 tracking-tight">{customer.name}</p>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        setEditingCustomer(customer);
                        setFormData(customer);
                        setIsModalOpen(true);
                      }}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
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
                </div>
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400">
                    <MapPin size={14} />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 leading-relaxed tracking-tight">{customer.address || 'No address provided'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden relative z-10 max-h-[90vh] flex flex-col">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-200">
                  <User size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{editingCustomer ? 'Edit Registry' : 'New Identification'}</h3>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Audit Trail Entry</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-100 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto">
              <div>
                <label className="detail-label">Legal Identity</label>
                <div className="relative">
                  <User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    required
                    type="text" 
                    placeholder="Full Nomenclature"
                    className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="detail-label">Registry Communications</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    required
                    type="tel" 
                    placeholder="Registry Contact Number"
                    className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all font-mono"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="detail-label">Geospatial Locality</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-5 top-5 text-slate-300" />
                  <textarea 
                    placeholder="Physical Domicile Registry"
                    className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 transition-all min-h-[120px]"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>
            </form>
            <div className="p-10 border-t border-slate-50 bg-slate-50/30 flex gap-4 shrink-0">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-6 py-4 rounded-2xl border border-slate-100 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-white transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                className="flex-1 px-6 py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
              >
                {editingCustomer ? 'Update Ledger' : 'Commit Registry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
