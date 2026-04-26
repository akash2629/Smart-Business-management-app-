import React, { useState, useEffect, useRef } from 'react';
import { Search, CreditCard, User, Wallet, History, ArrowRight, X, Download, Plus, Trash2, FileText } from 'lucide-react';
import { BdtSign } from './Icons';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { DueRecord, Order } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  writeBatch,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function DueManagement() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [dues, setDues] = useState<DueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<DueRecord | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [historyPayments, setHistoryPayments] = useState<any[]>([]);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [manualDue, setManualDue] = useState({ 
    customerId: '', 
    amount: 0, 
    note: '',
    images: [] as string[],
    isNewCustomer: false,
    newCustomer: { name: '', phone: '', address: '' }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchDues();
    }
  }, [user]);

  const fetchDues = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ordersQ = query(collection(db, 'users', user.uid, 'orders'), where('status', '==', 'Due'));
      const customersQ = collection(db, 'users', user.uid, 'customers');
      
      const [ordersSnap, customersSnap] = await Promise.all([
        getDocs(ordersQ),
        getDocs(customersQ)
      ]);

      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const customers = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      setCustomers(customers);

      const aggregatedDues: DueRecord[] = customers.map(customer => {
        const customerOrders = orders.filter(o => o.customerId === customer.id);
        const totalAmount = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalPaid = customerOrders.reduce((sum, o) => sum + o.paidAmount, 0);
        const remainingBalance = totalAmount - totalPaid;

        return {
          id: customer.id,
          name: customer.name,
          total_amount: totalAmount,
          total_paid: totalPaid,
          remaining_balance: remainingBalance
        };
      }).filter(d => d.remaining_balance > 0);

      setDues(aggregatedDues);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch due records');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCustomer) return;
    if (paymentAmount <= 0) return toast.error('Please enter a valid amount');

    try {
      // Simplified query to avoid composite index requirements
      const ordersQ = query(
        collection(db, 'users', user.uid, 'orders'), 
        where('customerId', '==', selectedCustomer.id),
        where('status', '==', 'Due')
      );
      
      const ordersSnap = await getDocs(ordersQ);
      // Sort client-side
      const ordersWithDues = ordersSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      ordersWithDues.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeA - timeB;
      });

      const batch = writeBatch(db);
      let remainingPayment = paymentAmount;

      for (const order of ordersWithDues) {
        if (remainingPayment <= 0) break;
        
        const due = order.totalAmount - order.paidAmount;
        const paymentForThisOrder = Math.min(remainingPayment, due);
        const newPaidAmount = order.paidAmount + paymentForThisOrder;
        
        const orderRef = doc(db, 'users', user.uid, 'orders', order.id);
        batch.update(orderRef, {
          paidAmount: newPaidAmount,
          status: newPaidAmount >= order.totalAmount ? 'Paid' : 'Due'
        });

        const paymentRef = doc(collection(db, 'users', user.uid, 'payments'));
        batch.set(paymentRef, {
          customerId: selectedCustomer.id,
          orderId: order.id,
          amount: paymentForThisOrder,
          method: paymentMethod,
          paymentDate: paymentDate,
          ownerId: user.uid,
          createdAt: serverTimestamp()
        });
        
        remainingPayment -= paymentForThisOrder;
      }

      await batch.commit();

      toast.success('Payment recorded successfully');
      setIsModalOpen(false);
      setSelectedCustomer(null);
      setPaymentAmount(0);
      setPaymentMethod('Cash');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      fetchDues();
    } catch (error) {
      console.error(error);
      toast.error('Payment failed');
    }
  };

  const exportToExcel = async () => {
    if (!user) return;
    toast.info('Synthesizing comprehensive financial report...');
    
    try {
      // Fetch all relevant data for a deep audit
      const [ordersSnap, paymentsSnap, customersSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'orders')),
        getDocs(collection(db, 'users', user.uid, 'payments')),
        getDocs(collection(db, 'users', user.uid, 'customers'))
      ]);

      const allOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const allPayments = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const allCustomers = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      // Export ALL customers, not just those with current dues, to provide a full report
      const worksheetData = allCustomers.map(customer => {
        const customerOrders = allOrders.filter(o => o.customerId === customer.id);
        const customerPayments = allPayments
          .filter(p => p.customerId === customer.id)
          .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

        const totalAmount = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalDue = totalAmount - totalPaid;
        
        // Extract chronological buy dates
        const buyDates = customerOrders
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateA - dateB;
          })
          .map(o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toLocaleDateString() : 'N/A')
          .filter((v, i, a) => a.indexOf(v) === i) // Unique dates
          .join(', ');

        const paidDates = customerPayments
          .map(p => p.paymentDate)
          .join(', ');

        const paidAmounts = customerPayments
          .map(p => p.amount)
          .join(', ');

        return {
          'Customer Name': customer.name,
          'Mobile Number': customer.phone || 'N/A',
          'Address': customer.address || 'N/A',
          'Product Buy Date': buyDates || 'No purchases',
          'Date Wise Due Paid Date': paidDates || 'No payments',
          'Paid Money': paidAmounts || '0',
          'Total Paid': totalPaid,
          'Total Due': totalDue
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      
      // Add column widths for better readability
      const wscols = [
        { wch: 25 }, // Customer Name
        { wch: 15 }, // Mobile Number
        { wch: 30 }, // Address
        { wch: 30 }, // Product Buy Date
        { wch: 30 }, // Date Wise Due Paid Date
        { wch: 20 }, // Paid Money
        { wch: 15 }, // Total Paid
        { wch: 15 }, // Total Due
      ];
      worksheet['!cols'] = wscols;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer_Due_Report');
      XLSX.writeFile(workbook, `Customer_Due_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Report exported successfully');
    } catch (error) {
      console.error(error);
      toast.error('Audit synthesis failed');
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Financial Due Summary Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });
    
    // Summary Stats
    const totalOutstanding = dues.reduce((sum, d) => sum + d.remaining_balance, 0);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Outstanding: ${formatCurrency(totalOutstanding)}`, 14, 40);
    doc.text(`Total Debtor Profile Count: ${dues.length}`, 14, 46);

    // Table
    autoTable(doc, {
      startY: 55,
      head: [['Customer Identity', 'Billed Total', 'Principal Paid', 'Residual Balance', 'Status']],
      body: dues.map(d => [
        d.name,
        formatCurrency(d.total_amount),
        formatCurrency(d.total_paid),
        formatCurrency(d.remaining_balance),
        `${Math.round((d.total_paid / d.total_amount) * 100)}% Recovered`
      ]),
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 10, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        3: { fontStyle: 'bold', textColor: [225, 29, 72] } // Residual Balance in rose-600 mostly
      },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Due_Management_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Professional PDF report generated');
  };

  const toBase64 = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.5)); // Low quality for PDF size
      };
      img.onerror = () => resolve('');
      img.src = url;
    });
  };

  const exportCustomerDetailedPDF = async (record: DueRecord) => {
    if (!user) return;
    toast.info(`Generating deep audit for ${record.name}...`);
    
    try {
      const customer = customers.find(c => c.id === record.id);
      
      const pQ = query(collection(db, 'users', user.uid, 'payments'), where('customerId', '==', record.id));
      const oQ = query(collection(db, 'users', user.uid, 'orders'), where('customerId', '==', record.id));

      const [pSnap, oSnap] = await Promise.all([getDocs(pQ), getDocs(oQ)]);
      const historyPayments = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      const historyOrders = oSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      const doc = new jsPDF() as any;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Branding Header
      doc.setFontSize(24);
      doc.setTextColor(15, 23, 42);
      doc.text('Customer Detailed Audit Report', pageWidth / 2, 25, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Inventory & Ledger Management System', pageWidth / 2, 32, { align: 'center' });
      
      // Customer Info Card
      doc.setDrawColor(241, 245, 249);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 45, pageWidth - 28, 45, 3, 3, 'FD');
      
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(record.name, 22, 55);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Mobile Number: ${customer?.phone || 'Not Provided'}`, 22, 65);
      doc.text(`Address: ${customer?.address || 'Not Provided'}`, 22, 72);
      doc.text(`Order Count: ${historyOrders.length} entries`, 22, 79);
      doc.text(`Payment Count: ${historyPayments.length} entries`, 22, 86);
      
      // Financial Summary Box on Right
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageWidth - 85, 50, 65, 35, 2, 2, 'FD');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(`Total Due:`, pageWidth - 80, 58);
      doc.text(formatCurrency(record.remaining_balance), pageWidth - 80, 64);
      
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text(`Total Paid:`, pageWidth - 80, 74);
      doc.text(formatCurrency(record.total_paid), pageWidth - 80, 80);

      // Asset Acquisition Table (Billing)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('PRODUCT BILLING & ENTRIES', 14, 105);
      
      autoTable(doc, {
        startY: 110,
        head: [['Entry Date', 'Type', 'Specific Details / Note', 'Amount', 'Status']],
        body: historyOrders.map((o: any) => [
          o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toLocaleDateString() : 'Manual Legacy',
          o.type || 'Order',
          o.note || 'No additional notes provided',
          formatCurrency(o.totalAmount),
          { content: o.status, styles: { textColor: o.status === 'Paid' ? [5, 150, 105] : [225, 29, 72], fontStyle: 'bold' } }
        ]),
        headStyles: { fillColor: [15, 23, 42], fontSize: 9 },
        bodyStyles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 14, right: 14 }
      });

      // Settlement History Table (Payments)
      let finalY = (doc as any).lastAutoTable.finalY + 15;
      
      // Page break check for Payment History table
      if (finalY > pageHeight - 40) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('PAYMENT HISTORY & SETTLEMENTS', 14, finalY);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Payment Date', 'Method', 'Reference ID', 'Amount Paid']],
        body: historyPayments.map((p: any) => [
          p.paymentDate || 'N/A',
          p.method || 'Cash',
          p.id.slice(0, 12).toUpperCase(),
          formatCurrency(p.amount)
        ]),
        headStyles: { fillColor: [5, 150, 105], fontSize: 9 },
        bodyStyles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        margin: { left: 14, right: 14 }
      });

      // Visual Evidence Section (Images) - LARGE SIZE
      const imagesToProcess: {url: string, orderId: string, date: string, note?: string}[] = [];
      historyOrders.forEach((o: any) => {
        if (o.images && Array.isArray(o.images)) {
          o.images.forEach((img: string) => {
            imagesToProcess.push({
              url: img,
              orderId: o.id.slice(-6),
              date: o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toLocaleDateString() : 'N/A',
              note: o.note
            });
          });
        }
      });

      if (imagesToProcess.length > 0) {
        for (let i = 0; i < imagesToProcess.length; i++) {
          doc.addPage();
          
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(`VISUAL EVIDENCE (ENTRY PHOTO ${i + 1})`, pageWidth / 2, 20, { align: 'center' });
          
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(`Linked Entry ID: #${imagesToProcess[i].orderId} | Date: ${imagesToProcess[i].date}`, pageWidth / 2, 28, { align: 'center' });
          
          if (imagesToProcess[i].note) {
            doc.text(`Entry Note: ${imagesToProcess[i].note}`, pageWidth / 2, 34, { align: 'center', maxWidth: pageWidth - 40 });
          }

          const imgData = await toBase64(imagesToProcess[i].url);
          if (imgData) {
            // User requested 80% size
            const imgWidth = pageWidth * 0.8;
            const imgHeight = pageHeight * 0.5; // Adjusted height for proportion and info text
            const xOffset = (pageWidth - imgWidth) / 2;
            const yOffset = 45;
            
            // Try to maintain aspect ratio if possible using jspdf's addImage options
            // But for "80% size" strictly, we follow the requested scale
            doc.addImage(imgData, 'JPEG', xOffset, yOffset, imgWidth, imgHeight, undefined, 'FAST');
            
            // Footer on image page
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text('This visual evidence is captured at the time of manual entry for billing verification.', pageWidth / 2, yOffset + imgHeight + 15, { align: 'center' });
          }
        }
      }

      const fileName = `Audit_${record.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      toast.success('Detailed customer audit exported');
    } catch (error) {
      console.error(error);
      toast.error('Failed to synthesize detailed PDF');
    }
  };


  const viewCustomerXlsxPreview = async (record: DueRecord) => {
    if (!user) return;
    setLoading(true);
    setSelectedCustomer(record);
    try {
      const pQ = query(collection(db, 'users', user.uid, 'payments'), where('customerId', '==', record.id));
      const oQ = query(collection(db, 'users', user.uid, 'orders'), where('customerId', '==', record.id));

      const [pSnap, oSnap] = await Promise.all([getDocs(pQ), getDocs(oQ)]);
      setHistoryPayments(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      setHistoryOrders(oSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      setIsPreviewModalOpen(true);
    } catch (error) {
      toast.error('Synthesis failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (record: DueRecord) => {
    if (!user) return;
    setSelectedCustomer(record);
    try {
      // Simplified queries to avoid composite index requirements
      const pQ = query(
        collection(db, 'users', user.uid, 'payments'),
        where('customerId', '==', record.id)
      );
      
      const oQ = query(
        collection(db, 'users', user.uid, 'orders'),
        where('customerId', '==', record.id),
        where('status', '==', 'Due')
      );

      const [pSnap, oSnap] = await Promise.all([
        getDocs(pQ),
        getDocs(oQ)
      ]);

      const historyPayments = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const historyOrders = oSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Sort client-side
      historyPayments.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      historyOrders.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setHistoryPayments(historyPayments);
      setHistoryOrders(historyOrders);
      setIsHistoryModalOpen(true);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch financial history');
    }
  };

  const deleteSourceOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this bill? This will remove the debt.') || !user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'orders', orderId));
      toast.success('Bill Deleted');
      if (selectedCustomer) fetchHistory(selectedCustomer);
      fetchDues();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const getPayloadSize = (data: any) => {
    return JSON.stringify(data).length;
  };

  const [isSaving, setIsSaving] = useState(false);

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 480; // Small size for Firestore limits
          const MAX_HEIGHT = 480;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.4)); // Low quality for bulk upload
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    const newImages = [...(manualDue.images || [])];

    try {
      for (let i = 0; i < files.length; i++) {
        if (newImages.length >= 6) break;
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large`);
          continue;
        }
        const compressed = await compressImage(file);
        newImages.push(compressed);
      }
      setManualDue({ ...manualDue, images: newImages });
      toast.success('Photos added');
    } catch (error) {
      toast.error('Could not save photos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...(manualDue.images || [])];
    newImages.splice(index, 1);
    setManualDue({ ...manualDue, images: newImages });
  };

  const handleManualDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || manualDue.amount <= 0 || isSaving) return;

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      let finalCustomerId = manualDue.customerId;
      let finalCustomerName = '';

      if (manualDue.isNewCustomer) {
        if (!manualDue.newCustomer.name) {
          setIsSaving(false);
          return toast.error('Add customer name');
        }
        
        const customerRef = doc(collection(db, 'users', user.uid, 'customers'));
        batch.set(customerRef, {
          ...manualDue.newCustomer,
          ownerId: user.uid,
          createdAt: serverTimestamp()
        });
        finalCustomerId = customerRef.id;
        finalCustomerName = manualDue.newCustomer.name;
      } else {
        if (!manualDue.customerId) {
          setIsSaving(false);
          return toast.error('Choose a customer');
        }
        const customer = customers.find(c => c.id === manualDue.customerId);
        finalCustomerName = customer?.name || 'Customer';
      }

      const payloadSize = getPayloadSize(manualDue);
      if (payloadSize > 800000) {
        setIsSaving(false);
        return toast.error('Too many photos. Try removing some.');
      }

      const orderRef = doc(collection(db, 'users', user.uid, 'orders'));
      batch.set(orderRef, {
        ownerId: user.uid,
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        totalAmount: manualDue.amount,
        paidAmount: 0,
        status: 'Due',
        type: 'Entry',
        note: manualDue.note,
        images: manualDue.images || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      toast.success('Bill Saved');
      setIsManualModalOpen(false);
      setManualDue({ 
        customerId: '', 
        amount: 0, 
        note: '', 
        images: [], 
        isNewCustomer: false, 
        newCustomer: { name: '', phone: '', address: '' } 
      });
      fetchDues();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredDues = dues.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-0 sm:space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 p-4 sm:p-0 bg-white sm:bg-transparent border-b border-slate-100 sm:border-none sticky top-0 z-40">
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-slate-200"></div>
            {t('dueRegistry')}
          </div>
          <h1 className="text-sm sm:text-5xl font-serif font-black tracking-tighter leading-tight">{t('dueManagement')}</h1>
          <p className="text-slate-500 font-medium tracking-tight text-xs sm:text-base hidden sm:block">{t('trackOutstanding')}</p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-4">
          <button 
            onClick={exportToPDF}
            className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-rose-100 text-rose-700 font-bold text-[10px] sm:text-base bg-white hover:bg-rose-50 transition-all shadow-sm"
          >
            <FileText size={16} className="sm:w-5 sm:h-5" />
            <span className="sm:inline">{t('exportPDF')}</span>
          </button>
          <button 
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-900 font-bold text-white text-[10px] sm:text-base hover:opacity-90 transition-all shadow-lg active:scale-95 col-span-2 sm:col-auto"
          >
            <Plus size={16} className="sm:w-5 sm:h-5" />
            <span>{t('manualEntry')}</span>
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-emerald-100 text-emerald-700 font-bold text-[10px] sm:text-base bg-white hover:bg-emerald-50 transition-all shadow-sm col-span-2 sm:col-auto"
          >
            <Download size={16} className="sm:w-5 sm:h-5" />
            <span>{t('exportExcel')}</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-0 sm:gap-8 border-b border-slate-100 sm:border-none">
        <div className="bg-rose-50/10 sm:premium-card p-5 sm:p-8 border-r sm:border-r-0 border-slate-100 sm:border-rose-100 group">
          <p className="detail-label text-rose-500 text-[8px] sm:text-[10px]">{t('due')}</p>
          <h3 className="text-lg sm:text-3xl font-black text-rose-600 tracking-tighter group-hover:scale-105 transition-transform duration-500 tabular-nums">
            {formatCurrency(dues.reduce((sum, d) => sum + d.remaining_balance, 0))}
          </h3>
        </div>
        <div className="bg-white sm:premium-card p-5 sm:p-8 sm:bg-slate-900 sm:text-white">
          <p className="detail-label text-slate-400 sm:text-white/40 text-[8px] sm:text-[10px]">{t('customers')}</p>
          <h3 className="text-lg sm:text-3xl font-bold text-slate-900 sm:text-white tracking-tight">{dues.length} <span className="hidden sm:inline text-white/40">{t('profiles')}</span></h3>
        </div>
        <div className="bg-white sm:premium-card p-5 sm:p-8 col-span-2 lg:col-span-1 border-t border-slate-100 sm:border-t-0 sm:border-amber-100 bg-amber-50/5">
          <p className="detail-label text-amber-500 text-[8px] sm:text-[10px]">{t('averageRisk')}</p>
          <h3 className="text-lg sm:text-3xl font-bold text-amber-600 tracking-tight tabular-nums">
            {formatCurrency(dues.length > 0 ? dues.reduce((sum, d) => sum + d.remaining_balance, 0) / dues.length : 0)}
          </h3>
        </div>
      </div>

      <div className="bg-white sm:premium-card border-b border-slate-100 sm:border-none">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/20">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder={t('search')} 
              className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-white focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all font-bold text-[10px] sm:text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table */}
          <table className="w-full text-left hidden md:table">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="data-grid-header">{t('customer')}</th>
                <th className="data-grid-header">{t('total')}</th>
                <th className="data-grid-header">{t('paid')}</th>
                <th className="data-grid-header">{t('due')}</th>
                <th className="data-grid-header">{t('status')}</th>
                <th className="data-grid-header text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse">Syncing Ledger...</td>
                </tr>
              ) : filteredDues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-medium">No outstanding records identified.</td>
                </tr>
              ) : filteredDues.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 font-black text-lg border border-amber-100 shadow-sm">
                        {record.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-900 tracking-tight">{record.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-500 font-medium text-sm tabular-nums">{formatCurrency(record.total_amount)}</td>
                  <td className="px-6 py-5 text-emerald-600 font-bold text-sm tabular-nums">{formatCurrency(record.total_paid)}</td>
                  <td className="px-6 py-5">
                    <span className="font-black text-rose-600 tabular-nums">{formatCurrency(record.remaining_balance)}</span>
                  </td>
                  <td className="px-6 py-5 min-w-[160px]">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span>{Math.round((record.total_paid / record.total_amount) * 100)}% Recovered</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-50">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(record.total_paid / record.total_amount) * 100}%` }}
                          transition={{ duration: 1, ease: "circOut" }}
                          className="bg-emerald-500 h-full shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
                      <span>Actions</span>
                      <div className="w-px h-4 bg-slate-100 mx-2" />
                      <button 
                        onClick={() => viewCustomerXlsxPreview(record)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition-all"
                        title="Spreadsheet Preview"
                      >
                        <Search size={16} />
                      </button>
                      <button 
                        onClick={() => exportCustomerDetailedPDF(record)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-xl transition-all"
                        title="Download Deep Audit PDF"
                      >
                        <FileText size={16} />
                      </button>
                      <button 
                        onClick={() => fetchHistory(record)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                        title="History"
                      >
                        <History size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedCustomer(record);
                          setPaymentAmount(record.remaining_balance);
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                      >
                        <Wallet size={14} />
                        {t('paid')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Detailed Flow (No Cards) */}
          <div className="md:hidden divide-y divide-slate-100 bg-white">
            {loading ? (
              <div className="p-8 text-center text-slate-300 font-bold uppercase tracking-widest animate-pulse text-[10px]">Loading...</div>
            ) : filteredDues.length === 0 ? (
              <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No Dues Found</div>
            ) : filteredDues.map((record) => (
              <div key={record.id} className="p-5 space-y-4 hover:bg-slate-50/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 font-black text-lg border border-amber-100 shadow-sm">
                      {record.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-[14px] tracking-tight">{record.name}</p>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mt-1">Outstanding Liability</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => viewCustomerXlsxPreview(record)}
                      className="p-2 sm:p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-emerald-500 transition-colors border border-slate-100"
                    >
                      <Search size={16} />
                    </button>
                    <button 
                      onClick={() => fetchHistory(record)}
                      className="p-2 sm:p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-colors border border-slate-100"
                    >
                      <History size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedCustomer(record);
                        setPaymentAmount(record.remaining_balance);
                        setIsModalOpen(true);
                      }}
                      className="p-2 sm:p-2.5 bg-slate-900 rounded-xl text-white shadow-lg active:scale-95 transition-all"
                    >
                      <Wallet size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Recovered Rate</label>
                    <p className="font-bold text-slate-900 text-xs tabular-nums">{Math.round((record.total_paid / record.total_amount) * 100)}%</p>
                  </div>
                  <div className="text-right">
                    <label className="block text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Residual Balance</label>
                    <p className="font-black text-rose-600 text-sm tabular-nums">{formatCurrency(record.remaining_balance)}</p>
                  </div>
                </div>

                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-50 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(record.total_paid / record.total_amount) * 100}%` }}
                    transition={{ duration: 1 }}
                    className="bg-emerald-500 h-full" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {isModalOpen && selectedCustomer && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-none sm:rounded-[3rem] w-full max-w-lg shadow-2xl relative z-10 h-full sm:h-auto sm:max-h-[90vh] flex flex-col"
            >
              <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white sm:bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-xl sm:rounded-3xl flex items-center justify-center shadow-xl shadow-slate-200">
                    <CreditCard size={20} className="sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-2xl font-bold text-slate-900 tracking-tight">{t('paid')}</h3>
                    <p className="text-[8px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 sm:mt-1">{selectedCustomer.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={18} className="sm:w-6 sm:h-6" />
                </button>
              </div>
              <form onSubmit={handlePayment} className="p-4 sm:p-10 space-y-6 sm:space-y-10 overflow-y-auto flex-1 pb-20 sm:pb-10">
                <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl relative overflow-hidden group">
                  <div className="relative z-10 flex justify-between items-center mb-4 sm:mb-6">
                    <div className="space-y-1">
                      <p className="text-[8px] sm:text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{t('due')}</p>
                      <p className="text-2xl sm:text-4xl font-black tabular-nums tracking-tighter">{formatCurrency(selectedCustomer.remaining_balance)}</p>
                    </div>
                  </div>
                  <div className="relative z-10 space-y-2 sm:space-y-3">
                    <div className="flex justify-between text-[8px] sm:text-[10px] font-black text-white/40 uppercase tracking-widest">
                      <span>{t('progress')}</span>
                      <span>{Math.round((selectedCustomer.total_paid / selectedCustomer.total_amount) * 100)}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 sm:h-3 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-1000" 
                        style={{ width: `${selectedCustomer.total_amount > 0 ? (selectedCustomer.total_paid / selectedCustomer.total_amount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6 sm:space-y-8">
                  <div>
                    <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('paid')}</label>
                    <div className="relative">
                      <BdtSign size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        max={selectedCustomer.remaining_balance}
                        className="w-full pl-12 sm:pl-14 pr-6 py-3.5 rounded-xl sm:rounded-3xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none text-xl sm:text-3xl font-black tabular-nums tracking-tighter transition-all h-12 sm:h-auto"
                        value={paymentAmount || ''}
                        onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('paymentMethod')}</label>
                      <select 
                        className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 text-xs sm:text-sm h-12 sm:h-auto"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="Cash">{t('cash')}</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Mobile Banking">Mobile Banking</option>
                        <option value="Card">Card</option>
                      </select>
                    </div>
                    <div>
                      <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1">{t('date')}</label>
                      <input 
                        type="date"
                        className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 text-xs sm:text-sm h-12 sm:h-auto"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-2 sm:pt-4 flex gap-3 sm:gap-4 shrink-0 mt-auto">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all h-12 sm:h-auto"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    onClick={handlePayment}
                    className="flex-1 px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl h-12 sm:h-auto"
                  >
                    {t('save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedCustomer && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-none sm:rounded-[3rem] w-full max-w-2xl shadow-2xl relative z-10 h-full sm:h-auto sm:max-h-[90vh] flex flex-col"
            >
              <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white sm:bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-xl sm:rounded-3xl flex items-center justify-center shadow-xl shadow-slate-200">
                    <History size={18} className="sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-2xl font-bold text-slate-900 tracking-tight">{t('paymentHistory')}</h3>
                    <p className="text-[8px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 sm:mt-1">{selectedCustomer.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={18} className="sm:w-6 sm:h-6" />
                </button>
              </div>
              <div className="p-4 sm:p-10 space-y-8 sm:space-y-12 overflow-y-auto flex-1 pb-20 sm:pb-10">
                {/* Outstanding Orders */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                    <ArrowRight size={10} /> {t('due')}
                  </h4>
                  {historyOrders.length === 0 ? (
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest pl-2">{t('noData')}</p>
                  ) : (
                    <div className="space-y-2">
                      {historyOrders.map((order) => (
                        <div key={order.id} className="p-4 rounded-xl border border-rose-50 bg-rose-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                          <div>
                            <p className="font-bold text-slate-900 text-xs sm:text-sm">{order.type} <span className="text-slate-300 font-mono text-[9px]">#{order.id.slice(-6)}</span></p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleDateString() : 'Manual Legacy'}</p>
                            
                            {/* Entry Photos in History */}
                            {order.images && order.images.length > 0 && (
                              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 invisible-scrollbar">
                                {order.images.map((img: string, i: number) => (
                                  <div 
                                    key={i} 
                                    className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setPreviewImage(img)}
                                  >
                                    <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0">
                            <div className="text-right">
                              <p className="text-sm font-black text-rose-600 tabular-nums">{formatCurrency(order.totalAmount - order.paidAmount)}</p>
                              <p className="text-[8px] font-black text-slate-300 uppercase leading-none">{t('due')}</p>
                            </div>
                            <button 
                              onClick={() => deleteSourceOrder(order.id)}
                              className="w-8 h-8 rounded-lg bg-white border border-rose-100 text-rose-400 group-hover:bg-rose-500 group-hover:text-white flex items-center justify-center transition-all h-9 w-9 sm:h-8 sm:w-8"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment History */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                    <ArrowRight size={10} /> {t('paid')}
                  </h4>
                  {historyPayments.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-slate-50">
                      <p className="text-slate-300 font-bold uppercase tracking-[0.2em] text-[9px]">{t('noData')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historyPayments.map((payment) => (
                        <div key={payment.id} className="p-4 sm:p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-200 transition-all bg-white">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-sm border border-emerald-100 shrink-0">
                               <Wallet size={18} className="sm:w-5 sm:h-5" />
                             </div>
                             <div>
                               <div className="flex items-center gap-2">
                                 <p className="text-base sm:text-xl font-black text-emerald-600 tabular-nums">+{formatCurrency(payment.amount)}</p>
                                 <span className="bg-slate-100 text-slate-500 text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest leading-none">{payment.method}</span>
                               </div>
                               <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                                 <span className="text-slate-900">{payment.paymentDate}</span>
                                 <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                 <span>{payment.createdAt?.toDate ? new Date(payment.createdAt.toDate()).toLocaleTimeString() : ''}</span>
                               </p>
                             </div>
                          </div>
                          <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                             <p className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">Audit Key</p>
                             <p className="text-[9px] font-mono font-bold text-slate-900 truncate max-w-full sm:max-w-[150px]">{payment.id}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="pt-2 sm:pt-4 shrink-0 mt-auto">
                    <button 
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="w-full px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl h-12"
                    >
                    {t('cancel')}
                    </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Spreadsheet Preview Modal */}
      <AnimatePresence>
        {isPreviewModalOpen && selectedCustomer && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPreviewModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-none sm:rounded-[3rem] w-full max-w-6xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden relative z-10 h-full sm:h-auto sm:max-h-[90vh] flex flex-col"
            >
              <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white sm:bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="w-10 h-10 sm:w-16 sm:h-16 bg-emerald-600 text-white rounded-xl sm:rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-100">
                    <Search size={20} className="sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-2xl font-bold text-slate-900 tracking-tight">{t('financialDataPreview')}</h3>
                    <p className="text-[8px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 sm:mt-1">{t('manualEntry')} — {selectedCustomer.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsPreviewModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={18} className="sm:w-6 sm:h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-10">
                <div className="min-w-max sm:min-w-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm font-mono text-[10px] sm:text-sm">
                  {/* Spreadsheet Header Row */}
                  <div className="flex bg-slate-100 border-b border-slate-200">
                    <div className="w-10 sm:w-12 py-3 px-2 sm:px-4 border-r border-slate-200 bg-slate-200/50 text-[8px] sm:text-[10px] font-black text-slate-400 text-center">#</div>
                    <div className="w-40 sm:w-64 py-3 px-4 sm:px-6 border-r border-slate-200 text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest italic font-serif">{t('category')}</div>
                    <div className="flex-1 py-3 px-4 sm:px-6 text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest italic font-serif text-center">{t('dataRecordDetails')}</div>
                  </div>

                  {/* Customer Core Identity Row */}
                  <div className="flex border-b border-slate-50 group hover:bg-slate-50/50">
                    <div className="w-10 sm:w-12 py-4 px-2 sm:px-4 border-r border-slate-200 text-slate-300 text-center font-bold">01</div>
                    <div className="w-40 sm:w-64 py-4 px-4 sm:px-6 border-r border-slate-200 font-bold text-slate-900 bg-slate-50/30">{t('customer')}</div>
                    <div className="flex-1 py-4 px-4 sm:px-6 font-medium text-slate-600 uppercase tracking-wider">{selectedCustomer.name}</div>
                  </div>

                  <div className="flex border-b border-slate-50 group hover:bg-slate-50/50">
                    <div className="w-10 sm:w-12 py-4 px-2 sm:px-4 border-r border-slate-200 text-slate-300 text-center font-bold">02</div>
                    <div className="w-40 sm:w-64 py-4 px-4 sm:px-6 border-r border-slate-200 font-bold text-slate-900 bg-slate-50/30">{t('mobile')}</div>
                    <div className="flex-1 py-4 px-4 sm:px-6 font-medium text-slate-600 tracking-tight">{customers.find(c => c.id === selectedCustomer.id)?.phone || 'N/A'}</div>
                  </div>

                  <div className="flex border-b border-slate-50 group hover:bg-slate-50/50">
                    <div className="w-10 sm:w-12 py-4 px-2 sm:px-4 border-r border-slate-200 text-slate-300 text-center font-bold">03</div>
                    <div className="w-40 sm:w-64 py-4 px-4 sm:px-6 border-r border-slate-200 font-bold text-slate-900 bg-slate-50/30">{t('address')}</div>
                    <div className="flex-1 py-4 px-4 sm:px-6 font-medium text-slate-600 tracking-tight">{customers.find(c => c.id === selectedCustomer.id)?.address || 'N/A'}</div>
                  </div>

                  {/* Asset Acquisition Block */}
                  <div className="flex border-b border-slate-50 group hover:bg-slate-50/50">
                    <div className="w-10 sm:w-12 py-4 px-2 sm:px-4 border-r border-slate-200 text-slate-300 text-center font-bold">04</div>
                    <div className="w-40 sm:w-64 py-4 px-4 sm:px-6 border-r border-slate-200 font-bold text-slate-900 bg-slate-50/30">All Bills</div>
                    <div className="flex-1 py-4 px-4 sm:px-6">
                      <div className="flex flex-wrap gap-2">
                        {historyOrders.map((o: any) => (
                          <span key={o.id} className="bg-slate-100 text-slate-600 text-[8px] sm:text-[10px] font-black px-2 py-1 rounded-md border border-slate-200 capitalize">
                            {o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toLocaleDateString() : 'Legacy'}
                          </span>
                        ))}
                        {historyOrders.length === 0 && <span className="text-slate-300 italic">{t('noData')}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Settlement Block */}
                  <div className="flex border-b border-slate-50 group hover:bg-slate-50/50">
                    <div className="w-10 sm:w-12 py-4 px-2 sm:px-4 border-r border-slate-200 text-slate-300 text-center font-bold">05</div>
                    <div className="w-40 sm:w-64 py-4 px-4 sm:px-6 border-r border-slate-200 font-bold text-slate-900 bg-slate-50/30">{t('paymentHistory')}</div>
                    <div className="flex-1 p-0">
                      <div className="divide-y divide-slate-100">
                        {historyPayments.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-emerald-50/30 transition-colors">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.paymentDate}</span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[8px] sm:text-[9px] font-black uppercase tracking-tighter">{p.method}</span>
                            </div>
                            <span className="font-black text-emerald-600 tabular-nums">+{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                        {historyPayments.length === 0 && (
                          <div className="px-4 sm:px-6 py-4 text-slate-300 italic text-xs">{t('noData')}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial Metrics Block */}
                  <div className="flex border-b border-slate-200 group hover:bg-slate-50/50">
                    <div className="w-10 sm:w-12 py-4 px-2 sm:px-4 border-r border-slate-200 text-slate-300 text-center font-bold">06</div>
                    <div className="w-40 sm:w-64 py-4 px-4 sm:px-6 border-r border-slate-200 font-bold text-slate-900 bg-slate-50/30">{t('financialOverview')}</div>
                    <div className="flex-1 flex divide-x divide-slate-100">
                      <div className="flex-1 p-3 sm:p-4 text-center">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-300 tracking-[0.2em] mb-1">{t('due')}</p>
                        <p className="text-sm sm:text-xl font-black text-rose-600">{formatCurrency(selectedCustomer.remaining_balance)}</p>
                      </div>
                      <div className="flex-1 p-3 sm:p-4 text-center">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-300 tracking-[0.2em] mb-1">{t('paid')}</p>
                        <p className="text-sm sm:text-xl font-black text-emerald-600 font-serif italic">{formatCurrency(selectedCustomer.total_paid)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-10 border-t border-slate-50 bg-white sm:bg-slate-50/30 flex gap-4 shrink-0 justify-end pb-20 sm:pb-10">
                <button 
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 h-12 sm:h-auto"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Due Modal */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManualModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-none sm:rounded-[3rem] w-full max-w-lg shadow-2xl relative z-10 h-full sm:h-auto sm:max-h-[90vh] flex flex-col"
            >
              <div className="p-4 sm:p-10 border-b border-slate-50 flex items-center justify-between bg-white sm:bg-slate-50/30 shrink-0">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-xl sm:rounded-3xl flex items-center justify-center shadow-xl shadow-slate-200">
                    <Wallet size={18} className="sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-2xl font-bold text-slate-900 tracking-tight">{t('manualEntry')}</h3>
                    <p className="text-[8px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5 sm:mt-1">{t('manualEntry')}</p>
                  </div>
                </div>
                <button onClick={() => setIsManualModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={18} className="sm:w-6 sm:h-6" />
                </button>
              </div>
              <form onSubmit={handleManualDue} id="manual-due-form" className="p-4 sm:p-10 space-y-6 sm:space-y-8 overflow-y-auto flex-1 pb-20 sm:pb-10">
                <div className="space-y-4 sm:space-y-6">
                  {/* Customer Selection Toggle */}
                  <div className="flex bg-slate-50 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setManualDue({ ...manualDue, isNewCustomer: false })}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                        !manualDue.isNewCustomer ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                      )}
                    >
                      {t('selectCustomer')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualDue({ ...manualDue, isNewCustomer: true })}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                        manualDue.isNewCustomer ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                      )}
                    >
                      New Customer
                    </button>
                  </div>

                  {manualDue.isNewCustomer ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div>
                        <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 px-1 text-slate-400 uppercase font-black tracking-widest">{t('customer')} Name</label>
                        <input 
                          required
                          type="text"
                          className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 text-xs sm:text-sm h-11"
                          placeholder="Full Name"
                          value={manualDue.newCustomer.name}
                          onChange={(e) => setManualDue({
                            ...manualDue, 
                            newCustomer: { ...manualDue.newCustomer, name: e.target.value }
                          })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 px-1 text-slate-400 uppercase font-black tracking-widest">{t('mobile')}</label>
                          <input 
                            type="tel"
                            className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 text-xs sm:text-sm h-11"
                            placeholder="017..."
                            value={manualDue.newCustomer.phone}
                            onChange={(e) => setManualDue({
                              ...manualDue, 
                              newCustomer: { ...manualDue.newCustomer, phone: e.target.value }
                            })}
                          />
                        </div>
                        <div>
                          <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 px-1 text-slate-400 uppercase font-black tracking-widest">{t('address')}</label>
                          <input 
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 text-xs sm:text-sm h-11"
                            placeholder="City/Area"
                            value={manualDue.newCustomer.address}
                            onChange={(e) => setManualDue({
                              ...manualDue, 
                              newCustomer: { ...manualDue.newCustomer, address: e.target.value }
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1 text-slate-400 uppercase font-black tracking-widest">{t('selectCustomer')}</label>
                      <select 
                        required={!manualDue.isNewCustomer}
                        className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 text-xs sm:text-sm h-11 sm:h-auto"
                        value={manualDue.customerId}
                        onChange={(e) => setManualDue({...manualDue, customerId: e.target.value})}
                      >
                        <option value="">{t('selectCustomer')}</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1 text-slate-400 uppercase font-black tracking-widest">{t('total')}</label>
                    <div className="relative">
                      <BdtSign size={20} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input 
                        required
                        type="number"
                        className="w-full pl-11 sm:pl-14 pr-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-900 text-lg sm:text-2xl transition-all tabular-nums h-11 sm:h-auto"
                        value={manualDue.amount || ''}
                        onChange={(e) => setManualDue({...manualDue, amount: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="detail-label text-[8px] sm:text-[10px] mb-1.5 sm:mb-2 px-1 text-slate-400 uppercase font-black tracking-widest">{t('note')}</label>
                    <textarea 
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none font-bold text-slate-700 min-h-[80px] sm:min-h-[100px] transition-all text-xs sm:text-sm"
                      placeholder={t('note')}
                      value={manualDue.note}
                      onChange={(e) => setManualDue({...manualDue, note: e.target.value})}
                    />
                  </div>

                  {/* Image Upload Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="detail-label text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Photos</label>
                      <span className="px-2 py-0.5 rounded-lg text-[7px] sm:text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-100">
                        {manualDue.images.length} / 6
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-3">
                      {manualDue.images.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 group">
                          <img 
                            src={url} 
                            alt="" 
                            className="w-full h-full object-cover cursor-pointer" 
                            referrerPolicy="no-referrer"
                            onClick={() => setPreviewImage(url)}
                          />
                          <button 
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 w-6 h-6 bg-rose-600/90 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      
                      {manualDue.images.length < 6 && (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-1 text-slate-300 hover:text-brand-primary hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all group"
                        >
                          {uploading ? (
                            <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Plus size={16} className="group-hover:scale-110 transition-transform" />
                              <span className="text-[7px] font-black uppercase tracking-widest">Add Picture</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      multiple 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>
                <div className="pt-2 sm:pt-4 flex gap-3 sm:gap-4 shrink-0 mt-auto">
                    <button 
                    type="button"
                    onClick={() => setIsManualModalOpen(false)}
                    className="flex-1 px-4 py-3.5 rounded-xl sm:rounded-2xl border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all h-11 sm:h-auto"
                    >
                    {t('cancel')}
                    </button>
                    <button 
                    type="submit"
                    form="manual-due-form"
                    disabled={isSaving}
                    className="flex-1 px-4 py-3.5 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl h-11 sm:h-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                    {isSaving ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      t('save')
                    )}
                    </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImage(null)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative z-10 max-w-4xl w-full aspect-auto rounded-3xl overflow-hidden shadow-2xl"
            >
              <img src={previewImage} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white transition-all"
              >
                <X size={24} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
