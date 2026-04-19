import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('shop.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    price REAL NOT NULL,
    stock INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    total_amount REAL NOT NULL,
    paid_amount REAL NOT NULL,
    status TEXT NOT NULL, -- 'Paid', 'Due'
    type TEXT NOT NULL, -- 'Invoice', 'Quotation', 'Purchase'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    order_id INTEGER,
    amount REAL NOT NULL,
    method TEXT DEFAULT 'Cash',
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  -- Add columns if they don't exist (for existing databases)
  PRAGMA table_info(payments);
`);

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  // API Routes
  app.get('/api/dashboard', (req, res) => {
    const totalSales = db.prepare("SELECT SUM(total_amount) as total FROM orders WHERE type = 'Invoice'").get() as any;
    const totalPurchase = db.prepare("SELECT SUM(total_amount) as total FROM orders WHERE type = 'Purchase'").get() as any;
    const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM customers").get() as any;
    const totalProducts = db.prepare("SELECT COUNT(*) as count FROM products").get() as any;
    const totalPaid = db.prepare("SELECT SUM(paid_amount) as total FROM orders").get() as any;
    const totalDue = db.prepare("SELECT SUM(total_amount - paid_amount) as total FROM orders").get() as any;

    res.json({
      sales: totalSales?.total || 0,
      purchase: totalPurchase?.total || 0,
      customers: totalCustomers?.count || 0,
      products: totalProducts?.count || 0,
      paid: totalPaid?.total || 0,
      due: totalDue?.total || 0
    });
  });

  // Products
  app.get('/api/products', (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
  });

  app.post('/api/products', (req, res) => {
    const { name, code, price, stock } = req.body;
    const info = db.prepare('INSERT INTO products (name, code, price, stock) VALUES (?, ?, ?, ?)').run(name, code, price, stock);
    res.json({ id: info.lastInsertRowid });
  });

  app.put('/api/products/:id', (req, res) => {
    const { name, code, price, stock } = req.body;
    db.prepare('UPDATE products SET name = ?, code = ?, price = ?, stock = ? WHERE id = ?').run(name, code, price, stock, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/products/:id', (req, res) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Customers
  app.get('/api/customers', (req, res) => {
    const customers = db.prepare('SELECT * FROM customers').all();
    res.json(customers);
  });

  app.post('/api/customers', (req, res) => {
    const { name, phone, address } = req.body;
    const info = db.prepare('INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)').run(name, phone, address);
    res.json({ id: info.lastInsertRowid });
  });

  app.put('/api/customers/:id', (req, res) => {
    const { name, phone, address } = req.body;
    db.prepare('UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?').run(name, phone, address, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/customers/:id', (req, res) => {
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Orders
  app.get('/api/orders', (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, c.name as customer_name 
      FROM orders o 
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY o.created_at DESC
    `).all();
    res.json(orders);
  });

  app.post('/api/orders', (req, res) => {
    const { customer_id, total_amount, paid_amount, status, type, items } = req.body;
    
    const transaction = db.transaction(() => {
      const info = db.prepare('INSERT INTO orders (customer_id, total_amount, paid_amount, status, type) VALUES (?, ?, ?, ?, ?)').run(customer_id, total_amount, paid_amount, status, type);
      const orderId = info.lastInsertRowid;

      for (const item of items) {
        db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)').run(orderId, item.product_id, item.quantity, item.price);
        
        // Update stock
        if (type === 'Invoice') {
          db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
        } else if (type === 'Purchase') {
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.product_id);
        }
      }
      return orderId;
    });

    const orderId = transaction();
    res.json({ id: orderId });
  });

  app.delete('/api/orders/:id', (req, res) => {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Due Management
  app.get('/api/dues', (req, res) => {
    const dues = db.prepare(`
      SELECT c.id, c.name, 
             SUM(o.total_amount) as total_amount, 
             SUM(o.paid_amount) as total_paid,
             SUM(o.total_amount - o.paid_amount) as remaining_balance
      FROM customers c
      JOIN orders o ON c.id = o.customer_id
      GROUP BY c.id
      HAVING remaining_balance > 0
    `).all();
    res.json(dues);
  });

  app.post('/api/payments', (req, res) => {
    const { customer_id, amount, method, date } = req.body;
    
    const transaction = db.transaction(() => {
      // Find orders with dues for this customer
      const ordersWithDues = db.prepare(`
        SELECT id, total_amount, paid_amount 
        FROM orders 
        WHERE customer_id = ? AND total_amount > paid_amount
        ORDER BY created_at ASC
      `).all() as any[];

      let remainingPayment = amount;
      for (const order of ordersWithDues) {
        if (remainingPayment <= 0) break;
        
        const due = order.total_amount - order.paid_amount;
        const paymentForThisOrder = Math.min(remainingPayment, due);
        
        db.prepare('UPDATE orders SET paid_amount = paid_amount + ?, status = CASE WHEN paid_amount + ? >= total_amount THEN "Paid" ELSE "Due" END WHERE id = ?')
          .run(paymentForThisOrder, paymentForThisOrder, order.id);
        
        db.prepare('INSERT INTO payments (customer_id, order_id, amount, method, payment_date) VALUES (?, ?, ?, ?, ?)').run(customer_id, order.id, paymentForThisOrder, method || 'Cash', date || new Date().toISOString());
        
        remainingPayment -= paymentForThisOrder;
      }
    });

    transaction();
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
