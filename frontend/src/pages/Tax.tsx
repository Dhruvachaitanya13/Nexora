/* ============================================
   FINTRACK AI - TAX CENTER PAGE
   Comprehensive tax management for freelancers
   ============================================ */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator, Calendar, DollarSign, TrendingUp, FileText, Download,
  AlertTriangle, CheckCircle, Clock, ChevronRight, ChevronDown, ChevronUp,
  Info, HelpCircle, Sparkles, Brain, Target, Receipt, Building2, Home,
  Car, Briefcase, Plane, Utensils, Wifi, Phone, Heart, GraduationCap,
  Shield, Banknote, ArrowUpRight, Bell, RefreshCw, Plus, Edit3, Check,
  X, MoreHorizontal, Flag, Zap, Copy, CreditCard, ChevronLeft
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// ============================================
// TYPES
// ============================================

interface QuarterlyTax {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  period: string;
  dueDate: string;
  estimatedTax: number;
  amountPaid: number;
  amountDue: number;
  status: 'paid' | 'partial' | 'due' | 'overdue' | 'upcoming';
  paymentDate?: string;
  serialNumber?: string;
}

interface TaxDeduction {
  id: string;
  category: string;
  scheduleCLine: string;
  description: string;
  amount: number;
  transactionCount: number;
  icon: React.ElementType;
  color: string;
  limit?: number;
  notes?: string;
}

interface TaxDeadline {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  type: 'federal' | 'state' | 'local';
  form?: string;
  status: 'upcoming' | 'due_soon' | 'overdue' | 'completed';
  isEstimatedPayment: boolean;
}

interface TaxRecommendation {
  id: string;
  type: 'deduction' | 'credit' | 'strategy' | 'warning';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSavings?: number;
  actionSteps: string[];
  deadline?: string;
}

// ============================================
// MOCK DATA
// ============================================

const currentYear = 2024;

const mockQuarterlyTaxesInitial: QuarterlyTax[] = [
  {
    quarter: 'Q1', period: 'Jan 1 – Mar 31', dueDate: '2024-04-15',
    estimatedTax: 3250, amountPaid: 3250, amountDue: 0,
    status: 'paid', paymentDate: '2024-04-10', serialNumber: 'IRS-2024-Q1-789456',
  },
  {
    quarter: 'Q2', period: 'Apr 1 – Jun 30', dueDate: '2024-06-17',
    estimatedTax: 3500, amountPaid: 3500, amountDue: 0,
    status: 'paid', paymentDate: '2024-06-15', serialNumber: 'IRS-2024-Q2-123789',
  },
  {
    quarter: 'Q3', period: 'Jul 1 – Sep 30', dueDate: '2024-09-16',
    estimatedTax: 3800, amountPaid: 2000, amountDue: 1800,
    status: 'partial', paymentDate: '2024-09-10',
  },
  {
    quarter: 'Q4', period: 'Oct 1 – Dec 31', dueDate: '2025-01-15',
    estimatedTax: 4000, amountPaid: 0, amountDue: 4000, status: 'upcoming',
  },
];

const mockDeductions: TaxDeduction[] = [
  { id: '1', category: 'Home Office', scheduleCLine: 'Line 30', description: 'Home office expenses (simplified method)', amount: 1500, transactionCount: 12, icon: Home, color: 'violet', limit: 1500, notes: 'Using simplified method at $5/sq ft for 300 sq ft' },
  { id: '2', category: 'Software & Subscriptions', scheduleCLine: 'Line 18', description: 'Business software and tools', amount: 2847.88, transactionCount: 45, icon: Wifi, color: 'blue' },
  { id: '3', category: 'Professional Services', scheduleCLine: 'Line 17', description: 'Legal, accounting, and professional fees', amount: 1200, transactionCount: 8, icon: Briefcase, color: 'indigo' },
  { id: '4', category: 'Travel', scheduleCLine: 'Line 24a', description: 'Business travel expenses', amount: 3245.50, transactionCount: 23, icon: Plane, color: 'cyan' },
  { id: '5', category: 'Meals', scheduleCLine: 'Line 24b', description: 'Business meals (50% deductible)', amount: 892.30, transactionCount: 34, icon: Utensils, color: 'orange', notes: 'Actual: $1,784.60 — 50% deductible' },
  { id: '6', category: 'Vehicle Expenses', scheduleCLine: 'Line 9', description: 'Business mileage and car expenses', amount: 1876.25, transactionCount: 156, icon: Car, color: 'emerald', notes: '2,845 miles at $0.67/mile' },
  { id: '7', category: 'Phone & Internet', scheduleCLine: 'Line 25', description: 'Business portion of phone and internet', amount: 960, transactionCount: 12, icon: Phone, color: 'slate', notes: '80% business use' },
  { id: '8', category: 'Health Insurance', scheduleCLine: 'Form 1040 Line 17', description: 'Self-employed health insurance', amount: 7200, transactionCount: 12, icon: Heart, color: 'red' },
  { id: '9', category: 'Education', scheduleCLine: 'Line 27a', description: 'Professional development and courses', amount: 1499, transactionCount: 5, icon: GraduationCap, color: 'purple' },
  { id: '10', category: 'Insurance', scheduleCLine: 'Line 15', description: 'Business insurance premiums', amount: 840, transactionCount: 4, icon: Shield, color: 'teal' },
];

const mockDeadlines: TaxDeadline[] = [
  { id: '1', name: 'Q4 Estimated Tax Payment', description: 'Fourth quarter estimated tax payment due', dueDate: '2025-01-15', type: 'federal', form: 'Form 1040-ES', status: 'upcoming', isEstimatedPayment: true },
  { id: '2', name: 'Annual Tax Return', description: 'File Form 1040 with Schedule C', dueDate: '2025-04-15', type: 'federal', form: 'Form 1040, Schedule C', status: 'upcoming', isEstimatedPayment: false },
  { id: '3', name: 'Illinois State Tax Return', description: 'File IL-1040 state tax return', dueDate: '2025-04-15', type: 'state', form: 'IL-1040', status: 'upcoming', isEstimatedPayment: false },
  { id: '4', name: 'Q1 2025 Estimated Tax', description: 'First quarter estimated tax payment', dueDate: '2025-04-15', type: 'federal', form: 'Form 1040-ES', status: 'upcoming', isEstimatedPayment: true },
];

const mockRecommendations: TaxRecommendation[] = [
  { id: '1', type: 'deduction', priority: 'high', title: 'Maximize SEP-IRA Contribution', description: 'You can contribute up to $15,600 more to your SEP-IRA before the tax deadline to reduce taxable income.', potentialSavings: 3744, actionSteps: ['Calculate maximum contribution (25% of net SE earnings)', 'Open SEP-IRA if not already done', 'Make contribution before April 15, 2025'], deadline: '2025-04-15' },
  { id: '2', type: 'strategy', priority: 'high', title: 'Consider Equipment Purchases', description: 'End-of-year equipment purchases can be fully deducted under Section 179.', potentialSavings: 2500, actionSteps: ['Review needed equipment (computer, office furniture)', 'Purchase before December 31', 'Keep receipts for documentation'], deadline: '2024-12-31' },
  { id: '3', type: 'warning', priority: 'high', title: 'Q4 Estimated Tax Due Soon', description: 'Your Q4 estimated tax payment of $4,000 is due January 15, 2025. Late payment will incur penalties.', actionSteps: ['Review your Q4 income and expenses', 'Calculate final Q4 estimated payment', 'Schedule payment through IRS Direct Pay'], deadline: '2025-01-15' },
  { id: '4', type: 'deduction', priority: 'medium', title: 'Track Business Mileage', description: 'You may be underreporting business mileage. The 2024 rate is $0.67/mile.', potentialSavings: 800, actionSteps: ['Install a mileage tracking app', 'Log all business-related trips', 'Keep a mileage log for IRS documentation'] },
  { id: '5', type: 'credit', priority: 'medium', title: 'Qualified Business Income Deduction', description: 'You may qualify for the 20% QBI deduction under Section 199A.', potentialSavings: 4200, actionSteps: ['Verify your business qualifies as a QBI', 'Calculate deduction with tax software', 'Include on Form 8995 or 8995-A'] },
];

const extraRecsPool: TaxRecommendation[] = [
  { id: '6', type: 'strategy', priority: 'medium', title: 'Health Savings Account (HSA)', description: 'Max out HSA contributions ($4,150 for 2024) to reduce taxable income and save for medical expenses tax-free.', potentialSavings: 996, actionSteps: ['Confirm you have an HSA-eligible health plan', 'Contribute up to $4,150 for 2024', 'Use HSA funds for qualifying medical expenses'] },
  { id: '7', type: 'credit', priority: 'low', title: 'Energy Efficiency Credits', description: 'Home office improvements such as insulation or windows may qualify for energy efficiency tax credits up to $1,200.', potentialSavings: 500, actionSteps: ['Review IRS Form 5695 requirements', 'Document all qualifying improvements with receipts', 'Claim the credit on your tax return'] },
  { id: '8', type: 'deduction', priority: 'medium', title: 'Professional Memberships & Dues', description: 'Annual dues paid to professional organizations and trade associations are fully deductible as a business expense.', potentialSavings: 350, actionSteps: ['Compile all membership receipts for 2024', 'Categorize under Line 27a (Other Expenses)', 'Document the business purpose for each'] },
];

const incomeExpenseData = [
  { month: 'Jan', income: 8500, expenses: 3200, tax: 1275 },
  { month: 'Feb', income: 9200, expenses: 2800, tax: 1530 },
  { month: 'Mar', income: 7800, expenses: 3500, tax: 1035 },
  { month: 'Apr', income: 11500, expenses: 4200, tax: 1745 },
  { month: 'May', income: 9800, expenses: 3100, tax: 1605 },
  { month: 'Jun', income: 10200, expenses: 3400, tax: 1632 },
  { month: 'Jul', income: 8900, expenses: 2900, tax: 1440 },
  { month: 'Aug', income: 12000, expenses: 4500, tax: 1800 },
  { month: 'Sep', income: 10500, expenses: 3800, tax: 1605 },
  { month: 'Oct', income: 9500, expenses: 3200, tax: 1512 },
  { month: 'Nov', income: 11000, expenses: 3600, tax: 1776 },
  { month: 'Dec', income: 13500, expenses: 4800, tax: 2088 },
];

// ============================================
// ANIMATIONS
// ============================================

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
};

// ============================================
// TOAST
// ============================================

function Toast({ message, type, onDone }: { message: string; type: 'success' | 'info' | 'error'; onDone: () => void }) {
  const bg = type === 'success' ? 'bg-emerald-900/90 border-emerald-700/60 text-emerald-300'
    : type === 'error' ? 'bg-red-900/90 border-red-700/60 text-red-300'
    : 'bg-blue-900/90 border-blue-700/60 text-blue-300';
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertTriangle : Info;
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.95 }}
      className={cn('fixed top-6 right-6 z-[300] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium', bg)}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {message}
    </motion.div>
  );
}

// ============================================
// SCHEDULE C MODAL
// ============================================

function ScheduleCModal({ onClose }: { onClose: () => void }) {
  const totalDeductions = mockDeductions.reduce((s, d) => s + d.amount, 0);
  const grossIncome = incomeExpenseData.reduce((s, d) => s + d.income, 0);
  const netProfit = grossIncome - totalDeductions;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.22 }}
        className="w-full max-w-2xl bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800 bg-gradient-to-r from-primary-500/5 to-purple-500/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Schedule C — {currentYear}</h2>
              <p className="text-xs text-dark-400">Profit or Loss from Business</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          <div className="flex items-center justify-between py-3 px-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <span className="font-medium text-white">Gross Income (Line 1)</span>
            <span className="font-bold text-emerald-400">{formatCurrency(grossIncome)}</span>
          </div>

          <div className="border border-dark-700 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-dark-800/60 border-b border-dark-700">
              <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Deductions</span>
            </div>
            {mockDeductions.map((d, i) => (
              <div key={d.id} className={cn('flex items-center justify-between px-4 py-3 text-sm', i % 2 === 0 ? 'bg-dark-800/20' : '')}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', `bg-${d.color}-500/20 text-${d.color}-400`)}>
                    <d.icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-white">{d.category}</span>
                    <span className="ml-2 text-xs text-dark-500">({d.scheduleCLine})</span>
                  </div>
                </div>
                <span className="text-rose-400 font-medium">−{formatCurrency(d.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-dark-800/50 border-t border-dark-700">
              <span className="font-medium text-white">Total Deductions</span>
              <span className="font-bold text-rose-400">−{formatCurrency(totalDeductions)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 px-4 bg-primary-500/10 border border-primary-500/30 rounded-xl">
            <span className="font-semibold text-white">Net Profit (Line 31)</span>
            <span className={cn('font-bold text-xl', netProfit >= 0 ? 'text-primary-400' : 'text-red-400')}>{formatCurrency(netProfit)}</span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-dark-800 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button variant="primary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Download PDF</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// TAX CALCULATOR MODAL
// ============================================

function TaxCalculatorModal({ onClose }: { onClose: () => void }) {
  const defaultIncome = incomeExpenseData.reduce((s, d) => s + d.income, 0);
  const defaultDeductions = mockDeductions.reduce((s, d) => s + d.amount, 0);
  const [income, setIncome] = useState(defaultIncome);
  const [deductions, setDeductions] = useState(defaultDeductions);

  const netProfit = Math.max(0, income - deductions);
  const seTax = netProfit * 0.9235 * 0.153;
  const deductibleSE = seTax / 2;
  const agi = netProfit - deductibleSE;
  const stdDeduction = 14600;
  const taxableIncome = Math.max(0, agi - stdDeduction);
  const federalTax = taxableIncome > 100525 ? (taxableIncome - 100525) * 0.22 + 14768
    : taxableIncome > 47150 ? (taxableIncome - 47150) * 0.12 + 5655
    : taxableIncome * 0.10;
  const totalTax = seTax + federalTax;
  const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
  const quarterlyEst = totalTax / 4;

  const rows = [
    { label: 'Gross Business Income', value: income, color: 'emerald' },
    { label: 'Total Deductions', value: -deductions, color: 'rose' },
    { label: 'Net Profit', value: netProfit, color: 'white' },
    { label: 'Self-Employment Tax (15.3%)', value: -seTax, color: 'amber' },
    { label: 'Deductible SE Tax (½)', value: deductibleSE, color: 'emerald' },
    { label: 'Adjusted Gross Income', value: agi, color: 'white' },
    { label: 'Standard Deduction', value: -stdDeduction, color: 'rose' },
    { label: 'Taxable Income', value: taxableIncome, color: 'white' },
    { label: 'Estimated Federal Tax', value: -federalTax, color: 'amber' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.22 }}
        className="w-full max-w-xl bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Tax Calculator {currentYear}</h2>
              <p className="text-xs text-dark-400">Estimated self-employment taxes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Annual Gross Income', value: income, setter: setIncome, color: 'emerald' },
              { label: 'Total Deductions', value: deductions, setter: setDeductions, color: 'rose' },
            ].map(({ label, value, setter, color }) => (
              <div key={label}>
                <label className="block text-xs text-dark-400 mb-1.5">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">$</span>
                  <input
                    type="number"
                    value={value}
                    onChange={e => setter(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary-500/60 focus:ring-1 focus:ring-primary-500/20 transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="border border-dark-700 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-dark-800/60 border-b border-dark-700">
              <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Tax Breakdown</span>
            </div>
            {rows.map((row, i) => (
              <div key={row.label} className={cn('flex items-center justify-between px-4 py-2.5 text-sm', i % 2 === 0 ? 'bg-dark-800/20' : '')}>
                <span className="text-dark-300">{row.label}</span>
                <span className={cn('font-medium', row.color === 'emerald' ? 'text-emerald-400' : row.color === 'rose' ? 'text-rose-400' : row.color === 'amber' ? 'text-amber-400' : 'text-white')}>
                  {row.value < 0 ? `−${formatCurrency(Math.abs(row.value))}` : formatCurrency(row.value)}
                </span>
              </div>
            ))}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Tax Due', value: formatCurrency(totalTax), sub: 'SE + Federal', color: 'amber' },
              { label: 'Effective Rate', value: `${effectiveRate.toFixed(1)}%`, sub: 'Of gross income', color: 'purple' },
              { label: 'Est. Quarterly', value: formatCurrency(quarterlyEst), sub: 'Per payment', color: 'blue' },
            ].map(s => (
              <div key={s.label} className={cn('p-3 rounded-xl border text-center', `bg-${s.color}-500/10 border-${s.color}-500/30`)}>
                <p className={cn('text-lg font-bold', `text-${s.color}-400`)}>{s.value}</p>
                <p className="text-xs text-white font-medium mt-0.5">{s.label}</p>
                <p className="text-xs text-dark-500">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-dark-800 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button variant="primary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export Estimate</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// PAYMENT MODAL
// ============================================

function PaymentModal({ quarter, onClose, onPaid }: {
  quarter: QuarterlyTax;
  onClose: () => void;
  onPaid: (q: QuarterlyTax, serial: string) => void;
}) {
  const [step, setStep] = useState<'method' | 'confirm' | 'success'>('method');
  const [method, setMethod] = useState<'direct' | 'card' | 'check'>('direct');
  const [processing, setProcessing] = useState(false);
  const generatedSerial = `IRS-${currentYear}-${quarter.quarter}-${Math.floor(100000 + Math.random() * 900000)}`;

  const methods = [
    { id: 'direct' as const, label: 'IRS Direct Pay', desc: 'Free — bank account debit', icon: Banknote, recommended: true },
    { id: 'card' as const, label: 'Debit / Credit Card', desc: '1.87% processing fee', icon: CreditCard, recommended: false },
    { id: 'check' as const, label: 'Mail a Check', desc: 'Allow 7–10 business days', icon: FileText, recommended: false },
  ];

  const handleConfirm = async () => {
    setProcessing(true);
    await new Promise(r => setTimeout(r, 1800));
    setProcessing(false);
    setStep('success');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && step !== 'success') onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.22 }}
        className="w-full max-w-md bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">{quarter.quarter} Tax Payment</h2>
              <p className="text-xs text-dark-400">{quarter.period}</p>
            </div>
          </div>
          {step !== 'success' && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
          )}
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 'method' && (
              <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
                  <p className="text-xs text-amber-400/70 mb-1">Amount Due</p>
                  <p className="text-3xl font-bold text-amber-400">{formatCurrency(quarter.amountDue)}</p>
                  <p className="text-xs text-dark-500 mt-1">Due {formatDate(quarter.dueDate, 'long')}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-dark-300 mb-3">Select payment method</p>
                  {methods.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={cn('w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all', method === m.id ? 'border-primary-500/60 bg-primary-500/10' : 'border-dark-700 bg-dark-800/30 hover:border-dark-600')}
                    >
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', method === m.id ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-700 text-dark-400')}>
                        <m.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{m.label}</span>
                          {m.recommended && <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Recommended</span>}
                        </div>
                        <p className="text-xs text-dark-500">{m.desc}</p>
                      </div>
                      {method === m.id && <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
                <Button variant="primary" fullWidth onClick={() => setStep('confirm')} rightIcon={<ChevronRight className="w-4 h-4" />}>
                  Continue
                </Button>
              </motion.div>
            )}

            {step === 'confirm' && (
              <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Payment Amount', value: formatCurrency(quarter.amountDue), bold: true },
                    { label: 'Tax Period', value: quarter.period },
                    { label: 'Due Date', value: formatDate(quarter.dueDate, 'long') },
                    { label: 'Payment Method', value: methods.find(m => m.id === method)?.label || '' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-dark-800">
                      <span className="text-dark-400">{row.label}</span>
                      <span className={cn('text-white', row.bold && 'font-bold text-base text-primary-400')}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-dark-500 leading-relaxed">By clicking Pay Now, you authorize a payment of {formatCurrency(quarter.amountDue)} to the IRS for {quarter.quarter} {currentYear} estimated taxes.</p>
                <div className="flex gap-3">
                  <Button variant="secondary" size="sm" onClick={() => setStep('method')} leftIcon={<ChevronLeft className="w-4 h-4" />}>Back</Button>
                  <Button variant="primary" fullWidth onClick={handleConfirm} disabled={processing}>
                    {processing ? (
                      <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Processing...</span>
                    ) : (
                      <span className="flex items-center gap-2"><DollarSign className="w-4 h-4" />Pay {formatCurrency(quarter.amountDue)}</span>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 py-2">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                  className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center"
                >
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Payment Submitted!</h3>
                  <p className="text-sm text-dark-400">{formatCurrency(quarter.amountDue)} processed via {methods.find(m => m.id === method)?.label}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-left">
                  <p className="text-xs text-emerald-400/70 mb-1">Serial Number</p>
                  <p className="text-sm font-mono text-emerald-400">{generatedSerial}</p>
                </div>
                <Button variant="primary" fullWidth onClick={() => onPaid(quarter, generatedSerial)}>
                  Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// SUMMARY CARDS
// ============================================

function TaxSummaryCards() {
  const totalIncome = incomeExpenseData.reduce((s, d) => s + d.income, 0);
  const totalDeductions = mockDeductions.reduce((s, d) => s + d.amount, 0);
  const estimatedTax = mockQuarterlyTaxesInitial.reduce((s, q) => s + q.estimatedTax, 0);
  const taxPaid = mockQuarterlyTaxesInitial.reduce((s, q) => s + q.amountPaid, 0);

  const stats = [
    { label: 'Gross Income', value: formatCurrency(totalIncome), sub: 'YTD', icon: TrendingUp, color: 'emerald', badge: '+18.5%', up: true },
    { label: 'Total Deductions', value: formatCurrency(totalDeductions), sub: `${mockDeductions.length} categories`, icon: Receipt, color: 'purple', badge: '+$2,340', up: true },
    { label: 'Estimated Tax', value: formatCurrency(estimatedTax), sub: 'Annual', icon: Calculator, color: 'amber', badge: `${formatCurrency(taxPaid)} paid`, up: false },
    { label: 'Tax Savings', value: formatCurrency(totalDeductions * 0.24), sub: 'From deductions', icon: Sparkles, color: 'cyan', badge: 'Est. 24% rate', up: true },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <motion.div key={s.label} variants={itemVariants} custom={i} whileHover={{ y: -2, transition: { duration: 0.15 } }}>
          <Card variant="glass" className="relative overflow-hidden cursor-default">
            <div className="absolute -right-3 -bottom-3 opacity-5"><s.icon className="w-20 h-20" /></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', `bg-${s.color}-500/20 text-${s.color}-400`)}>
                  <s.icon className="w-5 h-5" />
                </div>
                <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', s.up ? 'bg-emerald-500/15 text-emerald-400' : 'bg-dark-700 text-dark-400')}>{s.badge}</span>
              </div>
              <p className="text-sm text-dark-400 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-dark-500 mt-1">{s.sub}</p>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// QUARTERLY PAYMENTS
// ============================================

function QuarterlyPaymentsCard({ quarters, onPay, onCopySerial }: {
  quarters: QuarterlyTax[];
  onPay: (q: QuarterlyTax) => void;
  onCopySerial: (text: string) => void;
}) {
  const [expandedQuarter, setExpandedQuarter] = useState<string | null>(null);
  const totalDue = quarters.reduce((s, q) => s + q.amountDue, 0);

  const getConfig = (status: string) => ({
    paid:     { color: 'emerald', icon: CheckCircle, label: 'Paid' },
    partial:  { color: 'amber',   icon: Clock,        label: 'Partial' },
    due:      { color: 'red',     icon: AlertTriangle, label: 'Due Now' },
    overdue:  { color: 'red',     icon: AlertTriangle, label: 'Overdue' },
    upcoming: { color: 'blue',    icon: Calendar,      label: 'Upcoming' },
  }[status] || { color: 'gray', icon: HelpCircle, label: status });

  return (
    <Card variant="glass" className="h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Quarterly Payments</h3>
          <p className="text-sm text-dark-400 mt-0.5">Tax Year {currentYear}</p>
        </div>
        {totalDue > 0 && (
          <div className="text-right">
            <p className="text-xs text-dark-400">Total Due</p>
            <p className="text-lg font-bold text-amber-400">{formatCurrency(totalDue)}</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {quarters.map(q => {
          const cfg = getConfig(q.status);
          const isOpen = expandedQuarter === q.quarter;
          const pct = Math.min(100, (q.amountPaid / q.estimatedTax) * 100);

          return (
            <motion.div key={q.quarter} layout className={cn('border rounded-xl overflow-hidden', q.status === 'overdue' || q.status === 'due' ? 'border-red-500/30 bg-red-500/5' : q.status === 'partial' ? 'border-amber-500/30 bg-amber-500/5' : 'border-dark-700 bg-dark-800/30')}>
              <button onClick={() => setExpandedQuarter(isOpen ? null : q.quarter)} className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm', `bg-${cfg.color}-500/20 text-${cfg.color}-400`)}>{q.quarter}</div>
                  <div className="text-left">
                    <p className="font-medium text-white text-sm">{q.period}</p>
                    <p className="text-xs text-dark-500">Due {formatDate(q.dueDate, 'long')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold text-white text-sm">{formatCurrency(q.estimatedTax)}</p>
                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', `text-${cfg.color}-400`)}>
                      <cfg.icon className="w-3 h-3" />{cfg.label}
                    </span>
                  </div>
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4 text-dark-400" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                    className="border-t border-dark-700/60"
                  >
                    <div className="p-4 space-y-4">
                      {/* Progress */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-dark-400">Payment Progress</span>
                          <span className="text-white font-medium">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.1 }} className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500')} />
                        </div>
                      </div>

                      {/* Detail Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-dark-800/50 rounded-lg">
                          <p className="text-xs text-dark-500 mb-1">Estimated Tax</p>
                          <p className="font-semibold text-white text-sm">{formatCurrency(q.estimatedTax)}</p>
                        </div>
                        <div className="p-3 bg-dark-800/50 rounded-lg">
                          <p className="text-xs text-dark-500 mb-1">Amount Paid</p>
                          <p className="font-semibold text-emerald-400 text-sm">{formatCurrency(q.amountPaid)}</p>
                        </div>
                        {q.paymentDate && (
                          <div className="p-3 bg-dark-800/50 rounded-lg col-span-2">
                            <p className="text-xs text-dark-500 mb-1">Payment Date</p>
                            <p className="font-medium text-white text-sm">{formatDate(q.paymentDate, 'long')}</p>
                          </div>
                        )}
                      </div>

                      {/* Serial Number */}
                      {q.serialNumber && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                          <div>
                            <p className="text-xs text-emerald-400/70 mb-0.5">Serial #</p>
                            <p className="text-sm font-mono text-emerald-400">{q.serialNumber}</p>
                          </div>
                          <button
                            onClick={() => onCopySerial(q.serialNumber!)}
                            className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors active:scale-95"
                            title="Copy serial number"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </motion.div>
                      )}

                      {/* Pay Button */}
                      {q.amountDue > 0 && (
                        <Button
                          variant={q.status === 'overdue' || q.status === 'due' ? 'danger' : 'primary'}
                          fullWidth
                          leftIcon={<DollarSign className="w-4 h-4" />}
                          onClick={() => onPay(q)}
                        >
                          Pay {formatCurrency(q.amountDue)} Now
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

// ============================================
// DEDUCTIONS
// ============================================

function DeductionsCard() {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalDeductions = mockDeductions.reduce((s, d) => s + d.amount, 0);

  const handleViewAll = () => {
    setExpanded(true);
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  };

  return (
    <Card variant="glass" className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h3 className="text-lg font-semibold text-white">Tax Deductions</h3>
          <p className="text-sm text-dark-400 mt-0.5">Schedule C Categories</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-dark-400">Total</p>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(totalDeductions)}</p>
        </div>
      </div>

      <div
        className={cn('space-y-2 overflow-y-auto flex-1 transition-all duration-500 pr-1', expanded ? 'max-h-[480px]' : 'max-h-[300px]')}
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
      >
        {mockDeductions.map((d, i) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            whileHover={{ x: 2, transition: { duration: 0.15 } }}
            className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/30 hover:bg-dark-800/60 border border-transparent hover:border-dark-700/60 transition-all group cursor-default"
          >
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', `bg-${d.color}-500/20 text-${d.color}-400`)}>
              <d.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-white text-sm truncate">{d.category}</h4>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-dark-700 text-dark-400 flex-shrink-0">{d.scheduleCLine}</span>
              </div>
              {d.notes ? (
                <p className="text-xs text-dark-500 truncate">{d.notes}</p>
              ) : (
                <p className="text-xs text-dark-500 truncate">{d.description}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-white text-sm">{formatCurrency(d.amount)}</p>
              <p className="text-xs text-dark-600">{d.transactionCount} txns</p>
            </div>
          </motion.div>
        ))}
        <div ref={scrollRef} />
      </div>

      <button
        onClick={expanded ? () => setExpanded(false) : handleViewAll}
        className="w-full mt-3 py-2 text-sm text-primary-400 hover:text-primary-300 flex items-center justify-center gap-1 transition-colors flex-shrink-0"
      >
        {expanded ? <><ChevronUp className="w-4 h-4" />Show Less</> : <><ChevronDown className="w-4 h-4" />View All {mockDeductions.length} Categories</>}
      </button>
    </Card>
  );
}

// ============================================
// RECOMMENDATIONS
// ============================================

function RecommendationsCard({ loadingMore, onLoadMore, extraRecs, dismissedIds, onDismiss }: {
  loadingMore: boolean;
  onLoadMore: () => void;
  extraRecs: TaxRecommendation[];
  dismissedIds: string[];
  onDismiss: (id: string) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Record<string, number[]>>({});

  const allRecs = [...mockRecommendations, ...extraRecs].filter(r => !dismissedIds.includes(r.id));

  const toggleExpand = (id: string) => setExpandedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleStep = (recId: string, idx: number) => setCompletedSteps(p => {
    const steps = p[recId] || [];
    return { ...p, [recId]: steps.includes(idx) ? steps.filter(i => i !== idx) : [...steps, idx] };
  });

  const typeIcon = (t: string) => ({ deduction: Receipt, credit: DollarSign, strategy: Target, warning: AlertTriangle }[t] || Info);
  const priorityBadge = (p: string) => ({
    high:   { bg: 'bg-red-500/20',    text: 'text-red-400',    label: 'High' },
    medium: { bg: 'bg-amber-500/20',  text: 'text-amber-400',  label: 'Medium' },
    low:    { bg: 'bg-blue-500/20',   text: 'text-blue-400',   label: 'Low' },
  }[p] || { bg: 'bg-dark-700', text: 'text-dark-400', label: p });

  return (
    <Card variant="glass">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">AI Tax Recommendations</h3>
            <p className="text-xs text-dark-400">{allRecs.length} personalized strategies</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {allRecs.map((rec, i) => {
            const TypeIcon = typeIcon(rec.type);
            const pb = priorityBadge(rec.priority);
            const isOpen = expandedIds.includes(rec.id);
            const done = completedSteps[rec.id] || [];
            const allDone = rec.actionSteps.every((_, idx) => done.includes(idx));

            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                className={cn('rounded-xl border overflow-hidden', rec.type === 'warning' ? 'bg-amber-500/5 border-amber-500/30' : 'bg-dark-800/30 border-dark-700/50')}
              >
                {/* Header row */}
                <div className="flex items-start gap-3 p-4">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', rec.type === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-primary-500/20 text-primary-400')}>
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-medium text-white text-sm">{rec.title}</h4>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', pb.bg, pb.text)}>{pb.label}</span>
                      {allDone && <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Done</span>}
                    </div>
                    <p className="text-xs text-dark-400 leading-relaxed">{rec.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {rec.potentialSavings && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                          <Sparkles className="w-3 h-3" />Save {formatCurrency(rec.potentialSavings)}
                        </span>
                      )}
                      {rec.deadline && (
                        <span className="inline-flex items-center gap-1 text-xs text-dark-500">
                          <Clock className="w-3 h-3" />Due {formatDate(rec.deadline, 'short')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleExpand(rec.id)}
                      className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-colors"
                      title={isOpen ? 'Collapse' : 'View action steps'}
                    >
                      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-4 h-4" />
                      </motion.div>
                    </button>
                    <button
                      onClick={() => onDismiss(rec.id)}
                      className="p-1.5 rounded-lg text-dark-500 hover:text-dark-300 hover:bg-white/5 transition-colors"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expandable action steps */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                      className="border-t border-dark-700/50"
                    >
                      <div className="p-4 pt-3 space-y-2">
                        <p className="text-xs text-dark-500 font-medium mb-2 uppercase tracking-wider">Action Steps</p>
                        {rec.actionSteps.map((step, idx) => (
                          <button
                            key={idx}
                            onClick={() => toggleStep(rec.id, idx)}
                            className={cn('w-full flex items-start gap-3 text-left text-sm p-2.5 rounded-lg transition-colors', done.includes(idx) ? 'bg-emerald-500/10 text-emerald-300' : 'hover:bg-white/5 text-dark-300')}
                          >
                            <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors', done.includes(idx) ? 'border-emerald-500 bg-emerald-500' : 'border-dark-600')}>
                              {done.includes(idx) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={cn(done.includes(idx) && 'line-through opacity-60')}>{step}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {allRecs.length === 0 && (
          <div className="text-center py-8 text-dark-500">
            <Brain className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">All recommendations dismissed.</p>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        fullWidth
        className="mt-4"
        leftIcon={loadingMore ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        onClick={onLoadMore}
        disabled={loadingMore || extraRecs.length >= extraRecsPool.length}
      >
        {loadingMore ? 'Generating Recommendations...' : extraRecs.length >= extraRecsPool.length ? 'All Recommendations Loaded' : 'Get More AI Recommendations'}
      </Button>
    </Card>
  );
}

// ============================================
// DEADLINES
// ============================================

function DeadlinesCard({ completedIds, onComplete, remindedIds, onRemind }: {
  completedIds: string[];
  onComplete: (id: string) => void;
  remindedIds: string[];
  onRemind: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getDaysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

  const typeColor = (t: string) => t === 'federal' ? 'blue' : t === 'state' ? 'purple' : 'gray';

  return (
    <Card variant="glass">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Upcoming Deadlines</h3>
          <p className="text-sm text-dark-400 mt-0.5">Important tax dates</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-primary-500/20 text-primary-400 font-medium">
          {mockDeadlines.length - completedIds.length} remaining
        </span>
      </div>

      <div className="space-y-2">
        {mockDeadlines.map((dl, i) => {
          const days = getDaysUntil(dl.dueDate);
          const isDone = completedIds.includes(dl.id);
          const isExpanded = expandedId === dl.id;
          const tc = typeColor(dl.type);

          const urgency = isDone ? 'border-emerald-500/20 bg-emerald-500/5'
            : days <= 7 && days > 0 ? 'border-amber-500/30 bg-amber-500/5'
            : days <= 0 ? 'border-red-500/30 bg-red-500/5'
            : 'border-dark-700/60 bg-dark-800/20';

          const StatusIcon = isDone ? CheckCircle : days <= 7 ? Clock : Calendar;
          const statusColor = isDone ? 'text-emerald-400' : days <= 0 ? 'text-red-400' : days <= 7 ? 'text-amber-400' : 'text-blue-400';

          return (
            <motion.div
              key={dl.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: isDone ? 0.6 : 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn('rounded-xl border overflow-hidden transition-all', urgency)}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : dl.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', isDone ? 'bg-emerald-500/20' : days <= 7 ? 'bg-amber-500/20' : 'bg-blue-500/20')}>
                  <StatusIcon className={cn('w-5 h-5', statusColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={cn('font-medium text-sm', isDone ? 'text-dark-400 line-through' : 'text-white')}>{dl.name}</h4>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full capitalize', `bg-${tc}-500/20 text-${tc}-400`)}>{dl.type}</span>
                  </div>
                  <p className="text-xs text-dark-500 mt-0.5">{formatDate(dl.dueDate, 'long')}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn('text-xs font-medium', statusColor)}>
                    {isDone ? 'Completed' : days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                  </span>
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4 text-dark-500" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                    className="border-t border-dark-700/50"
                  >
                    <div className="p-4 space-y-3">
                      <p className="text-sm text-dark-400">{dl.description}</p>
                      {dl.form && (
                        <div className="flex items-center gap-2 text-xs text-dark-500 p-2 bg-dark-800/50 rounded-lg">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Form required: <span className="text-dark-300 font-medium">{dl.form}</span></span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          variant={isDone ? 'secondary' : 'ghost'}
                          size="sm"
                          leftIcon={isDone ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Check className="w-3.5 h-3.5" />}
                          onClick={() => !isDone && onComplete(dl.id)}
                          className={isDone ? 'opacity-60 cursor-default' : ''}
                        >
                          {isDone ? 'Completed' : 'Mark Complete'}
                        </Button>
                        <Button
                          variant={remindedIds.includes(dl.id) ? 'secondary' : 'ghost'}
                          size="sm"
                          leftIcon={<Bell className={cn('w-3.5 h-3.5', remindedIds.includes(dl.id) && 'text-primary-400')} />}
                          onClick={() => !remindedIds.includes(dl.id) && onRemind(dl.id)}
                          className={remindedIds.includes(dl.id) ? 'opacity-60 cursor-default' : ''}
                        >
                          {remindedIds.includes(dl.id) ? 'Reminder Set' : 'Set Reminder'}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

// ============================================
// INCOME/EXPENSE CHART
// ============================================

function IncomeExpenseChart() {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 shadow-xl text-sm">
        <p className="text-white font-semibold mb-2">{label}</p>
        <p className="text-emerald-400">Income: {formatCurrency(payload[0]?.value || 0)}</p>
        <p className="text-rose-400">Expenses: {formatCurrency(payload[1]?.value || 0)}</p>
        <p className="text-amber-400">Est. Tax: {formatCurrency(payload[2]?.value || 0)}</p>
      </div>
    );
  };

  return (
    <Card variant="glass">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Income, Expenses & Tax</h3>
          <p className="text-sm text-dark-400 mt-0.5">{currentYear} Monthly Breakdown</p>
        </div>
        <div className="flex items-center gap-4">
          {[{ color: 'bg-emerald-500', label: 'Income' }, { color: 'bg-rose-500', label: 'Expenses' }, { color: 'bg-amber-500', label: 'Tax' }].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={cn('w-2.5 h-2.5 rounded-full', l.color)} />
              <span className="text-xs text-dark-400">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={incomeExpenseData} barGap={2} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="month" stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} dy={8} />
            <YAxis stroke="#475569" tickLine={false} axisLine={false} tickFormatter={v => `$${v / 1000}k`} tick={{ fontSize: 11 }} dx={-4} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" fill="#f43f5e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="tax" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ============================================
// MAIN TAX COMPONENT
// ============================================

export default function Tax() {
  const [showScheduleC, setShowScheduleC] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [payingQuarter, setPayingQuarter] = useState<QuarterlyTax | null>(null);
  const [quarters, setQuarters] = useState<QuarterlyTax[]>(mockQuarterlyTaxesInitial);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [loadingMoreRecs, setLoadingMoreRecs] = useState(false);
  const [extraRecs, setExtraRecs] = useState<TaxRecommendation[]>([]);
  const [dismissedRecs, setDismissedRecs] = useState<string[]>([]);
  const [completedDeadlines, setCompletedDeadlines] = useState<string[]>([]);
  const [remindedDeadlines, setRemindedDeadlines] = useState<string[]>([]);
  const quarterlyRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopySerial = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast('Serial number copied!')).catch(() => showToast('Failed to copy', 'error'));
  };

  const handleSchedulePayment = () => {
    setAlertDismissed(true);
    setTimeout(() => {
      quarterlyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    showToast('Scroll to Quarterly Payments to pay', 'info');
  };

  const handlePaymentComplete = (q: QuarterlyTax, serial: string) => {
    setQuarters(prev => prev.map(item =>
      item.quarter === q.quarter
        ? { ...item, amountPaid: item.estimatedTax, amountDue: 0, status: 'paid', serialNumber: serial, paymentDate: new Date().toISOString().slice(0, 10) }
        : item
    ));
    setPayingQuarter(null);
    showToast(`${formatCurrency(q.amountDue)} payment submitted!`);
  };

  const handleLoadMoreRecs = async () => {
    if (loadingMoreRecs || extraRecs.length >= extraRecsPool.length) return;
    setLoadingMoreRecs(true);
    await new Promise(r => setTimeout(r, 1600));
    const newRecs = extraRecsPool.slice(extraRecs.length, extraRecs.length + 2);
    setExtraRecs(prev => [...prev, ...newRecs]);
    setLoadingMoreRecs(false);
    showToast(`${newRecs.length} new recommendation${newRecs.length > 1 ? 's' : ''} added!`);
  };

  const handleExportData = () => {
    const rows = ['Category,Amount,Transactions,Schedule C Line'];
    mockDeductions.forEach(d => rows.push(`"${d.category}",${d.amount},${d.transactionCount},"${d.scheduleCLine}"`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tax-deductions-${currentYear}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('Tax data exported!');
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showScheduleC && <ScheduleCModal onClose={() => setShowScheduleC(false)} />}
        {showCalculator && <TaxCalculatorModal onClose={() => setShowCalculator(false)} />}
        {payingQuarter && (
          <PaymentModal quarter={payingQuarter} onClose={() => setPayingQuarter(null)} onPaid={handlePaymentComplete} />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tax Center</h1>
          <p className="text-dark-400 mt-0.5 text-sm">Tax Year {currentYear} · Self-Employment</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={handleExportData}>
            Export Data
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<FileText className="w-4 h-4" />} onClick={() => setShowScheduleC(true)}>
            View Schedule C
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Calculator className="w-4 h-4" />} onClick={() => setShowCalculator(true)}>
            Tax Calculator
          </Button>
        </div>
      </motion.div>

      {/* Alert */}
      <AnimatePresence>
        {!alertDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="flex items-start gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white text-sm">Q4 Estimated Tax Payment Due Soon</p>
              <p className="text-sm text-dark-400 mt-0.5">Your Q4 payment of {formatCurrency(4000)} is due January 15, 2025. Schedule now to avoid penalties.</p>
              <div className="flex items-center gap-3 mt-3">
                <Button variant="primary" size="sm" leftIcon={<Calendar className="w-3.5 h-3.5" />} onClick={handleSchedulePayment}>
                  Schedule Payment
                </Button>
                <button className="text-sm text-dark-400 hover:text-dark-200 transition-colors">Remind me later</button>
              </div>
            </div>
            <button onClick={() => setAlertDismissed(true)} className="p-1.5 rounded-lg text-dark-500 hover:text-dark-300 hover:bg-white/5 transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      <motion.div variants={{ visible: { transition: { staggerChildren: 0.08 } } }} initial="hidden" animate="visible">
        <TaxSummaryCards />
      </motion.div>

      {/* Quarterly + Deductions */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div ref={quarterlyRef}>
          <QuarterlyPaymentsCard quarters={quarters} onPay={setPayingQuarter} onCopySerial={handleCopySerial} />
        </div>
        <DeductionsCard />
      </motion.div>

      {/* Chart */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.15 }}>
        <IncomeExpenseChart />
      </motion.div>

      {/* Recommendations + Deadlines */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.2 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecommendationsCard
          loadingMore={loadingMoreRecs}
          onLoadMore={handleLoadMoreRecs}
          extraRecs={extraRecs}
          dismissedIds={dismissedRecs}
          onDismiss={id => { setDismissedRecs(p => [...p, id]); showToast('Recommendation dismissed', 'info'); }}
        />
        <DeadlinesCard
          completedIds={completedDeadlines}
          onComplete={id => { setCompletedDeadlines(p => [...p, id]); showToast('Marked as complete!'); }}
          remindedIds={remindedDeadlines}
          onRemind={id => { setRemindedDeadlines(p => [...p, id]); showToast('Reminder set!', 'info'); }}
        />
      </motion.div>
    </div>
  );
}
