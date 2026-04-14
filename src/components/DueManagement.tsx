import React, { useState, useEffect } from 'react';
import { Search, CreditCard, User, Wallet, History, ArrowRight, X, DollarSign, Download } from 'lucide-react';
import { toast } from 'sonner';
import { DueRecord } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import * as XLSX from 'xlsx';

export default function DueManagement() {
  const [dues, setDues] = useState<DueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<DueRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  useEffect(() => {
    fetchDues();
  }, []);

  const fetchDues = async () => {
    try {
      const res = await fetch('/api/dues');
      const data = await res.json();
      setDues(data);
    } catch (error) {
      toast.error('Failed to fetch due records');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (paymentAmount <= 0) return toast.error('Please enter a valid amount');

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customer_id: selectedCustomer.id, 
          amount: paymentAmount 
        }),
      });
      if (res.ok) {
        toast.success('Payment recorded successfully');
        setIsModalOpen(false);
        setSelectedCustomer(null);
        setPaymentAmount(0);
        fetchDues();
      }
    } catch (error) {
      toast.error('Payment failed');
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(dues.map(d => ({
      'Customer Name': d.name,
      'Total Amount': d.total_amount,
      'Total Paid': d.total_paid,
      'Remaining Balance': d.remaining_balance
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dues');
    XLSX.writeFile(workbook, 'Due_Report.xlsx');
  };

  const filteredDues = dues.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Due Management</h1>
          <p className="text-gray-500">Track outstanding balances and record customer payments.</p>
        </div>
        <button 
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Download size={20} />
          <span>Export Report</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">Total Outstanding</p>
          <h3 className="text-2xl font-bold text-rose-600">
            {formatCurrency(dues.reduce((sum, d) => sum + d.remaining_balance, 0))}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">Customers with Dues</p>
          <h3 className="text-2xl font-bold text-gray-900">{dues.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-medium text-gray-500 mb-1">Average Due</p>
          <h3 className="text-2xl font-bold text-amber-600">
            {formatCurrency(dues.length > 0 ? dues.reduce((sum, d) => sum + d.remaining_balance, 0) / dues.length : 0)}
          </h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search customer name..." 
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table */}
          <table className="w-full text-left hidden md:table">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Total Billed</th>
                <th className="px-6 py-4">Total Paid</th>
                <th className="px-6 py-4">Remaining Balance</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">Loading records...</td>
                </tr>
              ) : filteredDues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">No outstanding dues found.</td>
                </tr>
              ) : filteredDues.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
                        {record.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{record.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{formatCurrency(record.total_amount)}</td>
                  <td className="px-6 py-4 text-emerald-600 font-medium">{formatCurrency(record.total_paid)}</td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-rose-600">{formatCurrency(record.remaining_balance)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => {
                        setSelectedCustomer(record);
                        setPaymentAmount(record.remaining_balance);
                        setIsModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-semibold text-sm hover:bg-blue-600 hover:text-white transition-all"
                    >
                      <Wallet size={16} />
                      Collect Payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="p-6 text-center text-gray-400">Loading records...</div>
            ) : filteredDues.length === 0 ? (
              <div className="p-6 text-center text-gray-400">No outstanding dues found.</div>
            ) : filteredDues.map((record) => (
              <div key={record.id} className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
                      {record.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-gray-900">{record.name}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedCustomer(record);
                      setPaymentAmount(record.remaining_balance);
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-blue-600 bg-blue-50 rounded-lg"
                  >
                    <Wallet size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Total Billed</p>
                    <p className="font-medium text-gray-900">{formatCurrency(record.total_amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Total Paid</p>
                    <p className="font-medium text-emerald-600">{formatCurrency(record.total_paid)}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-50 flex justify-between items-center">
                  <span className="text-gray-500 text-xs uppercase font-bold tracking-wider">Remaining Balance</span>
                  <span className="text-lg font-black text-rose-600">{formatCurrency(record.remaining_balance)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-lg">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Record Payment</h3>
                  <p className="text-xs text-gray-500">Update balance for {selectedCustomer.name}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePayment} className="p-6 space-y-6 overflow-y-auto">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-blue-700 font-medium">Current Due</span>
                  <span className="text-blue-900 font-bold">{formatCurrency(selectedCustomer.remaining_balance)}</span>
                </div>
                <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-500" 
                    style={{ width: `${(selectedCustomer.total_paid / selectedCustomer.total_amount) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Payment Amount</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    max={selectedCustomer.remaining_balance}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xl font-bold"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Enter the amount received from the customer.</p>
              </div>
            </form>
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePayment}
                className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
