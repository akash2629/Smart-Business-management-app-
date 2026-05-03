import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  Search, 
  Calendar, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  CreditCard,
  Building2,
  Zap,
  Users2,
  Package2,
  MoreHorizontal,
  ChevronRight,
  TrendingUp,
  Filter
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Expense } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase';

const CATEGORIES = [
  { id: 'shopRent', icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'electricityBill', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'staffSalary', icon: Users2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'transport', icon: Package2, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'others', icon: MoreHorizontal, color: 'text-slate-500', bg: 'bg-slate-50' },
];

export default function CostingDashboard() {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
  
  const [expenseForm, setExpenseForm] = useState({
    category: 'others',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', auth.currentUser.uid, 'expenses'),
        orderBy('date', 'desc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[];
      setExpenses(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      return toast.error('Check amount');
    }

    try {
      const expenseData = {
        category: expenseForm.category,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
        date: expenseForm.date,
        ownerId: auth.currentUser.uid
      };
      
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'expenses'), expenseData);
      toast.success(t('expenseRegistry'));
      setIsModalOpen(false);
      setExpenseForm({
        category: 'others',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser || !confirm(t('confirmDelete'))) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'expenses', id));
      toast.success(t('delete'));
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'expenses');
    }
  };

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description.toLowerCase().includes(search.toLowerCase()) || 
                          t(e.category).toLowerCase().includes(search.toLowerCase());
    
    if (activeTab === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      return matchesSearch && e.date === today;
    } else {
      const currentMonth = new Date().toISOString().slice(0, 7);
      return matchesSearch && e.date.startsWith(currentMonth);
    }
  });

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  const dailyTotal = expenses
    .filter(e => e.date === new Date().toISOString().split('T')[0])
    .reduce((sum, e) => sum + e.amount, 0);

  const monthlyTotal = expenses
    .filter(e => e.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4 sm:space-y-8 animate-in fade-in duration-500 pb-20 sm:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 bg-white sm:bg-white/50 backdrop-blur-sm p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 sm:border-white shadow-sm sticky top-0 sm:relative z-40">
        <div className="space-y-2 sm:space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[9px] sm:text-xs font-black uppercase tracking-widest border border-rose-100">
            <TrendingDown size={10} />
            <span>Operational Costs</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif font-black text-slate-950 tracking-tighter leading-none italic">
            {t('costing')}
          </h1>
          <p className="text-[10px] sm:text-sm font-bold text-slate-400 max-w-sm leading-relaxed hidden sm:block">
            {t('manageCosting')}
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto h-14 sm:h-16 px-8 sm:px-10 bg-slate-950 text-white rounded-2xl sm:rounded-3xl font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200"
        >
          <Plus size={18} />
          {t('addExpense')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 px-4 sm:px-0">
        <div className="p-6 sm:p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-30 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-6">
              <Calendar size={20} />
            </div>
            <p className="text-[8px] sm:text-xs font-black text-slate-300 uppercase tracking-[0.2em] mb-1">{t('dailyCosting')}</p>
            <h3 className="text-2xl sm:text-4xl font-black text-slate-900 tabular-nums tracking-tight">
              {formatCurrency(dailyTotal)}
            </h3>
          </div>
        </div>

        <div className="p-6 sm:p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-30 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
              <PieChartIcon size={20} />
            </div>
            <p className="text-[8px] sm:text-xs font-black text-slate-300 uppercase tracking-[0.2em] mb-1">{t('monthlyCosting')}</p>
            <h3 className="text-2xl sm:text-4xl font-black text-slate-900 tabular-nums tracking-tight">
              {formatCurrency(monthlyTotal)}
            </h3>
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-1 p-6 sm:p-8 bg-slate-950 text-white rounded-[2rem] shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <p className="text-[8px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{t('totalExpenses')}</p>
            <h3 className="text-2xl sm:text-4xl font-black tabular-nums tracking-tight mb-4">
              {formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
            </h3>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-[8px] sm:text-[10px] uppercase tracking-widest">
              <TrendingUp size={12} />
              <span>Full Historical Record</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white sm:rounded-[4rem] px-4 py-8 sm:p-10 border-t sm:border border-slate-100 min-h-[600px] flex flex-col">
        {/* Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="flex p-1.5 bg-slate-50 rounded-2xl w-full lg:w-fit border border-slate-100">
            <button 
              onClick={() => setActiveTab('daily')}
              className={cn(
                "flex-1 lg:px-8 py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all",
                activeTab === 'daily' ? "bg-white text-slate-900 shadow-xl shadow-slate-200 border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Today
            </button>
            <button 
              onClick={() => setActiveTab('monthly')}
              className={cn(
                "flex-1 lg:px-8 py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all",
                activeTab === 'monthly' ? "bg-white text-slate-900 shadow-xl shadow-slate-200 border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              This Month
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="relative w-full sm:w-80 group">
              <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-950 transition-colors" />
              <input 
                type="text" 
                placeholder={t('search')}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-14 pr-6 py-4 text-sm font-bold text-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/5 focus:border-slate-950 outline-none transition-all placeholder:text-slate-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
               <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-950 rounded-full animate-spin" />
               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest animate-pulse">{t('syncing')}</p>
             </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
               <CreditCard size={64} className="text-slate-100 mb-6" />
               <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t('clearLedger')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map((expense) => {
                const category = CATEGORIES.find(c => c.id === expense.category) || CATEGORIES[4];
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={expense.id}
                    className="group bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", category.bg, category.color)}>
                        <category.icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-sm font-black text-slate-900 tracking-tight truncate">{t(expense.category)}</h4>
                          <span className="w-1 h-1 bg-slate-200 rounded-full shrink-0" />
                          <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest shrink-0">{formatDate(expense.date)}</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 line-clamp-1">{expense.description || "General expense record."}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-50">
                      <div className="text-left sm:text-right">
                        <p className="text-[15px] sm:text-xl font-black text-rose-600 tabular-nums">-{formatCurrency(expense.amount)}</p>
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">Debit Entry</p>
                      </div>
                      <button 
                        onClick={() => handleDelete(expense.id!)}
                        className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Summary */}
        {filteredExpenses.length > 0 && (
          <div className="mt-10 p-6 sm:p-8 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100">
                <Filter size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{activeTab === 'daily' ? 'Filtered Today' : 'Filtered Monthly'}</p>
                <p className="text-xs font-bold text-slate-500">Showing {filteredExpenses.length} transactions in this period.</p>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Period Total Expenditure</p>
              <h4 className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                {formatCurrency(totalFiltered)}
              </h4>
            </div>
          </div>
        )}
      </div>

      {/* Entry Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              className="relative w-full max-w-xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] overflow-hidden max-h-[95vh] flex flex-col"
            >
              <div className="p-6 sm:p-10 overflow-y-auto invisible-scrollbar">
                <div className="flex items-center justify-between mb-8 sm:mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
                      <Plus size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{t('addExpense')}</h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Financial Registry</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <MoreHorizontal size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">{t('expenseCategory')}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setExpenseForm({...expenseForm, category: cat.id})}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl border transition-all text-center",
                            expenseForm.category === cat.id 
                              ? "bg-slate-950 border-slate-950 text-white shadow-lg" 
                              : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300"
                          )}
                        >
                          <cat.icon size={16} className={expenseForm.category === cat.id ? "text-white" : cat.color} />
                          <span className="text-[8px] font-black uppercase tracking-widest truncate w-full">{t(cat.id)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">{t('expenseAmount')}</label>
                      <input 
                        type="number"
                        required
                        placeholder="0.00"
                        className="w-full h-12 sm:h-14 px-4 sm:px-6 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl font-black text-slate-900 outline-none focus:bg-white focus:border-slate-950 tabular-nums text-sm sm:text-base"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">{t('date')}</label>
                      <input 
                        type="date"
                        required
                        className="w-full h-12 sm:h-14 px-4 sm:px-6 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl font-black text-slate-900 outline-none focus:bg-white focus:border-slate-950 text-xs sm:text-base"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">{t('cause')}</label>
                    <textarea 
                      placeholder={t('expenseDescription')}
                      className="w-full min-h-[80px] sm:min-h-[100px] p-4 sm:p-6 bg-slate-50 border border-slate-100 rounded-2xl sm:rounded-[2rem] font-bold text-slate-800 outline-none focus:bg-white focus:border-slate-950 resize-none text-sm sm:text-base"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 h-14 sm:h-16 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400"
                    >
                      {t('cancel')}
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] h-14 sm:h-16 bg-slate-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200"
                    >
                      {t('save')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
