/* ============================================
   FINTRACK AI - ACCOUNTS PAGE
   Bank account management with Plaid integration
   ============================================ */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  RefreshCw,
  Building2,
  CreditCard,
  Wallet,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Link2,
  Unlink,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Percent,
  Activity,
  Shield,
  Lock,
  Unlock,
  Info,
  HelpCircle,
  X,
  Check,
  Sparkles,
  Zap,
  Target,
  BarChart3,
  PieChart
} from 'lucide-react';
import { cn, formatCurrency, formatDate, formatPercentage, maskString } from '../lib/utils';
import Card, { StatCard, AlertCard } from '../components/ui/Card';
import Button from '../components/ui/Button';

// ============================================
// TYPES
// ============================================

interface Account {
  id: string;
  plaid_item_id?: string;
  account_name: string;
  official_name?: string;
  institution_id?: string;
  institution_name: string;
  institution_logo?: string;
  institution_color?: string;
  account_type: 'checking' | 'savings' | 'credit' | 'investment' | 'loan' | 'other';
  account_subtype?: string;
  current_balance: number;
  available_balance: number;
  credit_limit?: number;
  currency: string;
  mask: string;
  is_primary: boolean;
  is_business: boolean;
  is_hidden: boolean;
  include_in_net_worth: boolean;
  include_in_budget: boolean;
  auto_sync: boolean;
  status: 'active' | 'inactive' | 'error' | 'pending' | 'disconnected';
  error_code?: string;
  error_message?: string;
  last_synced_at?: string;
  last_transaction_date?: string;
  created_at: string;
}

interface PlaidItem {
  id: string;
  institution_id: string;
  institution_name: string;
  institution_logo?: string;
  status: 'active' | 'error' | 'pending_expiration' | 'revoked';
  error_code?: string;
  error_message?: string;
  last_synced_at?: string;
  accounts: Account[];
}

interface AccountSummary {
  total_balance: number;
  total_available: number;
  total_credit_used: number;
  total_credit_available: number;
  net_worth: number;
  by_type: Record<string, number>;
  accounts_count: number;
  institutions_count: number;
  last_updated: string;
}

// ============================================
// MOCK DATA
// ============================================

const mockAccounts: Account[] = [
  {
    id: 'acc1',
    plaid_item_id: 'item1',
    account_name: 'Business Checking',
    official_name: 'Chase Total Business Checking',
    institution_id: 'ins_3',
    institution_name: 'Chase',
    institution_logo: '🏦',
    institution_color: '#117ACA',
    account_type: 'checking',
    current_balance: 23750.00,
    available_balance: 23750.00,
    currency: 'USD',
    mask: '4829',
    is_primary: true,
    is_business: true,
    is_hidden: false,
    include_in_net_worth: true,
    include_in_budget: true,
    auto_sync: true,
    status: 'active',
    last_synced_at: new Date().toISOString(),
    last_transaction_date: '2024-02-14',
    created_at: '2023-06-15',
  },
  {
    id: 'acc2',
    plaid_item_id: 'item1',
    account_name: 'Sapphire Reserve',
    official_name: 'Chase Sapphire Reserve',
    institution_id: 'ins_3',
    institution_name: 'Chase',
    institution_logo: '🏦',
    institution_color: '#117ACA',
    account_type: 'credit',
    current_balance: -2340.87,
    available_balance: 0,
    credit_limit: 25000,
    currency: 'USD',
    mask: '9012',
    is_primary: false,
    is_business: false,
    is_hidden: false,
    include_in_net_worth: true,
    include_in_budget: true,
    auto_sync: true,
    status: 'active',
    last_synced_at: new Date().toISOString(),
    last_transaction_date: '2024-02-14',
    created_at: '2023-06-15',
  },
  {
    id: 'acc3',
    plaid_item_id: 'item2',
    account_name: 'High Yield Savings',
    official_name: 'Marcus High Yield Savings',
    institution_id: 'ins_56',
    institution_name: 'Marcus by Goldman Sachs',
    institution_logo: '💰',
    institution_color: '#000000',
    account_type: 'savings',
    current_balance: 15000.00,
    available_balance: 15000.00,
    currency: 'USD',
    mask: '7654',
    is_primary: false,
    is_business: false,
    is_hidden: false,
    include_in_net_worth: true,
    include_in_budget: false,
    auto_sync: true,
    status: 'active',
    last_synced_at: new Date().toISOString(),
    created_at: '2023-08-20',
  },
  {
    id: 'acc4',
    plaid_item_id: 'item3',
    account_name: 'Investment Account',
    official_name: 'Fidelity Individual Brokerage',
    institution_id: 'ins_12',
    institution_name: 'Fidelity',
    institution_logo: '📈',
    institution_color: '#4AA96C',
    account_type: 'investment',
    current_balance: 47823.45,
    available_balance: 47823.45,
    currency: 'USD',
    mask: '3456',
    is_primary: false,
    is_business: false,
    is_hidden: false,
    include_in_net_worth: true,
    include_in_budget: false,
    auto_sync: true,
    status: 'active',
    last_synced_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    created_at: '2023-01-10',
  },
  {
    id: 'acc5',
    plaid_item_id: 'item4',
    account_name: 'Tax Savings',
    official_name: 'Ally Bank Savings',
    institution_id: 'ins_23',
    institution_name: 'Ally Bank',
    institution_logo: '🏧',
    institution_color: '#6F2DA8',
    account_type: 'savings',
    current_balance: 8500.00,
    available_balance: 8500.00,
    currency: 'USD',
    mask: '1122',
    is_primary: false,
    is_business: true,
    is_hidden: false,
    include_in_net_worth: true,
    include_in_budget: false,
    auto_sync: true,
    status: 'error',
    error_code: 'ITEM_LOGIN_REQUIRED',
    error_message: 'Please re-authenticate your Ally Bank connection',
    last_synced_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    created_at: '2023-09-05',
  },
];

const mockPlaidItems: PlaidItem[] = [
  {
    id: 'item1',
    institution_id: 'ins_3',
    institution_name: 'Chase',
    institution_logo: '🏦',
    status: 'active',
    last_synced_at: new Date().toISOString(),
    accounts: mockAccounts.filter(a => a.plaid_item_id === 'item1'),
  },
  {
    id: 'item2',
    institution_id: 'ins_56',
    institution_name: 'Marcus by Goldman Sachs',
    institution_logo: '💰',
    status: 'active',
    last_synced_at: new Date().toISOString(),
    accounts: mockAccounts.filter(a => a.plaid_item_id === 'item2'),
  },
  {
    id: 'item3',
    institution_id: 'ins_12',
    institution_name: 'Fidelity',
    institution_logo: '📈',
    status: 'active',
    last_synced_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    accounts: mockAccounts.filter(a => a.plaid_item_id === 'item3'),
  },
  {
    id: 'item4',
    institution_id: 'ins_23',
    institution_name: 'Ally Bank',
    institution_logo: '🏧',
    status: 'error',
    error_code: 'ITEM_LOGIN_REQUIRED',
    error_message: 'Please re-authenticate your connection',
    last_synced_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    accounts: mockAccounts.filter(a => a.plaid_item_id === 'item4'),
  },
];

// ============================================
// ANIMATIONS
// ============================================

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3 }
  },
  hover: {
    y: -4,
    transition: { duration: 0.2 }
  }
};

// ============================================
// HELPER COMPONENTS
// ============================================

function AccountTypeIcon({ type }: { type: string }) {
  const icons: Record<string, { icon: React.ElementType; color: string }> = {
    checking: { icon: Wallet, color: 'blue' },
    savings: { icon: PiggyBank, color: 'emerald' },
    credit: { icon: CreditCard, color: 'purple' },
    investment: { icon: TrendingUp, color: 'cyan' },
    loan: { icon: Building2, color: 'orange' },
    other: { icon: DollarSign, color: 'gray' },
  };

  const config = icons[type] || icons.other;
  const Icon = config.icon;

  return (
    <div className={cn(
      "w-10 h-10 rounded-xl flex items-center justify-center",
      `bg-${config.color}-500/20 text-${config.color}-400`
    )}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

function StatusIndicator({ status, errorMessage }: { status: string; errorMessage?: string }) {
  const config = {
    active: { color: 'emerald', icon: CheckCircle, label: 'Active' },
    inactive: { color: 'gray', icon: Clock, label: 'Inactive' },
    error: { color: 'red', icon: AlertTriangle, label: 'Error' },
    pending: { color: 'amber', icon: Clock, label: 'Pending' },
    disconnected: { color: 'red', icon: Unlink, label: 'Disconnected' },
  }[status] || { color: 'gray', icon: HelpCircle, label: status };

  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        "relative flex h-2.5 w-2.5",
        status === 'active' && "animate-pulse"
      )}>
        {status === 'active' && (
          <span className={`absolute inline-flex h-full w-full rounded-full bg-${config.color}-400 opacity-75 animate-ping`} />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 bg-${config.color}-500`} />
      </span>
      <span className={`text-xs font-medium text-${config.color}-400`}>
        {config.label}
      </span>
      {errorMessage && (
        <button className="text-dark-500 hover:text-white transition-colors" title={errorMessage}>
          <Info className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================
// SUMMARY CARDS COMPONENT
// ============================================

function SummaryCards({ accounts }: { accounts: Account[] }) {
  const summary = React.useMemo(() => {
    const checking = accounts.filter(a => a.account_type === 'checking').reduce((sum, a) => sum + a.current_balance, 0);
    const savings = accounts.filter(a => a.account_type === 'savings').reduce((sum, a) => sum + a.current_balance, 0);
    const investments = accounts.filter(a => a.account_type === 'investment').reduce((sum, a) => sum + a.current_balance, 0);
    const creditUsed = accounts.filter(a => a.account_type === 'credit').reduce((sum, a) => sum + Math.abs(a.current_balance), 0);
    const creditLimit = accounts.filter(a => a.account_type === 'credit').reduce((sum, a) => sum + (a.credit_limit || 0), 0);
    
    const totalAssets = checking + savings + investments;
    const totalLiabilities = creditUsed;
    const netWorth = totalAssets - totalLiabilities;

    return {
      checking,
      savings,
      investments,
      creditUsed,
      creditLimit,
      creditAvailable: creditLimit - creditUsed,
      creditUtilization: creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0,
      totalAssets,
      totalLiabilities,
      netWorth,
    };
  }, [accounts]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Net Worth */}
      <motion.div variants={itemVariants}>
        <Card variant="gradient" hover="glow" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-purple-500/10" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
                <Target className="w-6 h-6 text-white" />
              </div>
              <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                +12.4%
              </span>
            </div>
            <p className="text-sm text-dark-400 mb-1">Net Worth</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(summary.netWorth)}</p>
          </div>
        </Card>
      </motion.div>

      {/* Total Assets */}
      <motion.div variants={itemVariants}>
        <Card variant="glass" hover="lift">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-sm text-dark-400 mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(summary.totalAssets)}</p>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="text-dark-500">Checking: {formatCurrency(summary.checking)}</span>
            <span className="text-dark-500">Savings: {formatCurrency(summary.savings)}</span>
          </div>
        </Card>
      </motion.div>

      {/* Investments */}
      <motion.div variants={itemVariants}>
        <Card variant="glass" hover="lift">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <p className="text-sm text-dark-400 mb-1">Investments</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(summary.investments)}</p>
          <div className="mt-3 flex items-center gap-1 text-xs text-emerald-400">
            <ArrowUpRight className="w-3 h-3" />
            <span>+8.2% this month</span>
          </div>
        </Card>
      </motion.div>

      {/* Credit */}
      <motion.div variants={itemVariants}>
        <Card variant="glass" hover="lift">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <p className="text-sm text-dark-400 mb-1">Credit Available</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(summary.creditAvailable)}</p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-dark-500">Utilization</span>
              <span className={cn(
                "font-medium",
                summary.creditUtilization > 30 ? "text-amber-400" : "text-emerald-400"
              )}>
                {summary.creditUtilization.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${summary.creditUtilization}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className={cn(
                  "h-full rounded-full",
                  summary.creditUtilization > 30 ? "bg-amber-500" : "bg-emerald-500"
                )}
              />
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

// ============================================
// ACCOUNT CARD COMPONENT
// ============================================

function AccountCard({
  account,
  onEdit,
  onDelete,
  onReconnect,
  onToggleVisibility
}: {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  onReconnect: (account: Account) => void;
  onToggleVisibility: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
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

  const isCredit = account.account_type === 'credit';
  const balance = Math.abs(account.current_balance);
  const percentUsed = isCredit && account.credit_limit 
    ? (balance / account.credit_limit) * 100 
    : 0;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className={cn(
        "relative group",
        account.is_hidden && "opacity-60"
      )}
    >
      <Card 
        variant={account.status === 'error' ? 'outline' : 'glass'}
        className={cn(
          "h-full transition-all duration-300",
          account.status === 'error' && "border-red-500/30 bg-red-500/5"
        )}
      >
        {/* Error Banner */}
        {account.status === 'error' && (
          <div className="absolute top-0 left-0 right-0 px-4 py-2 bg-red-500/20 border-b border-red-500/30 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Connection issue</span>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onReconnect(account)}
                className="text-xs"
              >
                Reconnect
              </Button>
            </div>
          </div>
        )}

        <div className={cn(account.status === 'error' && "pt-12")}>
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${account.institution_color}20` }}
              >
                {account.institution_logo || '🏦'}
              </div>
              <div>
                <h3 className="font-semibold text-white">{account.account_name}</h3>
                <p className="text-sm text-dark-400">{account.institution_name}</p>
              </div>
            </div>

            {/* Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className={cn(
                  "p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-colors",
                  "opacity-0 group-hover:opacity-100",
                  showMenu && "opacity-100 bg-white/10 text-white"
                )}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-full mt-1 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl py-1 z-20"
                  >
                    <button
                      onClick={() => { onEdit(account); setShowMenu(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit Account
                    </button>
                    <button
                      onClick={() => { setShowBalance(!showBalance); setShowMenu(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
                    >
                      {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showBalance ? 'Hide Balance' : 'Show Balance'}
                    </button>
                    <button
                      onClick={() => { onToggleVisibility(account.id); setShowMenu(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:text-white hover:bg-white/10 flex items-center gap-2"
                    >
                      {account.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      {account.is_hidden ? 'Unhide Account' : 'Hide Account'}
                    </button>
                    {account.status === 'error' && (
                      <button
                        onClick={() => { onReconnect(account); setShowMenu(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-amber-400 hover:bg-amber-500/10 flex items-center gap-2"
                      >
                        <Link2 className="w-4 h-4" />
                        Reconnect
                      </button>
                    )}
                    <div className="my-1 border-t border-dark-700" />
                    <button
                      onClick={() => { onDelete(account.id); setShowMenu(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove Account
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Balance */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-dark-400">
                {isCredit ? 'Current Balance' : 'Available Balance'}
              </p>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-dark-500 hover:text-white transition-colors"
              >
                {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              isCredit ? "text-red-400" : "text-white"
            )}>
              {showBalance 
                ? (isCredit ? '-' : '') + formatCurrency(balance)
                : '••••••'
              }
            </p>
          </div>

          {/* Credit Limit Progress */}
          {isCredit && account.credit_limit && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-dark-500">
                  {formatCurrency(balance)} of {formatCurrency(account.credit_limit)}
                </span>
                <span className={cn(
                  "font-medium",
                  percentUsed > 30 ? "text-amber-400" : "text-emerald-400"
                )}>
                  {percentUsed.toFixed(0)}% used
                </span>
              </div>
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentUsed}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className={cn(
                    "h-full rounded-full",
                    percentUsed > 50 ? "bg-red-500" : percentUsed > 30 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-dark-700/50">
            <div className="flex items-center gap-3">
              <StatusIndicator status={account.status} errorMessage={account.error_message} />
            </div>
            <div className="flex items-center gap-2">
              {account.is_business && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-medium">
                  Business
                </span>
              )}
              {account.is_primary && (
                <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 text-xs font-medium">
                  Primary
                </span>
              )}
            </div>
          </div>

          {/* Last Synced */}
          {account.last_synced_at && (
            <p className="text-xs text-dark-600 mt-3">
              Last synced: {formatDate(account.last_synced_at, 'relative')}
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ============================================
// INSTITUTION GROUP COMPONENT
// ============================================

function InstitutionGroup({
  item,
  onSync,
  onReconnect,
  onRemove,
  onEditAccount,
  onDeleteAccount,
  onToggleAccountVisibility
}: {
  item: PlaidItem;
  onSync: (itemId: string) => void;
  onReconnect: (item: PlaidItem) => void;
  onRemove: (itemId: string) => void;
  onEditAccount: (account: Account) => void;
  onDeleteAccount: (accountId: string) => void;
  onToggleAccountVisibility: (accountId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    onSync(item.id);
    setIsSyncing(false);
  };

  const totalBalance = item.accounts.reduce((sum, acc) => {
    if (acc.account_type === 'credit') {
      return sum - Math.abs(acc.current_balance);
    }
    return sum + acc.current_balance;
  }, 0);

  return (
    <motion.div
      variants={itemVariants}
      className="mb-6"
    >
      {/* Institution Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 group"
        >
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ backgroundColor: `${item.accounts[0]?.institution_color || '#666'}20` }}
          >
            {item.institution_logo || '🏦'}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                {item.institution_name}
              </h3>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-dark-400" />
              </motion.div>
            </div>
            <p className="text-sm text-dark-500">
              {item.accounts.length} account{item.accounts.length !== 1 ? 's' : ''} • Total: {formatCurrency(totalBalance)}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <StatusIndicator status={item.status} errorMessage={item.error_message} />
          
          {item.status === 'error' ? (
            <Button
              variant="warning"
              size="sm"
              leftIcon={<Link2 className="w-4 h-4" />}
              onClick={() => onReconnect(item)}
            >
              Reconnect
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />}
              onClick={handleSync}
              loading={isSyncing}
            >
              Sync
            </Button>
          )}
        </div>
      </div>

      {/* Accounts */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-13"
          >
            {item.accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={onEditAccount}
                onDelete={onDeleteAccount}
                onReconnect={() => onReconnect(item)}
                onToggleVisibility={onToggleAccountVisibility}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// CONNECT BANK MODAL COMPONENT
// ============================================

function ConnectBankModal({
  isOpen,
  onClose,
  onConnect
}: {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="w-full max-w-lg bg-dark-900 border border-dark-700 rounded-3xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-dark-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Connect Bank Account</h2>
                      <p className="text-sm text-dark-400">Securely link your financial accounts</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Security Info */}
                <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-6">
                  <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-emerald-400 mb-1">Bank-level Security</h4>
                    <p className="text-sm text-emerald-400/80">
                      We use Plaid to securely connect to your bank. Your credentials are never stored on our servers.
                    </p>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-4 mb-6">
                  <h4 className="text-sm font-medium text-dark-300">What you'll get:</h4>
                  {[
                    { icon: RefreshCw, text: 'Automatic transaction syncing' },
                    { icon: Activity, text: 'Real-time balance updates' },
                    { icon: Sparkles, text: 'AI-powered categorization' },
                    { icon: Lock, text: '256-bit encryption' },
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 text-dark-400">
                      <feature.icon className="w-4 h-4 text-primary-400" />
                      <span className="text-sm">{feature.text}</span>
                    </div>
                  ))}
                </div>

                {/* Supported Banks */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-dark-300 mb-3">Supported banks include:</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Chase', 'Bank of America', 'Wells Fargo', 'Citi', 'Capital One', 'US Bank', 'PNC', 'TD Bank'].map((bank) => (
                      <span key={bank} className="px-3 py-1 bg-dark-800 rounded-full text-xs text-dark-400">
                        {bank}
                      </span>
                    ))}
                    <span className="px-3 py-1 bg-dark-800 rounded-full text-xs text-dark-400">
                      + 10,000 more
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-dark-800 bg-dark-800/30">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-dark-500">
                    By connecting, you agree to our Terms of Service
                  </p>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button 
                      variant="primary" 
                      onClick={onConnect}
                      leftIcon={<Link2 className="w-4 h-4" />}
                    >
                      Connect with Plaid
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// MAIN ACCOUNTS COMPONENT
// ============================================

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>(mockPlaidItems);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showHidden, setShowHidden] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const visibleAccounts = showHidden ? accounts : accounts.filter(a => !a.is_hidden);
  const visibleItems = plaidItems.map(item => ({
    ...item,
    accounts: item.accounts.filter(a => showHidden || !a.is_hidden)
  })).filter(item => item.accounts.length > 0);

  const handleSyncAll = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2500));
    setIsLoading(false);
  };

  const handleSyncItem = (itemId: string) => {
    console.log('Syncing item:', itemId);
  };

  const handleReconnect = (item: PlaidItem) => {
    handleReconnectWithFeedback(item);
  };

  const handleRemoveItem = (itemId: string) => {
    setPlaidItems(prev => prev.filter(i => i.id !== itemId));
    setAccounts(prev => prev.filter(a => a.plaid_item_id !== itemId));
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
  };

  const handleEditSave = (updated: Account) => {
    setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
    setPlaidItems(prev => prev.map(item => ({
      ...item,
      accounts: item.accounts.map(a => a.id === updated.id ? updated : a),
    })));
    setEditingAccount(null);
    showToast('Account updated successfully');
  };

  const handleReconnectWithFeedback = (item: PlaidItem) => {
    showToast('Opening secure reconnection flow…');
    // In a real app, would open Plaid Link in update mode
  };

  const handleDeleteAccount = (accountId: string) => {
    setAccounts(prev => prev.filter(a => a.id !== accountId));
  };

  const handleToggleAccountVisibility = (accountId: string) => {
    setAccounts(prev => prev.map(a => 
      a.id === accountId ? { ...a, is_hidden: !a.is_hidden } : a
    ));
  };

  const handleConnect = () => {
    setShowConnectModal(false);
    showToast('Opening secure bank connection…');
  };

  const errorCount = plaidItems.filter(i => i.status === 'error').length;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
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
              : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Account Modal */}
      <AnimatePresence>
        {editingAccount && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingAccount(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="w-full max-w-md bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-dark-800">
                <h2 className="text-lg font-semibold text-white">Edit Account</h2>
                <button onClick={() => setEditingAccount(null)} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1.5">Account Name</label>
                  <input
                    value={editingAccount.account_name}
                    onChange={e => setEditingAccount(p => p ? { ...p, account_name: e.target.value } : p)}
                    className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Account Type</label>
                    <select
                      value={editingAccount.account_type}
                      onChange={e => setEditingAccount(p => p ? { ...p, account_type: e.target.value as Account['account_type'] } : p)}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    >
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                      <option value="credit">Credit Card</option>
                      <option value="investment">Investment</option>
                      <option value="loan">Loan</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Institution</label>
                    <input
                      value={editingAccount.institution_name}
                      onChange={e => setEditingAccount(p => p ? { ...p, institution_name: e.target.value } : p)}
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3 pt-1">
                  {(['is_primary', 'is_business', 'include_in_net_worth', 'include_in_budget', 'auto_sync'] as const).map(field => (
                    <label key={field} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingAccount[field]}
                        onChange={e => setEditingAccount(p => p ? { ...p, [field]: e.target.checked } : p)}
                        className="w-4 h-4 rounded accent-indigo-500"
                      />
                      <span className="text-sm text-dark-300">
                        {field === 'is_primary' ? 'Primary Account'
                          : field === 'is_business' ? 'Business Account'
                          : field === 'include_in_net_worth' ? 'Include in Net Worth'
                          : field === 'include_in_budget' ? 'Include in Budget'
                          : 'Auto Sync'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-dark-800">
                <Button variant="secondary" size="sm" onClick={() => setEditingAccount(null)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={() => handleEditSave(editingAccount)}>Save Changes</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Connected Accounts</h1>
          <p className="text-dark-400 mt-1">
            {accounts.length} accounts from {plaidItems.length} institutions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            onClick={() => setShowHidden(!showHidden)}
          >
            {showHidden ? 'Hide Hidden' : 'Show Hidden'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />}
            onClick={handleSyncAll}
            loading={isLoading}
          >
            Sync All
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowConnectModal(true)}
          >
            Add Account
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {errorCount > 0 && (
        <AlertCard
          type="warning"
          title={`${errorCount} connection${errorCount > 1 ? 's' : ''} need${errorCount === 1 ? 's' : ''} attention`}
          message="Some of your bank connections require re-authentication. Please reconnect to continue syncing."
          icon={<AlertTriangle className="w-5 h-5" />}
          action={{
            label: 'Fix Now',
            onClick: () => {
              const errorItem = plaidItems.find(i => i.status === 'error');
              if (errorItem) handleReconnect(errorItem);
            }
          }}
          dismissible
        />
      )}

      {/* Summary Cards */}
      <SummaryCards accounts={visibleAccounts} />

      {/* Accounts by Institution */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white mb-4">Your Accounts</h2>
        
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <InstitutionGroup
              key={item.id}
              item={item}
              onSync={handleSyncItem}
              onReconnect={handleReconnect}
              onRemove={handleRemoveItem}
              onEditAccount={handleEditAccount}
              onDeleteAccount={handleDeleteAccount}
              onToggleAccountVisibility={handleToggleAccountVisibility}
            />
          ))
        ) : (
          <Card variant="glass" className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-dark-800 rounded-2xl flex items-center justify-center">
              <Building2 className="w-10 h-10 text-dark-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No accounts connected</h3>
            <p className="text-dark-400 mb-6 max-w-md mx-auto">
              Connect your bank accounts to automatically track transactions, monitor balances, and get AI-powered financial insights.
            </p>
            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowConnectModal(true)}
            >
              Connect Your First Account
            </Button>
          </Card>
        )}
      </div>

      {/* Connect Bank Modal */}
      <ConnectBankModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnect={handleConnect}
      />
    </motion.div>
  );
}