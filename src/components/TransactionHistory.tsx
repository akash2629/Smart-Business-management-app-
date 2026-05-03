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
import { useLanguage } from '../context/LanguageContext';

export default function TransactionHistory() {
  const { user } = useAuth();
  const { t } = useLanguage();
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
      // Simplified query to avoid composite index requirements
      const q = query(
        collection(db, 'users', user.uid, 'payments'),
        where('paymentDate', '==', dateFilter)
      );
      
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Sort client-side instead of in the query to avoid needing a composite index
      const sortedData = data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setPayments(sortedData);
      const total = sortedData.reduce((sum, p) => sum + (p.amount || 0), 0);
      setStats({ total, count: sortedData.length });
    } catch (error) {
      console.error('Fetch Payments Error:', error);
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
    <div className="space-y-0 sm:space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 p-4 sm:p-0 bg-white sm:bg-transparent border-b border-slate-100 sm:border-none sticky top-[60px] sm:top-[80px] z-40 transition-all duration-300">
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            {t('financialOverview')}
          </div>
          <h1 className="text-sm sm:text-5xl font-serif font-black tracking-tighter leading-tight">{t('dailyRecord')}</h1>
          <p className="text-slate-500 font-medium tracking-tight hidden sm:block">{t('trackOutstanding')}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <input 
            type="date"
            className="flex-1 sm:flex-none px-3 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-white font-bold text-slate-700 text-[10px] sm:text-sm shadow-sm focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-emerald-100 text-emerald-700 font-bold text-[10px] sm:text-base bg-white hover:bg-emerald-50 transition-all shadow-sm"
          >
            <Download size={18} className="sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">{t('exportExcel')}</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-0 sm:gap-8 border-b border-slate-100 sm:border-none bg-white">
        <div className="bg-slate-900 text-white p-5 sm:p-8 relative overflow-hidden group border-r border-white/5 sm:premium-card">
          <p className="text-[8px] sm:text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">{t('paid')}</p>
          <h3 className="text-xl sm:text-4xl font-black tabular-nums tracking-tighter flex items-center gap-2">
            <BdtSign size={20} className="sm:w-8 sm:h-8 text-white/20" />
            {formatCurrency(stats.total).replace('৳', '')}
          </h3>
          <div className="absolute top-0 right-0 w-16 sm:w-32 h-16 sm:h-32 bg-white/5 rounded-full blur-2xl sm:blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="bg-white p-5 sm:p-8 sm:premium-card sm:border-none border-r border-slate-100">
          <p className="detail-label text-slate-400 text-[8px] sm:text-[10px]">{t('totalCombinedValuation')}</p>
          <h3 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">{stats.count} <span className="text-[10px] sm:text-base text-slate-400">{t('orderRegistry')}</span></h3>
        </div>
        <div className="bg-white p-5 sm:p-8 col-span-2 lg:col-span-1 flex items-center justify-between sm:premium-card border-t border-slate-100 sm:border-t-0">
          <div>
            <p className="detail-label text-slate-400 text-[8px] sm:text-[10px]">{t('status')}</p>
            <h3 className="text-xl sm:text-3xl font-bold text-emerald-600 tracking-tight">{t('paid')}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center animate-pulse shadow-sm">
            <TrendingUp size={20} className="sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      <div className="bg-white sm:premium-card border-b border-slate-100 sm:border-none">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/20">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder={t('search')} 
              className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-bold text-[10px] sm:text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table --- omitted for brevity but preserved in real tool call --- */}
          <table className="w-full text-left hidden md:table">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="data-grid-header">{t('date')}</th>
                <th className="data-grid-header">{t('orderId')}</th>
                <th className="data-grid-header">{t('paymentMethod')}</th>
                <th className="data-grid-header text-right">{t('total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse">Loading Bills...</td>
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

          {/* Mobile Card Layout */}
          <div className="md:hidden p-4 space-y-4 bg-slate-50/30">
            {loading ? (
              <div className="p-8 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse text-[10px]">Loading...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No Transactions</div>
            ) : filteredPayments.map((p) => (
              <div key={p.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                      {p.method?.toLowerCase().includes('cash') ? <Wallet size={20} /> : <TrendingUp size={20} />}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-[15px] tracking-tight">{p.method}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={10} className="text-slate-300" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                          {p.createdAt?.toDate ? new Date(p.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-emerald-600">
                       <ArrowUpRight size={12} />
                       <p className="text-[16px] font-black tabular-nums leading-none">{formatCurrency(p.amount).replace('৳', '')}</p>
                    </div>
                    <p className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest mt-1">Settlement</p>
                  </div>
                </div>
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                   <div className="flex items-center justify-between mb-1.5">
                     <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Transaction Registry</p>
                     <p className="text-[9px] font-bold text-slate-300">ID</p>
                   </div>
                   <p className="text-[10px] font-mono font-bold text-slate-500 truncate bg-white p-2 rounded-lg border border-slate-100">{p.id}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
