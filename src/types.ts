export interface Product {
  id?: number;
  name: string;
  code: string;
  price: number;
  stock: number;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  address: string;
}

export interface Order {
  id?: number;
  customer_id: number;
  customer_name?: string;
  total_amount: number;
  paid_amount: number;
  status: 'Paid' | 'Due';
  type: 'Invoice' | 'Quotation' | 'Purchase';
  created_at?: string;
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id: number;
  quantity: number;
  price: number;
}

export interface DashboardData {
  sales: number;
  purchase: number;
  customers: number;
  products: number;
  paid: number;
  due: number;
}

export interface DueRecord {
  id: number;
  name: string;
  total_amount: number;
  total_paid: number;
  remaining_balance: number;
}
