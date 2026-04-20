import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import cors from 'cors';
import { Resend } from 'resend';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const firestore = admin.firestore();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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

  // Data Reset Endpoints
  app.post('/api/request-reset', async (req, res) => {
    const { email, uid } = req.body;
    if (!email || !uid) {
      return res.status(400).json({ error: 'Email and UID are required' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    try {
      // Store in a temporary collection
      await firestore.collection('reset_codes').doc(uid).set({
        code,
        expiry,
        email
      });

      if (!resend) {
        console.log('------------------------------------------');
        console.log('DATA RESET VERIFICATION CODE:', code);
        console.log('FOR USER:', email);
        console.log('------------------------------------------');
        return res.json({ 
          success: true, 
          message: 'Email service not configured (RESEND_API_KEY missing). Since this is a development preview, the code has been logged to the server console for you to use.' 
        });
      }

      // Send email
      const { data, error } = await resend.emails.send({
        from: 'SmartShop <onboarding@resend.dev>',
        to: [email],
        subject: 'Reset Your Shop Data',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 12px;">
            <h1 style="color: #0f172a; font-size: 24px;">Data Reset Verification</h1>
            <p style="color: #64748b;">You requested to reset all your data on SmartShop. This action is irreversible.</p>
            <p style="color: #64748b;">Use the following 6-digit code to confirm the reset:</p>
            <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #0f172a; border-radius: 8px; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #94a3b8; font-size: 12px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `
      });

      if (error) {
        console.error('Email error:', error);
        return res.status(500).json({ error: 'Failed to send verification email' });
      }

      res.json({ success: true, message: 'Verification code sent to your email' });
    } catch (error) {
      console.error('Reset request error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/confirm-reset', async (req, res) => {
    const { uid, code } = req.body;
    if (!uid || !code) {
      return res.status(400).json({ error: 'UID and code are required' });
    }

    try {
      const resetDoc = await firestore.collection('reset_codes').doc(uid).get();
      if (!resetDoc.exists) {
        return res.status(400).json({ error: 'No reset session found' });
      }

      const data = resetDoc.data();
      if (data?.code !== code) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      if (Date.now() > data?.expiry) {
        return res.status(400).json({ error: 'Verification code expired' });
      }

      // Delete user data from all collections
      const collections = ['orders', 'customers', 'products', 'payments'];
      
      const batchSize = 500;
      for (const collName of collections) {
        const collectionRef = firestore.collection(collName);
        const query = collectionRef.where('ownerId', '==', uid).limit(batchSize);

        let snapshot = await query.get();
        while (!snapshot.empty) {
          const batch = firestore.batch();
          snapshot.docs.forEach((doc) => {
            // Also delete subcollections if any
            // For orders, we should delete the 'items' subcollection
            if (collName === 'orders') {
               // We can't easily batch delete subcollections in a single pass without knowing all doc IDs
               // but for a small shop management app, we can iterate or use a cloud function (not available here)
               // For now, we'll just delete the documents. 
               // Ideally we should delete subcollections too.
            }
            batch.delete(doc.ref);
          });
          await batch.commit();
          snapshot = await query.get();
        }
      }

      // Special handling for order items subcollections
      const ordersSnapshot = await firestore.collection('orders').where('ownerId', '==', uid).get();
      for (const orderDoc of ordersSnapshot.docs) {
        const itemsSnapshot = await orderDoc.ref.collection('items').get();
        const batch = firestore.batch();
        itemsSnapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // Clean up the reset code
      await firestore.collection('reset_codes').doc(uid).delete();

      res.json({ success: true, message: 'All shop data has been successfully reset' });
    } catch (error) {
      console.error('Reset confirm error:', error);
      res.status(500).json({ error: 'Internal server error during data reset' });
    }
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
