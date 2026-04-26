import React, { useState, useEffect } from 'react';
import { Bell, X, Package, AlertTriangle } from 'lucide-react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Product } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function NotificationCenter() {
  const { user } = useAuth();
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/products`;
    // Use onSnapshot for real-time updates
    const q = query(collection(db, 'users', user.uid, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const lowStock = allProducts.filter(p => p.stock <= (p.stockAlert || 10));
      setLowStockProducts(lowStock);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = lowStockProducts.length;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 sm:p-3 bg-white border border-slate-100 rounded-xl sm:rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm group"
      >
        <Bell size={20} className={cn(unreadCount > 0 && "animate-tada text-amber-500")} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/10"
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-80 sm:w-96 bg-white rounded-[2rem] shadow-2xl border border-slate-100 z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Intelligence Alerts</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inventory Health</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-slate-900 p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">
                {lowStockProducts.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto">
                      <Package size={24} />
                    </div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">System Healthy</p>
                  </div>
                ) : (
                  lowStockProducts.map((p) => (
                    <div key={p.id} className="p-4 rounded-2xl bg-white border border-slate-100 flex items-start gap-4 hover:border-amber-200 transition-all group">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        p.stock === 0 ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-500"
                      )}>
                        {p.stock === 0 ? <X size={20} /> : <AlertTriangle size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-slate-900 text-xs truncate">{p.name}</p>
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest whitespace-nowrap",
                            p.stock === 0 ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                          )}>
                            {p.stock === 0 ? "Out of Stock" : "Low Stock"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.0">
                          Current: <span className="font-bold text-slate-600">{p.stock}</span> 
                          • 
                          Limit: <span className="font-bold text-slate-600">{p.stockAlert || 10}</span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {lowStockProducts.length > 0 && (
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">
                    Inventory optimization required
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
