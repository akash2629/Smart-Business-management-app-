import React, { useState } from 'react';
import { ShieldAlert, Mail, Key, RefreshCcw, AlertTriangle, CheckCircle2, ArrowRight, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Settings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState<'initial' | 'verification' | 'success'>('initial');
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const requestReset = async () => {
    if (!user?.email || !user?.uid) return;
    setLoading(true);
    try {
      const response = await fetch('/api/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, uid: user.uid })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to request reset');
      
      if (result.message.includes('logged to the server console')) {
        toast.info('API Key missing: The 6-digit code has been logged to the server logs for testing.', { duration: 10000 });
      } else {
        toast.success('Verification code sent to your email');
      }
      setStep('verification');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || verificationCode.length !== 6) return;
    setLoading(true);
    try {
      const response = await fetch('/api/confirm-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, code: verificationCode })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to confirm reset');
      
      toast.success('All data has been reset');
      setStep('success');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            System Configuration
          </div>
          <h1 className="text-5xl font-serif font-black text-slate-900 tracking-tighter">{t('settings')}</h1>
          <p className="text-slate-500 font-medium tracking-tight">Manage your shop instance and global security settings.</p>
        </div>
      </header>

      <div className="max-w-2xl">
        <AnimatePresence mode="wait">
          {step === 'initial' && (
            <motion.div 
              key="initial"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="premium-card p-10 space-y-8 overflow-hidden relative"
            >
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center shadow-xl shadow-rose-100/50">
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Critical Action: Data Reset</h3>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">High-Risk Operation</p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-start gap-4">
                <div className="p-2 bg-white rounded-xl shadow-sm text-amber-500 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">This action is permanent.</p>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">Resetting your data will permanently delete all customers, products, orders, and payment records associated with this account. This cannot be undone.</p>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Security Protocol</p>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black">1</div>
                  <span>Verification code sent to {user?.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black">2</div>
                  <span>Confirm with 6-digit administrative key</span>
                </div>
              </div>

              <button 
                onClick={requestReset}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-rose-600 py-5 rounded-[2rem] font-black text-xs text-white uppercase tracking-[0.2em] hover:bg-rose-700 transition-all shadow-2xl shadow-rose-100 disabled:opacity-50 group"
              >
                {loading ? <RefreshCcw size={16} className="animate-spin" /> : <ShieldAlert size={16} className="group-hover:animate-pulse" />}
                <span>Initiate Full Data Reset</span>
              </button>
            </motion.div>
          )}

          {step === 'verification' && (
            <motion.div 
              key="verification"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="premium-card p-10 space-y-8"
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-200">
                  <Mail size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight text-balance">Verify Reset Key</h3>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Check Your Email</p>
                </div>
              </div>

              <p className="text-sm font-medium text-slate-500 leading-relaxed px-2">An encrypted 6-digit security code has been dispatched to <span className="font-bold text-slate-900">{user?.email}</span>. Enter it below to proceed.</p>

              <form onSubmit={confirmReset} className="space-y-8">
                <div>
                  <label className="detail-label">Security Key</label>
                  <div className="relative">
                    <Key size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input 
                      required
                      type="text" 
                      maxLength={6}
                      placeholder="000 000"
                      className="w-full pl-14 pr-6 py-5 rounded-[2rem] border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-black text-2xl text-slate-900 transition-all font-mono tracking-[0.5em] text-center"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setStep('initial')}
                    className="flex-1 py-5 rounded-[2rem] border border-slate-100 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    type="submit"
                    disabled={loading || verificationCode.length !== 6}
                    className="flex-[2] flex items-center justify-center gap-3 bg-slate-900 py-5 rounded-[2rem] font-black text-xs text-white uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 disabled:opacity-50"
                  >
                    {loading ? <RefreshCcw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    <span>Confirm Destruction</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="premium-card p-12 text-center space-y-8"
            >
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-50 animate-bounce">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-bold text-slate-900 tracking-tighter">Instance Cleared</h3>
                <p className="text-slate-500 font-medium text-balance">All shop data has been permanently removed from the cloud infrastructure. Your shop is now a clean slate.</p>
              </div>
              <button 
                onClick={() => window.location.href = '/'}
                className="inline-flex items-center gap-3 bg-slate-900 px-10 py-5 rounded-[2rem] font-black text-xs text-white uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-95"
              >
                Go to Dashboard
                <ArrowRight size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
