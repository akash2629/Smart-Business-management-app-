import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  Wallet, 
  ArrowUpRight, 
  Download, 
  Filter,
  Users,
  Clock,
  TrendingUp
} from 'lucide-react';
import { BdtSign } from './Icons';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Payment } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function TransactionHistory() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({ total: 0, count: 0 });

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user, dateFilter]);

  const fetchPayments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch all payments for the specific date
      const q = query(
        collection(db, 'payments'),
        where('ownerId', '==', user.uid),
        where('paymentDate', '==', dateFilter),
        orderBy('createdAt', 'desc')
      );
      
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      setPayments(data);
      const total = data.reduce((sum, p) => sum + (p.amount || 0), 0);
      setStats({ total, count: data.length });
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch transaction logs');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(payments.map(p => ({
      'Date': p.paymentDate,
      'Amount': p.amount,
      'Method': p.method,
      'Reference ID': p.id
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily_Transactions');
    XLSX.writeFile(workbook, `Transactions_${dateFilter}.xlsx`);
    toast.success('Log exported successfully');
  };

  const filteredPayments = payments.filter(p => 
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    (p.method && p.method.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            Financial Surveillance
          </div>
          <h1 className="text-5xl font-serif font-black text-slate-900 tracking-tighter">Daily Record</h1>
          <p className="text-slate-500 font-medium tracking-tight">Granular date-wise monitoring of all financial inflows and settlements.</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="date"
            className="px-5 py-3.5 rounded-2xl border border-slate-100 bg-white font-bold text-slate-700 shadow-sm focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <button 
            onClick={exportToExcel}
            className="premium-button-secondary border-emerald-100 text-emerald-700 hover:bg-emerald-50"
          >
            <Download size={20} />
            <span className="hidden sm:inline">Export Log</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="premium-card p-8 bg-slate-900 text-white relative overflow-hidden group">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Total Daily Captured</p>
          <h3 className="text-4xl font-black tabular-nums tracking-tighter flex items-center gap-2">
            <BdtSign size={32} className="text-white/20" />
            {formatCurrency(stats.total).replace('৳', '')}
          </h3>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-all duration-700" />
        </div>
        <div className="premium-card p-8">
          <p className="detail-label text-slate-400">Transaction Count</p>
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{stats.count} Record{stats.count !== 1 ? 's' : ''}</h3>
        </div>
        <div className="premium-card p-8 flex items-center justify-between">
          <div>
            <p className="detail-label text-slate-400">Peak Performance</p>
            <h3 className="text-3xl font-bold text-emerald-600 tracking-tight">Active</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center animate-pulse shadow-sm">
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      <div className="premium-card">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search reference or method..." 
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-medium text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Filter size={14} />
            <span>Operational Filters Active</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left hidden md:table">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="data-grid-header">Timeline Log</th>
                <th className="data-grid-header">Settlement Flow</th>
                <th className="data-grid-header">Methodology</th>
                <th className="data-grid-header text-right">Liquidity Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse">Scanning Registry...</td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-medium">Archive dormant for this chronotype.</td>
                </tr>
              ) : filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 text-slate-400 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-all duration-500 shadow-sm">
                        <Clock size={16} />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block tracking-tight">
                          {payment.createdAt?.toDate ? new Date(payment.createdAt.toDate()).toLocaleTimeString() : 'Current'}
                        </span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Temporal Signature</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px] font-bold">
                      <span className="p-1 px-2 bg-slate-50 border border-slate-100 rounded-lg">{payment.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {payment.method}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <ArrowUpRight size={14} className="text-emerald-500" />
                       <span className="text-xl font-black text-emerald-600 tabular-nums">{formatCurrency(payment.amount)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-slate-50">
            {filteredPayments.map((p) => (
              <div key={p.id} className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 tracking-tight">{p.method}</p>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        {p.createdAt?.toDate ? new Date(p.createdAt.toDate()).toLocaleTimeString() : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-emerald-600">{formatCurrency(p.amount)}</span>
                </div>
                <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-50">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Audit Key</p>
                   <p className="text-[11px] font-mono font-bold text-slate-900 truncate">{p.id}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
