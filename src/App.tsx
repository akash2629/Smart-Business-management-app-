/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  CreditCard, 
  Menu,
  X,
  Store,
  LogOut,
  User as UserIcon,
  ChevronRight,
  Clock
} from 'lucide-react';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import OrderList from './components/OrderList';
import CustomerList from './components/CustomerList';
import ProductList from './components/ProductList';
import DueManagement from './components/DueManagement';
import TransactionHistory from './components/TransactionHistory';
import { cn } from './lib/utils';
import { AuthProvider, useAuth } from './context/AuthContext';
import { signInWithGoogle, logOut } from './lib/firebase';

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
  active: boolean;
  onClick?: () => void;
  key?: string;
}

function NavItem({ to, icon: Icon, label, active, onClick }: NavItemProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all duration-300 whitespace-nowrap",
        active 
          ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <Icon size={18} className={cn("transition-transform duration-300", active ? "scale-110" : "group-hover:scale-110")} />
      <span className="font-bold text-sm tracking-tight">{label}</span>
    </Link>
  );
}

function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] p-4 text-slate-900 overflow-hidden relative">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-emerald-50 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4 opacity-60" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-blue-50 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 opacity-50" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "circOut" }}
        className="max-w-md w-full bg-white/80 backdrop-blur-xl border border-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-10 text-center space-y-10 relative z-10"
      >
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-slate-200">
            <Store size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-serif font-black tracking-tight mb-2">SmartShop</h1>
            <p className="text-slate-500 font-medium text-sm">Professional Shop Management Hub</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-4 bg-slate-900 py-4 px-6 rounded-2xl font-bold text-white hover:bg-slate-800 transition-all active:scale-[0.98] shadow-xl shadow-slate-200 group"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 shrink-0 bg-white p-0.5 rounded-full" />
            <span>Continue with Google</span>
          </button>
          <p className="text-[11px] text-slate-400 font-medium px-4">
            By signing in, you agree to secure your shop data with enterprise-grade cloud encryption.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function Navigation() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/orders", icon: ShoppingCart, label: "Orders" },
    { to: "/customers", icon: Users, label: "Customers" },
    { to: "/products", icon: Package, label: "Products" },
    { to: "/dues", icon: CreditCard, label: "Dues" },
    { to: "/history", icon: Clock, label: "Daily Record" },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-3 text-slate-900 font-serif font-black text-2xl tracking-tighter shrink-0 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-200">
              <Store size={22} />
            </div>
            <span className="hidden sm:inline">SmartShop</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-2">
            {navItems.map((item) => (
              <NavItem 
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                active={location.pathname === item.to}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="relative">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-black text-slate-900 leading-none">{user.displayName || 'User'}</p>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Enterprise Access</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button 
              onClick={() => logOut()}
              className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2.5 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200 transition-all hover:bg-slate-800"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            className="lg:hidden mt-4 bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden origin-top"
          >
            <div className="p-4 grid grid-cols-1 gap-2">
              {navItems.map((item) => (
                <NavItem 
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  active={location.pathname === item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Security Active</span>
              </div>
              <p className="text-[10px] font-black text-slate-900">v1.1.0 CE</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-1">Encrypted Access</p>
            <p className="text-sm font-bold text-slate-800 animate-pulse">Initializing Security...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFCFB] font-sans text-slate-900">
      <Navigation />
      
      <main className="flex-1 p-6 lg:p-12 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
              <Route path="/orders" element={<PageTransition><OrderList /></PageTransition>} />
              <Route path="/customers" element={<PageTransition><CustomerList /></PageTransition>} />
              <Route path="/products" element={<PageTransition><ProductList /></PageTransition>} />
              <Route path="/dues" element={<PageTransition><DueManagement /></PageTransition>} />
              <Route path="/history" element={<PageTransition><TransactionHistory /></PageTransition>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
      
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

