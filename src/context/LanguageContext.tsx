import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'bn';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    orders: 'Orders',
    customers: 'Customers',
    products: 'Products',
    dues: 'Dues',
    dailyRecord: 'Daily Record',
    signOut: 'Sign Out',
    settings: 'Settings',
    enterpriseAccess: 'Enterprise Access',

    // Dashboard
    executiveOverview: 'Executive Overview',
    realTimePerformance: 'Real-time performance metrics and shop analytics.',
    totalRevenue: 'Total Revenue',
    totalOrders: 'Total Orders',
    totalCustomers: 'Total Customers',
    inventoryAssets: 'Inventory Assets',
    outstandingCredit: 'Outstanding Credit',
    capturedRevenue: 'Captured Revenue',
    salesPerformance: 'Sales Performance',
    revenueTrends: 'Revenue and Transaction Analysis',
    quickActions: 'Quick Operations',
    addNewOrder: 'Add New Order',
    registerProduct: 'Register Product',
    customerDirectory: 'Customer Directory',
    financialReports: 'Financial Reports',
    todaySales: 'Today\'s Sale',
    todayDue: 'Today\'s Due',
    monthlySales: 'Monthly Sale',
    monthlyDue: 'Monthly Due',

    // Global
    search: 'Search...',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    actions: 'Actions',
    loading: 'Loading...',
    exportExcel: 'Export Excel',
    exportPdf: 'Export PDF',
    manualEntry: 'Manual Entry',
    history: 'History',

    // Orders
    orderRegistry: 'Order Registry',
    manageSales: 'Centralized management of all customer sales and financial obligations.',
    newOrder: 'New Order',
    orderId: 'Order ID',
    customer: 'Customer',
    date: 'Date',
    total: 'Total',
    paid: 'Paid',
    due: 'Due',
    status: 'Status',
    paymentMethod: 'Payment Method',
    items: 'Items',
    addItems: 'Add Items',
    product: 'Product',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    subtotal: 'Subtotal',
    selectProduct: 'Select Product',
    selectCustomer: 'Select Customer',

    // Customers
    clientNetwork: 'Client Network',
    manageRelationships: 'Comprehensive directory of your shop\'s customer base and credit history.',
    addCustomer: 'Add Customer',
    mobile: 'Mobile',
    address: 'Address',
    joinDate: 'Join Date',

    // Products
    productCatalog: 'Product Catalog',
    inventoryGlobal: 'Full-spectrum management of your shop\'s stock units and logistical data.',
    addAsset: 'Add Asset',
    assetIdentifier: 'Asset Identifier',
    registryCode: 'Registry Code',
    unitValuation: 'Unit Valuation',
    stockLevel: 'Stock Level',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',

    // Dues
    dueManagement: 'Due Management',
    dueRegistry: 'Financial Accountability',
    trackOutstanding: 'Systematic tracking of outstanding credits and collection status.',
    totalOutstanding: 'Total Outstanding',
    debtorNetwork: 'Debtor Network',
    averageRisk: 'Average Risk Exposure',
    collect: 'Collect',
    paymentLedger: 'Payment Ledger',
    outstandingObligations: 'Outstanding Obligations',
    inflowHistory: 'Liquidity Inflow History',
    recordCollection: 'Record Collection',
    paymentHistory: 'Payment History',
    dataPreview: 'Data Preview',
    financialDataPreview: 'Financial Data Preview',
    financialOverview: 'Financial Overview',
    dataRecordDetails: 'Data Record Details',
    category: 'Category',
    noData: 'No record found',
    cash: 'Cash',

    // Daily Record
    dailyOperational: 'Daily Operational Surveillance',
    liquidMonitoring: 'Granular monitoring of consolidated daily financial settlements.',
    transactionVolume: 'Transaction Volume',
    dailyLiquidity: 'Daily Liquidity Capture',
    auditTrail: 'Audit Trail',

    // Common Phrases
    confirmDelete: 'Are you sure you want to delete this record?',
    welcome: 'Welcome back',
    systemUpdate: 'System Update',
  },
  bn: {
    // Navigation
    dashboard: 'ড্যাশবোর্ড',
    orders: 'অর্ডার',
    customers: 'কাস্টমার',
    products: 'পণ্য',
    dues: 'বকেয়া',
    dailyRecord: 'দৈনিক রেকর্ড',
    signOut: 'লগ আউট',
    settings: 'সেটিংস',
    enterpriseAccess: 'এন্টারপ্রাইজ এক্সেস',

    // Dashboard
    executiveOverview: 'কার্যনির্বাহী সারসংক্ষেপ',
    realTimePerformance: 'রিয়েল-টাইম পারফরম্যান্স মেট্রিক্স এবং দোকান বিশ্লেষণ।',
    totalRevenue: 'মোট রাজস্ব',
    totalOrders: 'মোট অর্ডার',
    totalCustomers: 'মোট কাস্টমার',
    inventoryAssets: 'ইনভেন্টরি সম্পদ',
    outstandingCredit: 'মোট বকেয়া',
    capturedRevenue: 'আদায়কৃত রাজস্ব',
    salesPerformance: 'বিক্রয় পারফরম্যান্স',
    revenueTrends: 'রাজস্ব এবং লেনদেন বিশ্লেষণ',
    quickActions: 'দ্রুত অপারেশন',
    addNewOrder: 'নতুন অর্ডার যোগ করুন',
    registerProduct: 'পণ্য নিবন্ধন করুন',
    customerDirectory: 'কাস্টমার ডিরেক্টরি',
    financialReports: 'আর্থিক রিপোর্ট',
    todaySales: 'আজকের বিক্রয়',
    todayDue: 'আজকের বকেয়া',
    monthlySales: 'মাসিক বিক্রয়',
    monthlyDue: 'মাসিক বকেয়া',

    // Global
    search: 'খুঁজুন...',
    edit: 'এডিট',
    delete: 'ডিলিট',
    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    close: 'বন্ধ করুন',
    actions: 'অ্যাকশন',
    loading: 'লোড হচ্ছে...',
    exportExcel: 'এক্সেলে এক্সপোর্ট',
    exportPdf: 'পিডিএফে এক্সপোর্ট',
    manualEntry: 'ম্যানুয়াল এন্ট্রি',
    history: 'ইতিহাস',

    // Orders
    orderRegistry: 'অর্ডার রেজিস্ট্রি',
    manageSales: 'সমস্ত কাস্টমার বিক্রয় এবং আর্থিক বাধ্যবাধকতার কেন্দ্রীয় ব্যবস্থাপনা।',
    newOrder: 'নতুন অর্ডার',
    orderId: 'অর্ডার আইডি',
    customer: 'কাস্টমার',
    date: 'তারিখ',
    total: 'মোট',
    paid: 'পরিশোধিত',
    due: 'বকেয়া',
    status: 'অবস্থা',
    paymentMethod: 'পেমেন্ট মেথড',
    items: 'আইটেমসমূহ',
    addItems: 'আইটেম যোগ করুন',
    product: 'পণ্য',
    quantity: 'পরিমাণ',
    unitPrice: 'ইউনিট মূল্য',
    subtotal: 'সাবটোটাল',
    selectProduct: 'পণ্য নির্বাচন করুন',
    selectCustomer: 'কাস্টমার নির্বাচন করুন',

    // Customers
    clientNetwork: 'কাস্টমার নেটওয়ার্ক',
    manageRelationships: 'আপনার দোকানের কাস্টমার বেস এবং ক্রেডিট হিস্ট্রির তালিকা।',
    addCustomer: 'কাস্টমার যোগ করুন',
    mobile: 'মোবাইল',
    address: 'ঠিকানা',
    joinDate: 'যোগদানের তারিখ',

    // Products
    productCatalog: 'পণ্য তালিকা',
    inventoryGlobal: 'আপনার দোকানের স্টক ইউনিট এবং লজিস্টিক ডেটার পূর্ণ ব্যবস্থাপনা।',
    addAsset: 'পণ্য যোগ করুন',
    assetIdentifier: 'পণ্যের নাম',
    registryCode: 'রেজিস্ট্রি কোড',
    unitValuation: 'ইউনিট মূল্য',
    stockLevel: 'স্টক লেভেল',
    lowStock: 'স্টক কম',
    outOfStock: 'স্টক নেই',

    // Dues
    dueManagement: 'বকেয়া ব্যবস্থাপনা',
    dueRegistry: 'আর্থিক জবাবদিহিতা',
    trackOutstanding: 'বকেয়া এবং সংগ্রহের স্থিতির সিস্টেমেটিক ট্র্যাকিং।',
    totalOutstanding: 'মোট বকেয়া',
    debtorNetwork: 'ঋণগ্রহীতা নেটওয়ার্ক',
    averageRisk: 'গড় ঝুঁকি',
    collect: 'আদায়',
    paymentLedger: 'পেমেন্ট লেজার',
    outstandingObligations: 'অনাদায়ী বাধ্যবাধকতা',
    inflowHistory: 'নগদ প্রবাহের ইতিহাস',
    recordCollection: 'সংগ্রহ রেকর্ড',
    paymentHistory: 'পেমেন্টের ইতিহাস',
    dataPreview: 'ডেটা প্রিভিউ',
    financialDataPreview: 'আর্থিক তথ্যের প্রিভিউ',
    financialOverview: 'আর্থিক সারসংক্ষেপ',
    dataRecordDetails: 'ডেটা রেকর্ডের বিশদ',
    category: 'ক্যাটেগরি',
    noData: 'কোন তথ্য পাওয়া যায়নি',
    cash: 'নগদ',

    // Daily Record
    dailyOperational: 'দৈনিক অপারেশনাল পর্যবেক্ষণ',
    liquidMonitoring: 'একীভূত দৈনিক আর্থিক নিষ্পত্তির বিশদ পর্যবেক্ষণ।',
    transactionVolume: 'লেনদেনের পরিমাণ',
    dailyLiquidity: 'দৈনিক নগদ আদায়',
    auditTrail: 'অডিট ট্রেইল',

    // Common Phrases
    confirmDelete: 'আপনি কি নিশ্চিতভাবে এই রেকর্ডটি মুছে ফেলতে চান?',
    welcome: 'স্বাগতম',
    systemUpdate: 'সিস্টেম আপডেট',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('smartshop_lang');
    return (saved as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('smartshop_lang', lang);
  };

  const t = (key: string) => {
    return (translations[language] as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
