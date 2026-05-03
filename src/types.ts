export interface Product {
  id?: string;
  name: string;
  code: string;
  price: number;
  stock: number;
  buyPrice?: number;
  salePrice?: number;
  stockAlert?: number;
  images?: string[];
  ownerId?: string;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  address: string;
  ownerId?: string;
}

export interface Supplier {
  id?: string;
  name: string;
  phone: string;
  shopName: string;
  shopAddress: string;
  email?: string;
  ownerId?: string;
}

export interface Order {
  id?: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  totalAmount: number;
  paidAmount: number;
  totalDiscount?: number;
  status: 'Paid' | 'Due';
  type: 'Invoice' | 'Quotation' | 'Purchase' | 'Opening Balance';
  createdAt?: string;
  ownerId?: string;
}

export interface OrderItem {
  id?: string;
  orderId?: string;
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
  discount?: number;
  ownerId?: string;
}

export interface Payment {
  id?: string;
  customerId: string;
  orderId: string;
  amount: number;
  method: string;
  paymentDate: string;
  ownerId?: string;
}

export interface Purchase {
  id?: string;
  supplierId: string;
  supplierName?: string;
  totalAmount: number;
  paidAmount: number;
  status: 'Paid' | 'Due';
  note?: string;
  createdAt?: string;
  ownerId?: string;
}

export interface DashboardData {
  sales: number;
  purchase: number;
  customers: number;
  products: number;
  paid: number;
  due: number;
  todaySales: number;
  todayDue: number;
  monthlySales: number;
  monthlyDue: number;
  totalExpenses: number;
  todayExpenses: number;
  monthlyExpenses: number;
}

export interface DueRecord {
  id: string;
  name: string;
  total_amount: number;
  total_paid: number;
  remaining_balance: number;
}

export interface Expense {
  id?: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  ownerId?: string;
}
