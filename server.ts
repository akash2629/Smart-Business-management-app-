import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Resend } from 'resend';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

// Force project ID in environment to ensure Firestore SDK doesn't default to ambient project
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
process.env.GCP_PROJECT = firebaseConfig.projectId;

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminApp = admin.app();

// Correctly initialize Firestore with specific database ID if present
const firestore = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(firebaseConfig.firestoreDatabaseId)
  : getFirestore();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cors());

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
      await firestore.collection('shop_reset_sessions').doc(uid).set({
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
          code, // Return code to client for easier development testing
          message: 'Email service not configured (RESEND_API_KEY missing). Since this is a development preview, the code has been logged to the server console and included in this response for you to use.' 
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
    } catch (error: any) {
      console.error('Reset request error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message,
        code: error.code,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      });
    }
  });

  app.post('/api/confirm-reset', async (req, res) => {
    const { uid, code } = req.body;
    if (!uid || !code) {
      return res.status(400).json({ error: 'UID and code are required' });
    }

    try {
      const resetDoc = await firestore.collection('shop_reset_sessions').doc(uid).get();
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
      const collections = ['customers', 'products', 'payments']; // Orders handled separately to clean subcollections
      
      const batchSize = 500;

      // 1. Handle Orders and Order Items first
      const ordersSnapshot = await firestore.collection('orders').where('ownerId', '==', uid).get();
      for (const orderDoc of ordersSnapshot.docs) {
        const itemsSnapshot = await orderDoc.ref.collection('items').get();
        if (!itemsSnapshot.empty) {
          const itemBatch = firestore.batch();
          itemsSnapshot.docs.forEach(d => itemBatch.delete(d.ref));
          await itemBatch.commit();
        }
        await orderDoc.ref.delete();
      }
      
      // 2. Handle other collections
      for (const collName of collections) {
        const collectionRef = firestore.collection(collName);
        const query = collectionRef.where('ownerId', '==', uid).limit(batchSize);

        let snapshot = await query.get();
        while (!snapshot.empty) {
          const batch = firestore.batch();
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          snapshot = await query.get();
        }
      }

      // Clean up the reset code
      await firestore.collection('shop_reset_sessions').doc(uid).delete();
      
      // Clean up user settings (theme etc)
      await firestore.collection('user_settings').doc(uid).delete();

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
