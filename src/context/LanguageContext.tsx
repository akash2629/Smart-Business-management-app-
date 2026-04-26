import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en';

interface LanguageContextType {
  language: Language;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    orders: 'Bills',
    customers: 'Customers',
    products: 'Products',
    dues: 'Dues',
    dailyRecord: 'Daily Record',
    signOut: 'Sign Out',
    settings: 'Settings',
    enterpriseAccess: 'Login',

    // Dashboard
    executiveOverview: 'Summary',
    realTimePerformance: 'Business summary and stats.',
    totalRevenue: 'Total Sale',
    totalOrders: 'Total Bills',
    totalCustomers: 'Total Customers',
    inventoryAssets: 'Stock Value',
    outstandingCredit: 'Total Due',
    capturedRevenue: 'Total Collected',
    salesPerformance: 'Sales Chart',
    revenueTrends: 'Recent Activity',
    quickActions: 'Quick Menu',
    addNewOrder: 'Create Bill',
    registerProduct: 'Add Item',
    customerDirectory: 'Customer List',
    financialReports: 'Reports',
    todaySales: 'Today Sale',
    todayDue: 'Today Due',
    monthlySales: 'This Month Sale',
    monthlyDue: 'This Month Due',

    // Global
    search: 'Search...',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    actions: 'Actions',
    loading: 'Loading...',
    exportExcel: 'Excel Report',
    exportPdf: 'PDF Report',
    manualEntry: 'New Bill',
    history: 'History',

    // Orders
    orderRegistry: 'Bill Registry',
    manageSales: 'View and manage all your sales bills.',
    newOrder: 'Create Bill',
    orderId: 'Bill ID',
    customer: 'Customer',
    date: 'Date',
    total: 'Total',
    paid: 'Paid',
    due: 'Due',
    status: 'Status',
    paymentMethod: 'Method',
    items: 'Items',
    addItems: 'Add Items',
    product: 'Product',
    quantity: 'Qty',
    unitPrice: 'Price',
    subtotal: 'Subtotal',
    selectProduct: 'Select Product',
    selectCustomer: 'Select Customer',

    // Customers
    clientNetwork: 'Customers',
    manageRelationships: 'Manage customer list and phone numbers.',
    addCustomer: 'Add Customer',
    mobile: 'Mobile',
    address: 'Address',
    joinDate: 'Join Date',

    // Products
    productCatalog: 'Items',
    inventoryGlobal: 'Manage your items and stock levels.',
    addAsset: 'Add Item',
    assetIdentifier: 'Item Name',
    registryCode: 'Code',
    unitValuation: 'Price',
    stockLevel: 'Stock',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',

    // Dues
    dueManagement: 'Dues',
    dueRegistry: 'Bills List',
    trackOutstanding: 'Track money owed by customers.',
    totalOutstanding: 'Total Due',
    debtorNetwork: 'Due List',
    averageRisk: 'Total Risk',
    collect: 'Collect',
    paymentLedger: 'Payment Record',
    outstandingObligations: 'Owed Money',
    inflowHistory: 'Collection History',
    recordCollection: 'Record Payment',
    paymentHistory: 'History',
    dataPreview: 'Preview',
    financialDataPreview: 'Payment Preview',
    financialOverview: 'Overview',
    dataRecordDetails: 'Details',
    category: 'Category',
    noData: 'No record found',
    cash: 'Cash',

    // Daily Record
    dailyOperational: 'Daily Activity',
    liquidMonitoring: 'Daily cash collection records.',
    transactionVolume: 'Bill Count',
    dailyLiquidity: 'Today Collected',
    auditTrail: 'Activity Log',

    // Common Phrases
    confirmDelete: 'Are you sure you want to delete this?',
    welcome: 'Welcome',
    systemUpdate: 'Update',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const t = (key: string) => {
    return (translations.en as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language: 'en', t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
