/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  CreditCard, 
  Download,
  Menu,
  X,
  Store
} from 'lucide-react';
import { Toaster } from 'sonner';
import Dashboard from './components/Dashboard';
import OrderList from './components/OrderList';
import CustomerList from './components/CustomerList';
import ProductList from './components/ProductList';
import DueManagement from './components/DueManagement';
import { cn } from './lib/utils';

interface SidebarItemProps {
  to: string;
  icon: any;
  label: string;
  active: boolean;
  key?: string | number;
}

function SidebarItem({ to, icon: Icon, label, active }: SidebarItemProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
          : "text-gray-600 hover:bg-gray-100"
      )}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function Navigation() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/orders", icon: ShoppingCart, label: "Orders" },
    { to: "/customers", icon: Users, label: "Customers" },
    { to: "/products", icon: Package, label: "Products" },
    { to: "/dues", icon: CreditCard, label: "Due Management" },
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
          <Store size={28} />
          <span>SmartShop</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-6">
          <div className="hidden lg:flex items-center gap-2 text-blue-600 font-bold text-2xl mb-10">
            <Store size={32} />
            <span>SmartShop</span>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
              <SidebarItem 
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                active={location.pathname === item.to}
              />
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-gray-100">
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-sm font-semibold text-blue-900">Professional Edition</p>
              <p className="text-xs text-blue-700 mt-1">v1.0.0 Stable</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
        <Navigation />
        
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<OrderList />} />
              <Route path="/customers" element={<CustomerList />} />
              <Route path="/products" element={<ProductList />} />
              <Route path="/dues" element={<DueManagement />} />
            </Routes>
          </div>
        </main>
        
        <Toaster position="top-right" richColors />
      </div>
    </Router>
  );
}

