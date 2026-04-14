import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Trash2, ShoppingCart, User, Calendar, DollarSign, FileText, X, Printer, Download, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Order, Customer, Product, OrderItem } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New Order State
  const [newOrder, setNewOrder] = useState<{
    customer_id: number;
    type: 'Invoice' | 'Quotation' | 'Purchase';
    paid_amount: number;
    items: { product_id: number, quantity: number, price: number }[];
  }>({
    customer_id: 0,
    type: 'Invoice',
    paid_amount: 0,
    items: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, customersRes, productsRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/customers'),
        fetch('/api/products')
      ]);
      setOrders(await ordersRes.json());
      setCustomers(await customersRes.json());
      setProducts(await productsRes.json());
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return newOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOrder.customer_id === 0) return toast.error('Please select a customer');
    if (newOrder.items.length === 0) return toast.error('Please add at least one product');

    const total_amount = calculateTotal();
    const status = newOrder.paid_amount >= total_amount ? 'Paid' : 'Due';

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newOrder, total_amount, status }),
      });
      if (res.ok) {
        toast.success('Order created successfully');
        setIsModalOpen(false);
        setNewOrder({ customer_id: 0, type: 'Invoice', paid_amount: 0, items: [] });
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to create order');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Order deleted');
        fetchData();
      }
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const addItem = () => {
    setNewOrder({
      ...newOrder,
      items: [...newOrder.items, { product_id: 0, quantity: 1, price: 0 }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...newOrder.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        updatedItems[index].price = product.price;
      }
    }
    
    setNewOrder({ ...newOrder, items: updatedItems });
  };

  const removeItem = (index: number) => {
    setNewOrder({
      ...newOrder,
      items: newOrder.items.filter((_, i) => i !== index)
    });
  };

  const exportToPDF = (order: Order) => {
    const doc = new jsPDF() as any;
    doc.setFontSize(20);
    doc.text('SmartShop Invoice', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Order ID: #${order.id}`, 20, 40);
    doc.text(`Date: ${formatDate(order.created_at!)}`, 20, 45);
    doc.text(`Customer: ${order.customer_name}`, 20, 50);
    doc.text(`Type: ${order.type}`, 20, 55);
    
    // This is a simplified version, ideally we'd fetch order items for the specific order
    doc.autoTable({
      startY: 65,
      head: [['Product', 'Price', 'Qty', 'Total']],
      body: [
        ['Total Order Amount', '', '', formatCurrency(order.total_amount)],
        ['Paid Amount', '', '', formatCurrency(order.paid_amount)],
        ['Balance Due', '', '', formatCurrency(order.total_amount - order.paid_amount)],
      ],
    });
    
    doc.save(`Invoice_${order.id}.pdf`);
  };

  const filteredOrders = orders.filter(o => 
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) || 
    o.id?.toString().includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="text-gray-500">Track invoices, quotations, and purchase records.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>New Order</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by ID or customer..." 
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
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">Loading orders...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">No orders found.</td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-blue-600">#{order.id}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <span className="text-gray-900">{order.customer_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      {formatDate(order.created_at!)}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(order.total_amount)}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                      order.status === 'Paid' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => exportToPDF(order)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Print Invoice"
                      >
                        <Printer size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(order.id!)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="p-6 text-center text-gray-400">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-6 text-center text-gray-400">No orders found.</div>
            ) : filteredOrders.map((order) => (
              <div key={order.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-blue-600 font-bold text-sm">#{order.id}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    order.status === 'Paid' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-400" />
                    <span className="font-bold text-gray-900">{order.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => exportToPDF(order)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Printer size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(order.id!)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Calendar size={12} />
                    {formatDate(order.created_at!).split(',')[0]}
                  </div>
                  <span className="font-black text-gray-900">{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-lg">
                  <ShoppingCart size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Create New Order</h3>
                  <p className="text-xs text-gray-500">Fill in the details to generate a new transaction.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Select Customer</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                    value={newOrder.customer_id}
                    onChange={(e) => setNewOrder({...newOrder, customer_id: parseInt(e.target.value)})}
                  >
                    <option value={0}>Choose a customer...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Order Type</label>
                  <div className="flex gap-2">
                    {['Invoice', 'Quotation', 'Purchase'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewOrder({...newOrder, type: type as any})}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-sm font-semibold border transition-all",
                          newOrder.type === type 
                            ? "bg-blue-600 border-blue-600 text-white shadow-md" 
                            : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Package size={20} className="text-blue-600" />
                    Products & Items
                  </h4>
                  <button 
                    type="button"
                    onClick={addItem}
                    className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {newOrder.items.map((item, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-5">
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Product</label>
                          <select
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-sm"
                            value={item.product_id}
                            onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                          >
                            <option value={0}>Select product...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-3 md:col-span-6 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Price</label>
                            <input
                              required
                              type="number"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                              value={item.price}
                              onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Qty</label>
                            <input
                              required
                              type="number"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Total</label>
                            <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-900 truncate">
                              {formatCurrency(item.price * item.quantity)}
                            </div>
                          </div>
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                          <button 
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {newOrder.items.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
                      <Package size={48} className="mx-auto mb-3 opacity-20" />
                      <p>No products added to this order yet.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-900 text-white p-6 md:p-8 rounded-2xl shadow-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-center">
                  <div className="text-center sm:text-left">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">Grand Total</p>
                    <h2 className="text-3xl md:text-4xl font-black">{formatCurrency(calculateTotal())}</h2>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Amount Paid</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        required
                        type="number"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-xl font-bold"
                        value={newOrder.paid_amount}
                        onChange={(e) => setNewOrder({...newOrder, paid_amount: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div className="text-center sm:text-right sm:col-span-2 lg:col-span-1">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">Balance Due</p>
                    <h2 className={cn(
                      "text-2xl md:text-3xl font-black",
                      calculateTotal() - newOrder.paid_amount > 0 ? "text-rose-400" : "text-emerald-400"
                    )}>
                      {formatCurrency(Math.max(0, calculateTotal() - newOrder.paid_amount))}
                    </h2>
                  </div>
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-4 shrink-0">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-white transition-all shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                className="flex-[2] px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                Complete & Save Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
