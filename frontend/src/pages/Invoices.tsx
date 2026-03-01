/* ============================================
   FINTRACK AI - INVOICES PAGE
   Professional invoice management for freelancers
   ============================================ */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Download,
  Send,
  Edit3,
  Trash2,
  MoreHorizontal,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingUp,
  Eye,
  Copy,
  RefreshCw,
  Sparkles,
  Building2,
  Mail,
  Calendar,
  Hash,
  Percent,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { cn, formatCurrency, formatDate, truncate } from '../lib/utils';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { SearchInput } from '../components/ui/Input';

// ============================================
// TYPES
// ============================================

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  client_company?: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled';
  line_items: LineItem[];
  tax_rate: number;
  notes?: string;
  paid_date?: string;
}

// ============================================
// HELPERS
// ============================================

function calcInvoice(invoice: Invoice) {
  const subtotal = invoice.line_items.reduce((s, item) => s + item.quantity * item.rate, 0);
  const tax = subtotal * (invoice.tax_rate / 100);
  return { subtotal, tax, total: subtotal + tax };
}

// ============================================
// MOCK DATA
// ============================================

const mockInvoices: Invoice[] = [
  {
    id: 'inv1',
    invoice_number: 'INV-2024-001',
    client_name: 'Sarah Chen',
    client_email: 'sarah.chen@techstartup.io',
    client_company: 'TechStartup IO',
    issue_date: '2024-02-01',
    due_date: '2024-02-15',
    status: 'paid',
    tax_rate: 0,
    paid_date: '2024-02-10',
    line_items: [
      { id: 'li1', description: 'Web App Development – Phase 1', quantity: 1, rate: 4500 },
      { id: 'li2', description: 'UI/UX Design System', quantity: 1, rate: 1200 },
    ],
    notes: 'Net 15 payment terms. Thank you for your business!',
  },
  {
    id: 'inv2',
    invoice_number: 'INV-2024-002',
    client_name: 'Marcus Johnson',
    client_email: 'marcus@designco.com',
    client_company: 'DesignCo Agency',
    issue_date: '2024-02-05',
    due_date: '2024-02-20',
    status: 'sent',
    tax_rate: 8.5,
    line_items: [
      { id: 'li3', description: 'Brand Identity Package', quantity: 1, rate: 2800 },
      { id: 'li4', description: 'Logo Variations (5 concepts)', quantity: 5, rate: 200 },
    ],
    notes: 'Includes 2 rounds of revisions.',
  },
  {
    id: 'inv3',
    invoice_number: 'INV-2024-003',
    client_name: 'Priya Patel',
    client_email: 'priya@consultingfirm.com',
    client_company: 'Apex Consulting',
    issue_date: '2024-01-20',
    due_date: '2024-02-04',
    status: 'overdue',
    tax_rate: 0,
    line_items: [
      { id: 'li5', description: 'CRM Integration Consulting (40 hrs)', quantity: 40, rate: 185 },
    ],
  },
  {
    id: 'inv4',
    invoice_number: 'INV-2024-004',
    client_name: 'James Rivera',
    client_email: 'james.r@ecommerceplus.net',
    client_company: 'EcommercePlus',
    issue_date: '2024-02-10',
    due_date: '2024-03-10',
    status: 'draft',
    tax_rate: 0,
    line_items: [
      { id: 'li6', description: 'E-commerce Platform Build', quantity: 1, rate: 6500 },
      { id: 'li7', description: 'Product Photography (20 items)', quantity: 20, rate: 45 },
      { id: 'li8', description: 'SEO Setup & Content Strategy', quantity: 1, rate: 950 },
    ],
    notes: 'Draft – pending scope confirmation.',
  },
  {
    id: 'inv5',
    invoice_number: 'INV-2024-005',
    client_name: 'Olivia Thompson',
    client_email: 'olivia@nonprofitorg.org',
    client_company: 'Chicago Nonprofit Alliance',
    issue_date: '2024-02-12',
    due_date: '2024-02-26',
    status: 'sent',
    tax_rate: 0,
    line_items: [
      { id: 'li9', description: 'Website Redesign & Accessibility Audit', quantity: 1, rate: 3200 },
    ],
    notes: 'Nonprofit rate applied.',
  },
  {
    id: 'inv6',
    invoice_number: 'INV-2023-048',
    client_name: 'David Kim',
    client_email: 'dkim@retailchain.com',
    client_company: 'RetailChain USA',
    issue_date: '2023-12-15',
    due_date: '2023-12-31',
    status: 'canceled',
    tax_rate: 0,
    line_items: [
      { id: 'li10', description: 'Mobile App Prototype', quantity: 1, rate: 3800 },
    ],
    notes: 'Canceled per client request.',
  },
];

const emptyLineItem = (): LineItem => ({
  id: `li-${Date.now()}-${Math.random()}`,
  description: '',
  quantity: 1,
  rate: 0,
});

const emptyForm = (): Omit<Invoice, 'id'> => ({
  invoice_number: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
  client_name: '',
  client_email: '',
  client_company: '',
  issue_date: new Date().toISOString().split('T')[0],
  due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  status: 'draft',
  tax_rate: 0,
  notes: '',
  line_items: [emptyLineItem()],
});

// ============================================
// STATUS CONFIG
// ============================================

const statusConfig: Record<Invoice['status'], { label: string; color: string; icon: React.ElementType }> = {
  draft:    { label: 'Draft',    color: 'gray',    icon: Edit3 },
  sent:     { label: 'Sent',     color: 'blue',    icon: Send },
  paid:     { label: 'Paid',     color: 'emerald', icon: CheckCircle },
  overdue:  { label: 'Overdue',  color: 'red',     icon: AlertCircle },
  canceled: { label: 'Canceled', color: 'dark',    icon: X },
};

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const cfg = statusConfig[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
      `bg-${cfg.color}-500/20 text-${cfg.color}-400`
    )}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ============================================
// STATS SUMMARY
// ============================================

function InvoiceStats({ invoices }: { invoices: Invoice[] }) {
  const stats = useMemo(() => {
    const totalInvoiced = invoices
      .filter(i => i.status !== 'canceled')
      .reduce((s, i) => s + calcInvoice(i).total, 0);
    const paid = invoices
      .filter(i => i.status === 'paid')
      .reduce((s, i) => s + calcInvoice(i).total, 0);
    const outstanding = invoices
      .filter(i => i.status === 'sent')
      .reduce((s, i) => s + calcInvoice(i).total, 0);
    const overdue = invoices
      .filter(i => i.status === 'overdue')
      .reduce((s, i) => s + calcInvoice(i).total, 0);
    return { totalInvoiced, paid, outstanding, overdue };
  }, [invoices]);

  const cards = [
    { label: 'Total Invoiced', value: formatCurrency(stats.totalInvoiced), icon: FileText,    color: 'blue' },
    { label: 'Paid',           value: formatCurrency(stats.paid),          icon: CheckCircle, color: 'emerald' },
    { label: 'Outstanding',    value: formatCurrency(stats.outstanding),   icon: Clock,       color: 'amber' },
    { label: 'Overdue',        value: formatCurrency(stats.overdue),       icon: AlertCircle, color: 'red' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="p-4 rounded-xl bg-dark-800/50 border border-dark-700/50 hover:bg-dark-800 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-dark-400">{c.label}</span>
            <div className={`p-1.5 rounded-lg bg-${c.color}-500/20`}>
              <c.icon className={`w-4 h-4 text-${c.color}-400`} />
            </div>
          </div>
          <p className={`text-xl font-bold text-${c.color}-400`}>{c.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// INVOICE ROW
// ============================================

function InvoiceRow({
  invoice,
  onEdit,
  onDelete,
  onDuplicate,
  onSend,
  onMarkPaid,
  onDownload,
}: {
  invoice: Invoice;
  onEdit: (inv: Invoice) => void;
  onDelete: (id: string) => void;
  onDuplicate: (inv: Invoice) => void;
  onSend: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onDownload: (inv: Invoice) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { subtotal, tax, total } = calcInvoice(invoice);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const isOverdue = invoice.status === 'sent' && new Date(invoice.due_date) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      layout
      className="group flex items-center gap-4 p-4 border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors duration-200"
    >
      {/* Invoice icon */}
      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-blue-400" />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-primary-400">{invoice.invoice_number}</span>
          <StatusBadge status={isOverdue && invoice.status === 'sent' ? 'overdue' : invoice.status} />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="font-medium text-white truncate">{invoice.client_name}</p>
          {invoice.client_company && (
            <span className="text-sm text-dark-500">· {truncate(invoice.client_company, 28)}</span>
          )}
        </div>
        <p className="text-xs text-dark-500 mt-0.5">{invoice.client_email}</p>
      </div>

      {/* Dates */}
      <div className="hidden md:block w-32 text-right">
        <p className="text-sm text-dark-300">Issued {formatDate(invoice.issue_date, 'short')}</p>
        <p className={cn(
          "text-xs mt-0.5",
          isOverdue ? "text-red-400 font-medium" : "text-dark-500"
        )}>
          Due {formatDate(invoice.due_date, 'short')}
        </p>
      </div>

      {/* Amount */}
      <div className="w-32 text-right">
        <p className="font-semibold text-white">{formatCurrency(total)}</p>
        {invoice.tax_rate > 0 && (
          <p className="text-xs text-dark-500 mt-0.5">incl. {invoice.tax_rate}% tax</p>
        )}
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
              className="absolute right-0 top-full mt-1 w-52 bg-dark-800 border border-dark-700 rounded-xl shadow-xl py-1 z-[100]"
            >
              <button onClick={() => { onEdit(invoice); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:text-white hover:bg-white/10 flex items-center gap-2">
                <Edit3 className="w-4 h-4" /> Edit Invoice
              </button>
              <button onClick={() => { onDownload(invoice); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:text-white hover:bg-white/10 flex items-center gap-2">
                <Download className="w-4 h-4" /> Download PDF
              </button>
              <button onClick={() => { onDuplicate(invoice); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:text-white hover:bg-white/10 flex items-center gap-2">
                <Copy className="w-4 h-4" /> Duplicate
              </button>
              {(invoice.status === 'draft') && (
                <button onClick={() => { onSend(invoice.id); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-blue-400 hover:bg-blue-500/10 flex items-center gap-2">
                  <Send className="w-4 h-4" /> Send to Client
                </button>
              )}
              {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                <button onClick={() => { onMarkPaid(invoice.id); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Mark as Paid
                </button>
              )}
              <div className="my-1 border-t border-dark-700" />
              <button onClick={() => { onDelete(invoice.id); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================
// INVOICE FORM MODAL
// ============================================

function InvoiceFormModal({
  isOpen,
  initial,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  initial: Omit<Invoice, 'id'> | null;
  onClose: () => void;
  onSave: (data: Omit<Invoice, 'id'>) => void;
}) {
  const [form, setForm] = useState<Omit<Invoice, 'id'>>(initial ?? emptyForm());

  useEffect(() => {
    setForm(initial ?? emptyForm());
  }, [isOpen, initial]);

  const { subtotal, tax, total } = useMemo(() => {
    const sub = form.line_items.reduce((s, li) => s + li.quantity * li.rate, 0);
    const t = sub * (form.tax_rate / 100);
    return { subtotal: sub, tax: t, total: sub + t };
  }, [form]);

  const addLineItem = () => setForm(f => ({ ...f, line_items: [...f.line_items, emptyLineItem()] }));
  const removeLineItem = (id: string) => setForm(f => ({ ...f, line_items: f.line_items.filter(li => li.id !== id) }));
  const updateLineItem = (id: string, field: keyof LineItem, val: string | number) =>
    setForm(f => ({ ...f, line_items: f.line_items.map(li => li.id === id ? { ...li, [field]: val } : li) }));

  const handleSubmit = () => {
    if (!form.client_name.trim() || !form.client_email.trim()) return;
    onSave(form);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            className="w-full max-w-2xl bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800 flex-shrink-0">
              <h2 className="text-lg font-semibold text-white">
                {initial ? 'Edit Invoice' : 'Create Invoice'}
              </h2>
              <button onClick={onClose} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Invoice meta */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1.5 flex items-center gap-1"><Hash className="w-3 h-3" /> Invoice #</label>
                  <input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm font-mono focus:outline-none focus:border-primary-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Issue Date</label>
                  <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors" />
                </div>
              </div>

              {/* Client info */}
              <div>
                <h3 className="text-sm font-medium text-dark-300 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-dark-500" /> Client Information
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Client Name *</label>
                    <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                      placeholder="Full name"
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-1.5">Company (optional)</label>
                    <input value={form.client_company ?? ''} onChange={e => setForm(f => ({ ...f, client_company: e.target.value }))}
                      placeholder="Company name"
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-dark-400 mb-1.5 flex items-center gap-1"><Mail className="w-3 h-3" /> Client Email *</label>
                    <input type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                      placeholder="client@example.com"
                      className="w-full h-10 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors" />
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div>
                <h3 className="text-sm font-medium text-dark-300 mb-3">Line Items</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-dark-500 px-1 mb-1">
                    <span className="col-span-6">Description</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-2 text-right">Rate ($)</span>
                    <span className="col-span-1 text-right">Amount</span>
                    <span className="col-span-1" />
                  </div>
                  {form.line_items.map(li => (
                    <div key={li.id} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        value={li.description}
                        onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                        placeholder="Service or product description"
                        className="col-span-6 h-9 px-3 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                      />
                      <input
                        type="number" min="0.01" step="0.01"
                        value={li.quantity}
                        onChange={e => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="col-span-2 h-9 px-2 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm text-center focus:outline-none focus:border-primary-500 transition-colors"
                      />
                      <input
                        type="number" min="0" step="0.01"
                        value={li.rate}
                        onChange={e => updateLineItem(li.id, 'rate', parseFloat(e.target.value) || 0)}
                        className="col-span-2 h-9 px-2 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm text-right focus:outline-none focus:border-primary-500 transition-colors"
                      />
                      <span className="col-span-1 text-right text-sm text-dark-400 pr-1">
                        {formatCurrency(li.quantity * li.rate)}
                      </span>
                      <button
                        onClick={() => removeLineItem(li.id)}
                        disabled={form.line_items.length === 1}
                        className="col-span-1 p-1.5 rounded text-dark-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addLineItem}
                  className="mt-3 flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Line Item
                </button>
              </div>

              {/* Totals + Tax */}
              <div className="flex flex-col items-end gap-2 pt-3 border-t border-dark-800">
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-dark-400">Subtotal</span>
                  <span className="text-white w-24 text-right font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-dark-400 text-sm flex items-center gap-1"><Percent className="w-3 h-3" /> Tax Rate</span>
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={form.tax_rate}
                    onChange={e => setForm(f => ({ ...f, tax_rate: parseFloat(e.target.value) || 0 }))}
                    className="h-8 w-20 px-2 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm text-right focus:outline-none focus:border-primary-500 transition-colors"
                  />
                  <span className="text-white w-24 text-right text-sm">{formatCurrency(tax)}</span>
                </div>
                <div className="flex items-center gap-6 text-base font-bold border-t border-dark-700 pt-2 mt-1 w-64">
                  <span className="text-white flex-1">Total</span>
                  <span className="text-primary-400">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-1.5">Notes (optional)</label>
                <textarea
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Payment terms, special instructions, thank you message…"
                  className="w-full px-3 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-dark-800 flex-shrink-0">
              <div className="text-sm text-dark-500">
                Total: <span className="text-white font-semibold">{formatCurrency(total)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleSubmit}
                  leftIcon={initial ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                >
                  {initial ? 'Save Changes' : 'Create Invoice'}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Invoice['status'] | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const itemsPerPage = 10;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filter
  const filtered = useMemo(() => {
    let result = [...invoices];
    if (statusFilter !== 'all') result = result.filter(i => i.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.client_name.toLowerCase().includes(q) ||
        i.client_email.toLowerCase().includes(q) ||
        (i.client_company ?? '').toLowerCase().includes(q) ||
        i.invoice_number.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.issue_date.localeCompare(a.issue_date));
  }, [invoices, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handlers
  const handleCreate = (data: Omit<Invoice, 'id'>) => {
    const newInv: Invoice = { id: `inv-${Date.now()}`, ...data };
    setInvoices(prev => [newInv, ...prev]);
    setShowCreateModal(false);
    showToast(`Invoice ${newInv.invoice_number} created`);
  };

  const handleEditSave = (data: Omit<Invoice, 'id'>) => {
    if (!editingInvoice) return;
    setInvoices(prev => prev.map(i => i.id === editingInvoice.id ? { ...data, id: editingInvoice.id } : i));
    setEditingInvoice(null);
    showToast('Invoice updated');
  };

  const handleDelete = (id: string) => {
    const inv = invoices.find(i => i.id === id);
    setInvoices(prev => prev.filter(i => i.id !== id));
    showToast(`Invoice ${inv?.invoice_number ?? ''} deleted`);
  };

  const handleDuplicate = (inv: Invoice) => {
    const dup: Invoice = {
      ...inv,
      id: `inv-${Date.now()}`,
      invoice_number: `${inv.invoice_number}-COPY`,
      status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      paid_date: undefined,
      line_items: inv.line_items.map(li => ({ ...li, id: `li-${Date.now()}-${Math.random()}` })),
    };
    setInvoices(prev => [dup, ...prev]);
    showToast(`Duplicated as ${dup.invoice_number}`);
  };

  const handleSend = (id: string) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'sent' } : i));
    const inv = invoices.find(i => i.id === id);
    showToast(`Invoice ${inv?.invoice_number ?? ''} sent to ${inv?.client_email ?? 'client'}`);
  };

  const handleMarkPaid = (id: string) => {
    setInvoices(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'paid', paid_date: new Date().toISOString().split('T')[0] } : i
    ));
    const inv = invoices.find(i => i.id === id);
    showToast(`${inv?.invoice_number ?? 'Invoice'} marked as paid`);
  };

  const handleDownload = (inv: Invoice) => {
    const { subtotal, tax, total } = calcInvoice(inv);
    const lines = inv.line_items
      .map(li => `${li.description}\t${li.quantity} × $${li.rate.toFixed(2)} = $${(li.quantity * li.rate).toFixed(2)}`)
      .join('\n');
    const text = [
      `INVOICE ${inv.invoice_number}`,
      `Issued: ${inv.issue_date}  Due: ${inv.due_date}`,
      ``,
      `Client: ${inv.client_name}${inv.client_company ? ` (${inv.client_company})` : ''}`,
      `Email:  ${inv.client_email}`,
      ``,
      `LINE ITEMS`,
      lines,
      ``,
      `Subtotal: $${subtotal.toFixed(2)}`,
      inv.tax_rate > 0 ? `Tax (${inv.tax_rate}%): $${tax.toFixed(2)}` : '',
      `TOTAL: $${total.toFixed(2)}`,
      inv.notes ? `\nNotes: ${inv.notes}` : '',
    ].filter(Boolean).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoice_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${inv.invoice_number}`);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: invoices.length };
    invoices.forEach(i => { counts[i.status] = (counts[i.status] ?? 0) + 1; });
    return counts;
  }, [invoices]);

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

      {/* Create/Edit modal */}
      <InvoiceFormModal
        isOpen={showCreateModal}
        initial={null}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
      />
      <InvoiceFormModal
        isOpen={!!editingInvoice}
        initial={editingInvoice ? (({ id, ...rest }) => rest)(editingInvoice) : null}
        onClose={() => setEditingInvoice(null)}
        onSave={handleEditSave}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-dark-400 mt-1">
            {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} · {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={() => {
              const csv = [
                ['Invoice #', 'Client', 'Company', 'Email', 'Issue Date', 'Due Date', 'Status', 'Total'].join(','),
                ...invoices.map(i => [
                  i.invoice_number,
                  i.client_name,
                  i.client_company ?? '',
                  i.client_email,
                  i.issue_date,
                  i.due_date,
                  i.status,
                  calcInvoice(i).total.toFixed(2),
                ].map(v => `"${v}"`).join(',')),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              showToast(`Exported ${invoices.length} invoices as CSV`);
            }}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats */}
      <InvoiceStats invoices={invoices} />

      {/* Main Card */}
      <Card variant="glass" size="none" className="rounded-2xl">
        {/* Toolbar */}
        <div className="p-4 border-b border-dark-800 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              onClear={() => { setSearchQuery(''); setCurrentPage(1); }}
              placeholder="Search by client, company, or invoice #…"
              className="w-full"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {(['all', 'draft', 'sent', 'paid', 'overdue', 'canceled'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all duration-150 border",
                  statusFilter === s
                    ? s === 'all'
                      ? "bg-primary-500/20 text-primary-300 border-primary-500/40"
                      : `bg-${statusConfig[s]?.color ?? 'primary'}-500/20 text-${statusConfig[s]?.color ?? 'primary'}-300 border-${statusConfig[s]?.color ?? 'primary'}-500/40`
                    : "bg-dark-800/60 text-dark-400 border-dark-700/60 hover:border-dark-600 hover:text-dark-200"
                )}
              >
                {s === 'all' ? 'All' : statusConfig[s].label}
                {statusCounts[s] > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/10 text-xs">
                    {statusCounts[s]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div className="hidden md:grid grid-cols-12 items-center gap-4 px-4 py-3 bg-dark-800/30 border-b border-dark-800 text-xs font-medium text-dark-400">
          <div className="col-span-1" />
          <div className="col-span-4">Client / Invoice</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3 text-right">Dates</div>
          <div className="col-span-1 text-right">Amount</div>
          <div className="col-span-1" />
        </div>

        {/* Invoice list */}
        <div>
          {paginated.length > 0 ? (
            <AnimatePresence mode="popLayout" initial={false}>
              {paginated.map(inv => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  onEdit={setEditingInvoice}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onSend={handleSend}
                  onMarkPaid={handleMarkPaid}
                  onDownload={handleDownload}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="py-16 text-center">
              <FileText className="w-16 h-16 mx-auto text-dark-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No invoices found</h3>
              <p className="text-dark-400 mb-6">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter'
                  : 'Create your first invoice to get paid faster'}
              </p>
              {(!searchQuery && statusFilter === 'all') && (
                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
                  Create Invoice
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-dark-800">
            <p className="text-sm text-dark-400">
              Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)} leftIcon={<ChevronLeft className="w-4 h-4" />}>
                Previous
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                return (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={cn("w-8 h-8 rounded-lg text-sm font-medium transition-all",
                      currentPage === page ? "bg-primary-500 text-white" : "text-dark-400 hover:text-white hover:bg-dark-800")}>
                    {page}
                  </button>
                );
              })}
              <Button variant="ghost" size="sm" disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)} rightIcon={<ChevronRight className="w-4 h-4" />}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
