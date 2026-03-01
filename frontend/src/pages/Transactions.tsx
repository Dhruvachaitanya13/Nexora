/* ============================================
   FINTRACK AI - TRANSACTIONS PAGE
   Comprehensive transaction management
   ============================================ */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Tag,
  Receipt,
  CreditCard,
  Building2,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Sparkles,
  Brain,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  ShoppingCart,
  Car,
  Home,
  Utensils,
  Plane,
  Briefcase,
  Heart,
  Zap,
  Wifi,
  Phone,
  Monitor,
  Gift,
  DollarSign,
  PieChart,
  BarChart3,
  FileText,
  Settings,
  SlidersHorizontal,
  Bookmark,
  Flag,
  MessageSquare,
  Merge,
  Link2
} from 'lucide-react';
import { cn, formatCurrency, formatDate, getCategoryStyle, truncate } from '../lib/utils';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { SearchInput } from '../components/ui/Input';

// ============================================
// TYPES
// ============================================

interface Transaction {
  id: string;
  merchant_name: string;
  merchant_logo?: string;
  amount: number;
  currency: string;
  category: string;
  subcategory?: string;
  transaction_date: string;
  posted_date?: string;
  description?: string;
  original_description?: string;
  account_id: string;
  account_name: string;
  institution_name?: string;
  transaction_type: 'income' | 'expense' | 'transfer';
  status: 'pending' | 'posted' | 'canceled';
  is_income: boolean;
  is_expense: boolean;
  is_transfer: boolean;
  is_business_expense: boolean;
  is_tax_deductible: boolean;
  is_recurring: boolean;
  is_reviewed: boolean;
  is_split: boolean;
  schedule_c_category?: string;
  tax_year?: number;
  receipt_url?: string;
  notes?: string;
  tags: string[];
  location?: {
    city?: string;
    state?: string;
  };
  confidence_score?: number;
  ai_categorized: boolean;
}

interface TransactionFilters {
  search: string;
  category: string[];
  account: string[];
  dateRange: { start: string; end: string } | null;
  amountRange: { min: number; max: number } | null;
  type: ('income' | 'expense' | 'transfer')[];
  status: ('pending' | 'posted' | 'canceled')[];
  isBusinessExpense: boolean | null;
  isTaxDeductible: boolean | null;
  isRecurring: boolean | null;
  isReviewed: boolean | null;
  tags: string[];
}

interface SortConfig {
  field: keyof Transaction;
  direction: 'asc' | 'desc';
}

interface CategoryOption {
  value: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

// ============================================
// CONSTANTS
// ============================================

const categoryOptions: CategoryOption[] = [
  { value: 'income', label: 'Income', icon: Banknote, color: 'emerald' },
  { value: 'food', label: 'Food & Dining', icon: Utensils, color: 'orange' },
  { value: 'transport', label: 'Transportation', icon: Car, color: 'blue' },
  { value: 'shopping', label: 'Shopping', icon: ShoppingCart, color: 'pink' },
  { value: 'housing', label: 'Housing', icon: Home, color: 'violet' },
  { value: 'utilities', label: 'Utilities', icon: Zap, color: 'yellow' },
  { value: 'travel', label: 'Travel', icon: Plane, color: 'cyan' },
  { value: 'business', label: 'Business', icon: Briefcase, color: 'indigo' },
  { value: 'health', label: 'Health', icon: Heart, color: 'red' },
  { value: 'entertainment', label: 'Entertainment', icon: Monitor, color: 'purple' },
  { value: 'software', label: 'Software & Tech', icon: Wifi, color: 'teal' },
  { value: 'phone', label: 'Phone & Internet', icon: Phone, color: 'slate' },
  { value: 'gifts', label: 'Gifts & Donations', icon: Gift, color: 'rose' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: 'gray' },
];

const scheduleCCategories = [
  { value: 'advertising', label: 'Advertising (Line 8)' },
  { value: 'car_and_truck', label: 'Car & Truck Expenses (Line 9)' },
  { value: 'commissions', label: 'Commissions & Fees (Line 10)' },
  { value: 'contract_labor', label: 'Contract Labor (Line 11)' },
  { value: 'insurance', label: 'Insurance (Line 15)' },
  { value: 'legal_and_professional', label: 'Legal & Professional (Line 17)' },
  { value: 'office_expense', label: 'Office Expense (Line 18)' },
  { value: 'supplies', label: 'Supplies (Line 22)' },
  { value: 'travel', label: 'Travel (Line 24a)' },
  { value: 'meals', label: 'Meals (Line 24b)' },
  { value: 'utilities', label: 'Utilities (Line 25)' },
  { value: 'home_office', label: 'Home Office (Line 30)' },
  { value: 'other_expenses', label: 'Other Expenses (Line 27a)' },
];

// ============================================
// MOCK DATA
// ============================================

const mockTransactions: Transaction[] = [
  {
    id: '1',
    merchant_name: 'Stripe',
    amount: 2500,
    currency: 'USD',
    category: 'income',
    transaction_date: '2024-02-14',
    posted_date: '2024-02-14',
    description: 'Client payment - Web Development',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'income',
    status: 'posted',
    is_income: true,
    is_expense: false,
    is_transfer: false,
    is_business_expense: false,
    is_tax_deductible: false,
    is_recurring: false,
    is_reviewed: true,
    is_split: false,
    tags: ['client-work', 'web-dev'],
    confidence_score: 1,
    ai_categorized: false,
  },
  {
    id: '2',
    merchant_name: 'Adobe Creative Cloud',
    amount: -59.99,
    currency: 'USD',
    category: 'software',
    subcategory: 'Subscriptions',
    transaction_date: '2024-02-13',
    posted_date: '2024-02-14',
    description: 'Monthly subscription',
    account_id: 'acc2',
    account_name: 'Chase Sapphire',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: true,
    is_reviewed: true,
    is_split: false,
    schedule_c_category: 'office_expense',
    tags: ['subscription', 'design-tools'],
    confidence_score: 0.95,
    ai_categorized: true,
  },
  {
    id: '3',
    merchant_name: 'WeWork',
    amount: -450,
    currency: 'USD',
    category: 'business',
    subcategory: 'Office Space',
    transaction_date: '2024-02-12',
    posted_date: '2024-02-12',
    description: 'Hot desk membership',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: true,
    is_reviewed: true,
    is_split: false,
    schedule_c_category: 'office_expense',
    location: { city: 'Chicago', state: 'IL' },
    tags: ['coworking'],
    confidence_score: 0.98,
    ai_categorized: true,
  },
  {
    id: '4',
    merchant_name: 'Whole Foods',
    amount: -87.43,
    currency: 'USD',
    category: 'food',
    subcategory: 'Groceries',
    transaction_date: '2024-02-11',
    posted_date: '2024-02-12',
    account_id: 'acc2',
    account_name: 'Chase Sapphire',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: false,
    is_tax_deductible: false,
    is_recurring: false,
    is_reviewed: false,
    is_split: false,
    location: { city: 'Chicago', state: 'IL' },
    tags: [],
    confidence_score: 0.92,
    ai_categorized: true,
  },
  {
    id: '5',
    merchant_name: 'Uber',
    amount: -32.50,
    currency: 'USD',
    category: 'transport',
    subcategory: 'Rideshare',
    transaction_date: '2024-02-10',
    posted_date: '2024-02-11',
    description: 'Trip to client meeting',
    account_id: 'acc2',
    account_name: 'Chase Sapphire',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: false,
    is_reviewed: true,
    is_split: false,
    schedule_c_category: 'car_and_truck',
    location: { city: 'Chicago', state: 'IL' },
    tags: ['client-meeting'],
    confidence_score: 0.88,
    ai_categorized: true,
  },
  {
    id: '6',
    merchant_name: 'Amazon Web Services',
    amount: -127.84,
    currency: 'USD',
    category: 'software',
    subcategory: 'Cloud Services',
    transaction_date: '2024-02-09',
    posted_date: '2024-02-10',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: true,
    is_reviewed: true,
    is_split: false,
    schedule_c_category: 'office_expense',
    tags: ['hosting', 'infrastructure'],
    confidence_score: 0.97,
    ai_categorized: true,
  },
  {
    id: '7',
    merchant_name: 'Client Payment',
    amount: 1800,
    currency: 'USD',
    category: 'income',
    transaction_date: '2024-02-08',
    posted_date: '2024-02-09',
    description: 'Logo design project - ABC Corp',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'income',
    status: 'posted',
    is_income: true,
    is_expense: false,
    is_transfer: false,
    is_business_expense: false,
    is_tax_deductible: false,
    is_recurring: false,
    is_reviewed: true,
    is_split: false,
    tags: ['client-work', 'design'],
    confidence_score: 1,
    ai_categorized: false,
  },
  {
    id: '8',
    merchant_name: 'Comcast Business',
    amount: -149.99,
    currency: 'USD',
    category: 'utilities',
    subcategory: 'Internet',
    transaction_date: '2024-02-07',
    posted_date: '2024-02-08',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: true,
    is_reviewed: true,
    is_split: true,
    schedule_c_category: 'utilities',
    tags: ['home-office'],
    confidence_score: 0.94,
    ai_categorized: true,
  },
  {
    id: '9',
    merchant_name: 'Delta Airlines',
    amount: -387.00,
    currency: 'USD',
    category: 'travel',
    subcategory: 'Flights',
    transaction_date: '2024-02-05',
    posted_date: '2024-02-06',
    description: 'Flight to NYC - Conference',
    account_id: 'acc2',
    account_name: 'Chase Sapphire',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: false,
    is_reviewed: true,
    is_split: false,
    schedule_c_category: 'travel',
    receipt_url: '/receipts/delta-feb.pdf',
    tags: ['conference', 'travel'],
    confidence_score: 0.91,
    ai_categorized: true,
  },
  {
    id: '10',
    merchant_name: 'Pending Transfer',
    amount: -500,
    currency: 'USD',
    category: 'transfer',
    transaction_date: '2024-02-15',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'transfer',
    status: 'pending',
    is_income: false,
    is_expense: false,
    is_transfer: true,
    is_business_expense: false,
    is_tax_deductible: false,
    is_recurring: false,
    is_reviewed: false,
    is_split: false,
    tags: [],
    confidence_score: 1,
    ai_categorized: false,
  },
  {
    id: '11',
    merchant_name: 'Monthly Retainer',
    amount: 3500,
    currency: 'USD',
    category: 'income',
    transaction_date: '2024-02-01',
    posted_date: '2024-02-01',
    description: 'Monthly retainer - TechCorp Inc',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'income',
    status: 'posted',
    is_income: true,
    is_expense: false,
    is_transfer: false,
    is_business_expense: false,
    is_tax_deductible: false,
    is_recurring: true,
    is_reviewed: true,
    is_split: false,
    tags: ['retainer', 'client-work'],
    confidence_score: 1,
    ai_categorized: false,
  },
  {
    id: '12',
    merchant_name: 'Consulting Services',
    amount: 2400,
    currency: 'USD',
    category: 'income',
    transaction_date: '2024-02-03',
    posted_date: '2024-02-04',
    description: 'Strategy consulting - Startup XYZ',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'income',
    status: 'posted',
    is_income: true,
    is_expense: false,
    is_transfer: false,
    is_business_expense: false,
    is_tax_deductible: false,
    is_recurring: false,
    is_reviewed: true,
    is_split: false,
    tags: ['consulting'],
    confidence_score: 1,
    ai_categorized: false,
  },
  {
    id: '13',
    merchant_name: 'Office Rent',
    amount: -2200,
    currency: 'USD',
    category: 'business',
    subcategory: 'Rent',
    transaction_date: '2024-02-01',
    posted_date: '2024-02-01',
    description: 'February office rent',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: true,
    is_reviewed: true,
    is_split: false,
    schedule_c_category: 'rent_lease',
    tags: ['office', 'rent'],
    confidence_score: 1,
    ai_categorized: false,
  },
  {
    id: '14',
    merchant_name: 'Google Ads',
    amount: -650,
    currency: 'USD',
    category: 'marketing',
    subcategory: 'Digital Advertising',
    transaction_date: '2024-02-04',
    posted_date: '2024-02-05',
    description: 'February ad campaign',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: false,
    is_reviewed: true,
    is_split: false,
    schedule_c_category: 'advertising',
    tags: ['marketing', 'ads'],
    confidence_score: 0.97,
    ai_categorized: true,
  },
  {
    id: '15',
    merchant_name: 'Health Insurance',
    amount: -425,
    currency: 'USD',
    category: 'insurance',
    subcategory: 'Health',
    transaction_date: '2024-02-06',
    posted_date: '2024-02-06',
    description: 'Monthly health insurance premium',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: true,
    is_reviewed: true,
    is_split: false,
    tags: ['insurance', 'health'],
    confidence_score: 0.96,
    ai_categorized: true,
  },
  {
    id: '16',
    merchant_name: 'QuickBooks Online',
    amount: -199.99,
    currency: 'USD',
    category: 'software',
    subcategory: 'Accounting',
    transaction_date: '2024-02-08',
    posted_date: '2024-02-08',
    description: 'Monthly accounting subscription',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: true,
    is_reviewed: true,
    is_split: false,
    schedule_c_category: 'office_expense',
    tags: ['accounting', 'software'],
    confidence_score: 0.99,
    ai_categorized: true,
  },
  {
    id: '17',
    merchant_name: 'Slack',
    amount: -130.26,
    currency: 'USD',
    category: 'software',
    subcategory: 'Team Communication',
    transaction_date: '2024-02-09',
    posted_date: '2024-02-09',
    description: 'Pro plan - team workspace',
    account_id: 'acc1',
    account_name: 'Chase Business Checking',
    institution_name: 'Chase',
    transaction_type: 'expense',
    status: 'posted',
    is_income: false,
    is_expense: true,
    is_transfer: false,
    is_business_expense: true,
    is_tax_deductible: true,
    is_recurring: true,
    is_reviewed: true,
    is_split: false,
    schedule_c_category: 'office_expense',
    tags: ['communication', 'software'],
    confidence_score: 0.98,
    ai_categorized: true,
  },
];

const mockAccounts = [
  { id: 'acc1', name: 'Chase Business Checking', institution: 'Chase' },
  { id: 'acc2', name: 'Chase Sapphire', institution: 'Chase' },
  { id: 'acc3', name: 'Bank of America Savings', institution: 'Bank of America' },
];

// ============================================
// ANIMATIONS
// ============================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 }
  }
};

const slideDownVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { 
    opacity: 1, 
    height: 'auto',
    transition: { duration: 0.3 }
  },
  exit: { 
    opacity: 0, 
    height: 0,
    transition: { duration: 0.2 }
  }
};

// ============================================
// HELPER COMPONENTS
// ============================================

function CategoryIcon({ category }: { category: string }) {
  const option = categoryOptions.find(c => c.value === category);
  const Icon = option?.icon || MoreHorizontal;
  
  return (
    <div className={cn(
      "w-10 h-10 rounded-xl flex items-center justify-center",
      option ? `bg-${option.color}-500/20 text-${option.color}-400` : 'bg-dark-700 text-dark-400'
    )}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { color: 'amber', label: 'Pending', icon: Clock },
    posted: { color: 'emerald', label: 'Posted', icon: CheckCircle },
    canceled: { color: 'red', label: 'Canceled', icon: X },
  }[status] || { color: 'gray', label: status, icon: AlertCircle };

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      `bg-${config.color}-500/20 text-${config.color}-400`
    )}>
      <config.icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function TransactionBadges({ transaction }: { transaction: Transaction }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {transaction.is_business_expense && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400">
          Business
        </span>
      )}
      {transaction.is_tax_deductible && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
          Tax Deductible
        </span>
      )}
      {transaction.is_recurring && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
          Recurring
        </span>
      )}
      {transaction.ai_categorized && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          AI
        </span>
      )}
    </div>
  );
}

// ============================================
// FILTER PANEL COMPONENT
// ============================================

function FilterPanel({
  filters,
  setFilters,
  isOpen,
  onClose,
}: {
  filters: TransactionFilters;
  setFilters: React.Dispatch<React.SetStateAction<TransactionFilters>>;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [localFilters, setLocalFilters] = useState(filters);

  // Re-sync local state every time the panel opens so external resets are reflected
  useEffect(() => {
    if (isOpen) setLocalFilters(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleApply = () => {
    setFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    const defaultFilters: TransactionFilters = {
      search: '',
      category: [],
      account: [],
      dateRange: null,
      amountRange: null,
      type: [],
      status: [],
      isBusinessExpense: null,
      isTaxDeductible: null,
      isRecurring: null,
      isReviewed: null,
      tags: [],
    };
    setLocalFilters(defaultFilters);
    setFilters(defaultFilters);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category.length) count++;
    if (filters.account.length) count++;
    if (filters.dateRange) count++;
    if (filters.amountRange) count++;
    if (filters.type.length) count++;
    if (filters.status.length) count++;
    if (filters.isBusinessExpense !== null) count++;
    if (filters.isTaxDeductible !== null) count++;
    if (filters.isRecurring !== null) count++;
    if (filters.isReviewed !== null) count++;
    return count;
  }, [filters]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={slideDownVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="border-b border-dark-800 bg-dark-900/50 overflow-hidden"
        >
          <div className="p-5 space-y-5">
            {/* Categories */}
            <div>
              <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">Category</h4>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((cat) => {
                  const selected = localFilters.category.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setLocalFilters(prev => ({
                        ...prev,
                        category: selected
                          ? prev.category.filter(c => c !== cat.value)
                          : [...prev.category, cat.value]
                      }))}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 border transition-all duration-150",
                        selected
                          ? "bg-primary-500/20 text-primary-300 border-primary-500/40"
                          : "bg-dark-800/60 text-dark-400 border-dark-700/60 hover:border-dark-600 hover:text-dark-200"
                      )}
                    >
                      <cat.icon className="w-3.5 h-3.5" />
                      {cat.label}
                      {selected && <Check className="w-3 h-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type & Status in a row */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">Type</h4>
                <div className="flex flex-wrap gap-2">
                  {(['income', 'expense', 'transfer'] as const).map((type) => {
                    const selected = localFilters.type.includes(type);
                    const color = type === 'income' ? 'emerald' : type === 'expense' ? 'red' : 'blue';
                    return (
                      <button
                        key={type}
                        onClick={() => setLocalFilters(prev => ({
                          ...prev,
                          type: selected ? prev.type.filter(t => t !== type) : [...prev.type, type]
                        }))}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium capitalize border transition-all duration-150 flex items-center gap-1.5",
                          selected
                            ? `bg-${color}-500/20 text-${color}-300 border-${color}-500/40`
                            : "bg-dark-800/60 text-dark-400 border-dark-700/60 hover:border-dark-600 hover:text-dark-200"
                        )}
                      >
                        {type}
                        {selected && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">Status</h4>
                <div className="flex flex-wrap gap-2">
                  {(['pending', 'posted', 'canceled'] as const).map((status) => {
                    const selected = localFilters.status.includes(status);
                    const color = status === 'posted' ? 'emerald' : status === 'pending' ? 'amber' : 'red';
                    return (
                      <button
                        key={status}
                        onClick={() => setLocalFilters(prev => ({
                          ...prev,
                          status: selected ? prev.status.filter(s => s !== status) : [...prev.status, status]
                        }))}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium capitalize border transition-all duration-150 flex items-center gap-1.5",
                          selected
                            ? `bg-${color}-500/20 text-${color}-300 border-${color}-500/40`
                            : "bg-dark-800/60 text-dark-400 border-dark-700/60 hover:border-dark-600 hover:text-dark-200"
                        )}
                      >
                        {status}
                        {selected && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-dark-800">
              <button
                onClick={handleReset}
                className="text-sm text-dark-400 hover:text-white transition-colors"
              >
                Reset all
              </button>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleApply}>
                  Apply{activeFilterCount > 0 && ` (${activeFilterCount})`}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// TRANSACTION ROW COMPONENT
// ============================================

function TransactionRow({
  transaction,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onCategorize
}: {
  transaction: Transaction;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onCategorize: (transaction: Transaction) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const categoryOption = categoryOptions.find(c => c.value === transaction.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      layout
      className={cn(
        "group flex items-center gap-4 p-4 border-b border-dark-800/50 transition-colors duration-200",
        isSelected ? "bg-primary-500/10" : "hover:bg-dark-800/30",
        transaction.status === 'pending' && "opacity-70"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => onSelect(transaction.id)}
        className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
          isSelected
            ? "bg-primary-500 border-primary-500"
            : "border-dark-600 hover:border-dark-500"
        )}
      >
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Category Icon */}
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
        categoryOption 
          ? `bg-${categoryOption.color}-500/20 text-${categoryOption.color}-400`
          : "bg-dark-700 text-dark-400"
      )}>
        {categoryOption ? (
          <categoryOption.icon className="w-5 h-5" />
        ) : (
          <Receipt className="w-5 h-5" />
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-white truncate">
            {transaction.merchant_name}
          </h4>
          {!transaction.is_reviewed && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">
              Review
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-dark-500">
            {transaction.account_name}
          </span>
          {transaction.description && (
            <>
              <span className="text-dark-600">•</span>
              <span className="text-sm text-dark-500 truncate">
                {truncate(transaction.description, 40)}
              </span>
            </>
          )}
        </div>
        {/* Badges */}
        <div className="mt-2">
          <TransactionBadges transaction={transaction} />
        </div>
      </div>

      {/* Category */}
      <div className="hidden md:block w-32">
        <button
          onClick={() => onCategorize(transaction)}
          className="text-sm text-dark-400 hover:text-primary-400 transition-colors flex items-center gap-1"
        >
          {categoryOption?.label || 'Uncategorized'}
          <ChevronDown className="w-3 h-3" />
        </button>
        {transaction.schedule_c_category && (
          <span className="text-xs text-dark-600 mt-1 block">
            Schedule C: {transaction.schedule_c_category}
          </span>
        )}
      </div>

      {/* Date */}
      <div className="hidden lg:block w-28 text-right">
        <p className="text-sm text-dark-300">
          {formatDate(transaction.transaction_date, 'short')}
        </p>
        <p className="text-xs text-dark-600">
          {formatDate(transaction.transaction_date, 'time')}
        </p>
      </div>

      {/* Amount */}
      <div className="w-28 text-right">
        <p className={cn(
          "font-semibold",
          transaction.is_income ? "text-emerald-400" : "text-white"
        )}>
          {transaction.is_income ? '+' : ''}{formatCurrency(transaction.amount)}
        </p>
        <StatusBadge status={transaction.status} />
      </div>

      {/* Actions */}
      <div className="relative w-8" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={cn(
            "p-1.5 rounded-lg transition-all text-dark-500 hover:text-white hover:bg-white/10",
            "opacity-0 group-hover:opacity-100",
            showMenu && "opacity-100 bg-white/10 text-white"
          )}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl py-1 z-[100]"
            >
              <button
                onClick={() => { onEdit(transaction); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit Transaction
              </button>
              <button
                onClick={() => { onCategorize(transaction); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Tag className="w-4 h-4" />
                Change Category
              </button>
              <button
                onClick={() => { onCategorize(transaction); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>
              <div className="my-1 border-t border-dark-700" />
              <button
                onClick={() => { onDelete(transaction.id); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================
// STATS SUMMARY COMPONENT
// ============================================

function StatsSummary({ transactions }: { transactions: Transaction[] }) {
  const stats = useMemo(() => {
    const income = transactions
      .filter(t => t.transaction_type === 'income' || (t.is_income && !t.is_expense))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const expenses = transactions
      .filter(t => t.transaction_type === 'expense' || (t.is_expense && !t.is_income))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const taxDeductible = transactions
      .filter(t => t.is_tax_deductible)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const unreviewed = transactions.filter(t => !t.is_reviewed).length;

    return { income, expenses, net: income - expenses, taxDeductible, unreviewed };
  }, [transactions]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {[
        { label: 'Income', value: formatCurrency(stats.income), icon: TrendingUp, color: 'emerald' },
        { label: 'Expenses', value: formatCurrency(stats.expenses), icon: TrendingDown, color: 'red' },
        { label: 'Net', value: formatCurrency(stats.net), icon: DollarSign, color: stats.net >= 0 ? 'emerald' : 'red' },
        { label: 'Tax Deductible', value: formatCurrency(stats.taxDeductible), icon: Receipt, color: 'purple' },
        { label: 'Needs Review', value: stats.unreviewed.toString(), icon: AlertCircle, color: 'amber' },
      ].map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={cn(
            "p-4 rounded-xl bg-dark-800/50 border border-dark-700/50",
            "hover:bg-dark-800 transition-colors"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-dark-400">{stat.label}</span>
            <div className={`p-1.5 rounded-lg bg-${stat.color}-500/20`}>
              <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
            </div>
          </div>
          <p className={`text-xl font-bold text-${stat.color}-400`}>
            {stat.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// MAIN TRANSACTIONS COMPONENT
// ============================================

export default function Transactions() {
  // State
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    category: [],
    account: [],
    dateRange: null,
    amountRange: null,
    type: [],
    status: [],
    isBusinessExpense: null,
    isTaxDeductible: null,
    isRecurring: null,
    isReviewed: null,
    tags: [],
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'transaction_date',
    direction: 'desc'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [isAICategorizing, setIsAICategorizing] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [categorizingTransaction, setCategorizingTransaction] = useState<Transaction | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [addForm, setAddForm] = useState({
    merchant_name: '',
    amount: '',
    category: 'other',
    transaction_date: new Date().toISOString().split('T')[0],
    account_id: 'acc1',
    transaction_type: 'expense' as 'income' | 'expense' | 'transfer',
    notes: '',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const itemsPerPage = 20;

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.merchant_name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.account_name.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filters.category.length > 0) {
      result = result.filter(t => filters.category.includes(t.category));
    }

    // Account filter
    if (filters.account.length > 0) {
      result = result.filter(t => filters.account.includes(t.account_id));
    }

    // Type filter
    if (filters.type.length > 0) {
      result = result.filter(t => filters.type.includes(t.transaction_type));
    }

    // Status filter
    if (filters.status.length > 0) {
      result = result.filter(t => filters.status.includes(t.status));
    }

    // Boolean filters
    if (filters.isBusinessExpense !== null) {
      result = result.filter(t => t.is_business_expense === filters.isBusinessExpense);
    }
    if (filters.isTaxDeductible !== null) {
      result = result.filter(t => t.is_tax_deductible === filters.isTaxDeductible);
    }
    if (filters.isRecurring !== null) {
      result = result.filter(t => t.is_recurring === filters.isRecurring);
    }
    if (filters.isReviewed !== null) {
      result = result.filter(t => t.is_reviewed === filters.isReviewed);
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];
      
      if (aVal === undefined || bVal === undefined) return 0;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });

    return result;
  }, [transactions, searchQuery, filters, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.length === paginatedTransactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedTransactions.map(t => t.id));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Action handlers
  const handleDelete = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const handleBulkDelete = () => {
    setTransactions(prev => prev.filter(t => !selectedIds.includes(t.id)));
    setSelectedIds([]);
  };

  const handleExport = () => {
    const headers = ['Date', 'Merchant', 'Category', 'Account', 'Amount', 'Type', 'Status', 'Tax Deductible', 'Notes'];
    const rows = filteredTransactions.map(t => [
      t.transaction_date,
      t.merchant_name,
      categoryOptions.find(c => c.value === t.category)?.label ?? t.category,
      t.account_name,
      t.amount.toString(),
      t.transaction_type,
      t.status,
      t.is_tax_deductible ? 'Yes' : 'No',
      t.notes ?? '',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredTransactions.length} transactions as CSV`);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          if (file.name.endsWith('.json')) {
            const data = JSON.parse(text) as Partial<Transaction>[];
            const imported: Transaction[] = data.map((d, i) => {
              // Derive type robustly: explicit field → infer from is_* flags → infer from amount sign
              const rawAmt = d.amount ?? 0;
              const jsonType: 'income' | 'expense' | 'transfer' =
                d.transaction_type === 'income' || d.transaction_type === 'expense' || d.transaction_type === 'transfer'
                  ? d.transaction_type
                  : d.is_income ? 'income'
                  : d.is_expense ? 'expense'
                  : d.is_transfer ? 'transfer'
                  : rawAmt >= 0 ? 'income' : 'expense';
              // Ensure amount sign is consistent with type
              const jsonAmt = jsonType === 'expense' ? -Math.abs(rawAmt) : Math.abs(rawAmt);
              return {
                id: `import-${Date.now()}-${i}`,
                merchant_name: d.merchant_name ?? 'Unknown',
                amount: jsonAmt,
                currency: 'USD',
                category: d.category ?? 'other',
                transaction_date: d.transaction_date ?? new Date().toISOString().split('T')[0],
                account_id: d.account_id ?? 'acc1',
                account_name: d.account_name ?? 'Imported',
                transaction_type: jsonType,
                status: d.status ?? 'posted',
                is_income: jsonType === 'income',
                is_expense: jsonType === 'expense',
                is_transfer: jsonType === 'transfer',
                is_business_expense: d.is_business_expense ?? false,
                is_tax_deductible: d.is_tax_deductible ?? false,
                is_recurring: d.is_recurring ?? false,
                is_reviewed: false,
                is_split: false,
                tags: d.tags ?? [],
                ai_categorized: false,
              };
            });
            setTransactions(prev => [...imported, ...prev]);
            showToast(`Imported ${imported.length} transactions`);
          } else {
            // CSV: skip header row, map columns by position
            const lines = text.trim().split('\n').slice(1);
            const imported: Transaction[] = lines.filter(l => l.trim()).map((line, i) => {
              const cols = line.trim().split(',').map(c => c.replace(/^"|"$/g, '').trim());
              const rawAmt = parseFloat(cols[4]) || 0;
              // Map bank-specific type strings → our types; fall back to amount sign
              const rawType = cols[5]?.toLowerCase().trim() ?? '';
              let csvType: 'income' | 'expense' | 'transfer';
              if (['income', 'credit', 'deposit', 'payment', 'received'].includes(rawType)) {
                csvType = 'income';
              } else if (['expense', 'debit', 'purchase', 'sale', 'withdrawal', 'charge'].includes(rawType)) {
                csvType = 'expense';
              } else if (rawType === 'transfer') {
                csvType = 'transfer';
              } else {
                // Fall back to amount sign
                csvType = rawAmt >= 0 ? 'income' : 'expense';
              }
              // Ensure amount sign matches type
              const csvAmt = csvType === 'expense' ? -Math.abs(rawAmt) : Math.abs(rawAmt);
              return {
                id: `import-${Date.now()}-${i}`,
                merchant_name: cols[1] ?? 'Unknown',
                amount: csvAmt,
                currency: 'USD',
                category: cols[2]?.toLowerCase() ?? 'other',
                transaction_date: cols[0] ?? new Date().toISOString().split('T')[0],
                account_id: 'acc1',
                account_name: cols[3] ?? 'Imported',
                transaction_type: csvType,
                status: (['pending', 'posted', 'canceled'].includes(cols[6]?.toLowerCase()) ? cols[6].toLowerCase() : 'posted') as 'pending' | 'posted' | 'canceled',
                is_income: csvType === 'income',
                is_expense: csvType === 'expense',
                is_transfer: csvType === 'transfer',
                is_business_expense: false,
                is_tax_deductible: cols[7]?.toLowerCase() === 'yes',
                is_recurring: false,
                is_reviewed: false,
                is_split: false,
                tags: [],
                ai_categorized: false,
              };
            });
            setTransactions(prev => [...imported, ...prev]);
            showToast(`Imported ${imported.length} transactions from CSV`);
          }
        } catch {
          showToast('Failed to parse file. Check the format and try again.', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleAddTransaction = () => {
    if (!addForm.merchant_name.trim() || !addForm.amount) {
      showToast('Merchant name and amount are required', 'error');
      return;
    }
    const amount = parseFloat(addForm.amount);
    const type = addForm.transaction_type;
    const newTx: Transaction = {
      id: `manual-${Date.now()}`,
      merchant_name: addForm.merchant_name.trim(),
      amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
      currency: 'USD',
      category: addForm.category,
      transaction_date: addForm.transaction_date,
      account_id: addForm.account_id,
      account_name: mockAccounts.find(a => a.id === addForm.account_id)?.name ?? 'Unknown',
      transaction_type: type,
      status: 'posted',
      is_income: type === 'income',
      is_expense: type === 'expense',
      is_transfer: type === 'transfer',
      is_business_expense: false,
      is_tax_deductible: false,
      is_recurring: false,
      is_reviewed: false,
      is_split: false,
      notes: addForm.notes || undefined,
      tags: [],
      ai_categorized: false,
    };
    setTransactions(prev => [newTx, ...prev]);
    setShowAddModal(false);
    setAddForm({
      merchant_name: '',
      amount: '',
      category: 'other',
      transaction_date: new Date().toISOString().split('T')[0],
      account_id: 'acc1',
      transaction_type: 'expense',
      notes: '',
    });
    showToast('Transaction added successfully');
  };

  const handleRefresh = async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setSyncedAt(new Date());
    setIsSyncing(false);
    showToast('Transactions synced successfully');
  };

  const handleAICategorize = async () => {
    const unreviewed = transactions.filter(t => !t.is_reviewed);
    if (unreviewed.length === 0) {
      showToast('All transactions are already categorized');
      return;
    }
    setIsAICategorizing(true);
    await new Promise(resolve => setTimeout(resolve, 1800));
    setTransactions(prev =>
      prev.map(t =>
        !t.is_reviewed
          ? { ...t, is_reviewed: true, ai_categorized: true }
          : t
      )
    );
    setIsAICategorizing(false);
    showToast(`AI categorized ${unreviewed.length} transaction${unreviewed.length > 1 ? 's' : ''}`);
  };

  const handleEditSave = (updated: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
    setEditingTransaction(null);
    showToast('Transaction updated');
  };

  const handleSort = (field: keyof Transaction) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category.length) count++;
    if (filters.account.length) count++;
    if (filters.type.length) count++;
    if (filters.status.length) count++;
    if (filters.isBusinessExpense !== null) count++;
    if (filters.isTaxDeductible !== null) count++;
    if (filters.isRecurring !== null) count++;
    if (filters.isReviewed !== null) count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={cn(
              "fixed top-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium",
              toast.type === 'success'
                ? "bg-emerald-900/90 border-emerald-700/60 text-emerald-300"
                : "bg-red-900/90 border-red-700/60 text-red-300"
            )}
          >
            {toast.type === 'success'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="w-full max-w-md bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-dark-800">
                <h2 className="text-lg font-semibold text-white">Add Transaction</h2>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Merchant / Description *</label>
                    <input
                      value={addForm.merchant_name}
                      onChange={e => setAddForm(p => ({ ...p, merchant_name: e.target.value }))}
                      placeholder="e.g. Amazon, Stripe payment..."
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Amount *</label>
                    <input
                      type="number"
                      value={addForm.amount}
                      onChange={e => setAddForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Date *</label>
                    <input
                      type="date"
                      value={addForm.transaction_date}
                      onChange={e => setAddForm(p => ({ ...p, transaction_date: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Type</label>
                    <select
                      value={addForm.transaction_type}
                      onChange={e => setAddForm(p => ({ ...p, transaction_type: e.target.value as 'income' | 'expense' | 'transfer' }))}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Category</label>
                    <select
                      value={addForm.category}
                      onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    >
                      {categoryOptions.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Account</label>
                    <select
                      value={addForm.account_id}
                      onChange={e => setAddForm(p => ({ ...p, account_id: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    >
                      {mockAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Notes (optional)</label>
                    <input
                      value={addForm.notes}
                      onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Add a note..."
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-dark-800">
                <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleAddTransaction}>Add Transaction</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editingTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingTransaction(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="w-full max-w-md bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-dark-800">
                <h2 className="text-lg font-semibold text-white">Edit Transaction</h2>
                <button onClick={() => setEditingTransaction(null)} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Merchant / Description</label>
                    <input
                      value={editingTransaction.merchant_name}
                      onChange={e => setEditingTransaction(p => p ? { ...p, merchant_name: e.target.value } : p)}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Amount</label>
                    <input
                      type="number"
                      value={editingTransaction.amount}
                      onChange={e => setEditingTransaction(p => p ? { ...p, amount: parseFloat(e.target.value) || 0 } : p)}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Date</label>
                    <input
                      type="date"
                      value={editingTransaction.transaction_date}
                      onChange={e => setEditingTransaction(p => p ? { ...p, transaction_date: e.target.value } : p)}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Category</label>
                    <select
                      value={editingTransaction.category}
                      onChange={e => setEditingTransaction(p => p ? { ...p, category: e.target.value } : p)}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    >
                      {categoryOptions.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Type</label>
                    <select
                      value={editingTransaction.transaction_type}
                      onChange={e => {
                        const type = e.target.value as 'income' | 'expense' | 'transfer';
                        setEditingTransaction(p => p ? {
                          ...p,
                          transaction_type: type,
                          is_income: type === 'income',
                          is_expense: type === 'expense',
                          is_transfer: type === 'transfer',
                          // Fix amount sign to match new type
                          amount: type === 'expense' ? -Math.abs(p.amount) : Math.abs(p.amount),
                        } : p);
                      }}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Notes</label>
                    <input
                      value={editingTransaction.notes ?? ''}
                      onChange={e => setEditingTransaction(p => p ? { ...p, notes: e.target.value } : p)}
                      placeholder="Add a note..."
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTransaction.is_business_expense}
                        onChange={e => setEditingTransaction(p => p ? { ...p, is_business_expense: e.target.checked } : p)}
                        className="w-4 h-4 rounded accent-indigo-500"
                      />
                      <span className="text-sm text-dark-300">Business Expense</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTransaction.is_tax_deductible}
                        onChange={e => setEditingTransaction(p => p ? { ...p, is_tax_deductible: e.target.checked } : p)}
                        className="w-4 h-4 rounded accent-emerald-500"
                      />
                      <span className="text-sm text-dark-300">Tax Deductible</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-dark-800">
                <Button variant="secondary" size="sm" onClick={() => setEditingTransaction(null)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={() => handleEditSave(editingTransaction)}>Save Changes</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-dark-400 mt-1">
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
            {syncedAt && <span className="ml-2 text-dark-600">· Synced {syncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={handleImport}
          >
            Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddModal(true)}
          >
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <StatsSummary transactions={filteredTransactions} />

      {/* Main Card */}
      <Card variant="glass" size="none" className="rounded-2xl">
        {/* Toolbar */}
        <div className="p-4 border-b border-dark-800 flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={setSearchQuery}
              onClear={() => setSearchQuery('')}
              placeholder="Search transactions..."
              className="w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={showFilters ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />}
              onClick={handleRefresh}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Brain className={cn("w-4 h-4", isAICategorizing && "animate-pulse")} />}
              onClick={handleAICategorize}
              disabled={isAICategorizing}
            >
              {isAICategorizing ? 'Categorizing...' : 'AI Categorize'}
            </Button>

            {selectedIds.length > 0 && (
              <>
                <div className="h-6 w-px bg-dark-700 mx-2" />
                <span className="text-sm text-dark-400">
                  {selectedIds.length} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Tag className="w-4 h-4" />}
                >
                  Bulk Categorize
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  onClick={handleBulkDelete}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filter Panel */}
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
        />

        {/* Table Header */}
        <div className="hidden md:flex items-center gap-4 px-4 py-3 bg-dark-800/30 border-b border-dark-800 text-sm text-dark-400">
          <button
            onClick={handleSelectAll}
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
              selectedIds.length === paginatedTransactions.length && paginatedTransactions.length > 0
                ? "bg-primary-500 border-primary-500"
                : "border-dark-600 hover:border-dark-500"
            )}
          >
            {selectedIds.length === paginatedTransactions.length && paginatedTransactions.length > 0 && (
              <Check className="w-3 h-3 text-white" />
            )}
          </button>
          <div className="w-10" /> {/* Icon space */}
          <button
            onClick={() => handleSort('merchant_name')}
            className="flex-1 flex items-center gap-1 hover:text-white transition-colors"
          >
            Description
            {sortConfig.field === 'merchant_name' && (
              sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => handleSort('category')}
            className="w-32 flex items-center gap-1 hover:text-white transition-colors"
          >
            Category
            {sortConfig.field === 'category' && (
              sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => handleSort('transaction_date')}
            className="w-28 flex items-center gap-1 justify-end hover:text-white transition-colors"
          >
            Date
            {sortConfig.field === 'transaction_date' && (
              sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => handleSort('amount')}
            className="w-28 flex items-center gap-1 justify-end hover:text-white transition-colors"
          >
            Amount
            {sortConfig.field === 'amount' && (
              sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <div className="w-8" /> {/* Actions space */}
        </div>

        {/* Transaction List */}
        <div>
          {paginatedTransactions.length > 0 ? (
            <AnimatePresence mode="popLayout" initial={false}>
              {paginatedTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  isSelected={selectedIds.includes(transaction.id)}
                  onSelect={handleSelect}
                  onEdit={setEditingTransaction}
                  onDelete={handleDelete}
                  onCategorize={setCategorizingTransaction}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="py-16 text-center">
              <Receipt className="w-16 h-16 mx-auto text-dark-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No transactions found</h3>
              <p className="text-dark-400 mb-6">
                {searchQuery || activeFilterCount > 0
                  ? "Try adjusting your search or filters"
                  : "Connect a bank account to start tracking transactions"
                }
              </p>
              {activeFilterCount > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setFilters({
                      search: '',
                      category: [],
                      account: [],
                      dateRange: null,
                      amountRange: null,
                      type: [],
                      status: [],
                      isBusinessExpense: null,
                      isTaxDeductible: null,
                      isRecurring: null,
                      isReviewed: null,
                      tags: [],
                    });
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-dark-800">
            <p className="text-sm text-dark-400">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-sm font-medium transition-all",
                        currentPage === pageNum
                          ? "bg-primary-500 text-white"
                          : "text-dark-400 hover:text-white hover:bg-dark-800"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}