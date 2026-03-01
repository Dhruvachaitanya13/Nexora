/* ============================================
   NEXORA - BUDGETS PAGE
   Production-level budget management
   ============================================ */

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiggyBank, Plus, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp,
  ShoppingCart, Coffee, Car, Home, Wifi, Heart, Briefcase, Film,
  Utensils, Plane, BookOpen, Dumbbell, X, Edit2, Trash2, Bell,
  ChevronDown, BarChart2, Check, ArrowUpDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import Button from '../components/ui/Button';

// ============================================
// TYPES
// ============================================

type BudgetCategory =
  | 'housing' | 'food' | 'transport' | 'utilities' | 'health' | 'business'
  | 'entertainment' | 'shopping' | 'travel' | 'education' | 'fitness' | 'coffee' | 'other';

interface Budget {
  id: string;
  name: string;
  category: BudgetCategory;
  budgeted: number;
  spent: number;
  rollover: boolean;
  alertAt: number;
  color: string;
}

// ============================================
// MOCK DATA — totals match Transactions page ($4,900 expenses)
// ============================================

const mockBudgets: Budget[] = [
  { id: '1',  name: 'Housing & Rent',    category: 'housing',       budgeted: 2500, spent: 2200, rollover: false, alertAt: 90, color: '#3b82f6' },
  { id: '2',  name: 'Business Expenses', category: 'business',      budgeted: 1200, spent: 980,  rollover: true,  alertAt: 90, color: '#0ea5e9' },
  { id: '3',  name: 'Health & Medical',  category: 'health',        budgeted: 350,  spent: 425,  rollover: false, alertAt: 80, color: '#ef4444' },
  { id: '4',  name: 'Groceries',         category: 'food',          budgeted: 500,  spent: 387,  rollover: true,  alertAt: 85, color: '#10b981' },
  { id: '5',  name: 'Dining Out',        category: 'food',          budgeted: 400,  spent: 285,  rollover: false, alertAt: 80, color: '#f59e0b' },
  { id: '6',  name: 'Transportation',    category: 'transport',     budgeted: 300,  spent: 195,  rollover: false, alertAt: 85, color: '#8b5cf6' },
  { id: '7',  name: 'Utilities',         category: 'utilities',     budgeted: 200,  spent: 90,   rollover: false, alertAt: 90, color: '#06b6d4' },
  { id: '8',  name: 'Online Shopping',   category: 'shopping',      budgeted: 200,  spent: 114,  rollover: false, alertAt: 85, color: '#f97316' },
  { id: '9',  name: 'Fitness',           category: 'fitness',       budgeted: 150,  spent: 130,  rollover: false, alertAt: 85, color: '#16a34a' },
  { id: '10', name: 'Coffee & Cafes',    category: 'coffee',        budgeted: 100,  spent: 78,   rollover: false, alertAt: 90, color: '#a16207' },
  { id: '11', name: 'Entertainment',     category: 'entertainment', budgeted: 150,  spent: 16,   rollover: false, alertAt: 80, color: '#ec4899' },
];
// Total spent: 2200+980+425+387+285+195+90+114+130+78+16 = 4,900 ✓

const monthlyHistory = [
  { month: 'Sep', budgeted: 5800, spent: 5100 },
  { month: 'Oct', budgeted: 5800, spent: 5600 },
  { month: 'Nov', budgeted: 6000, spent: 6200 },
  { month: 'Dec', budgeted: 6500, spent: 7400 },
  { month: 'Jan', budgeted: 6050, spent: 5200 },
  { month: 'Feb', budgeted: 6050, spent: 4900 },
];

const categoryConfig: Record<BudgetCategory, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  housing:       { icon: Home,         label: 'Housing'       },
  food:          { icon: Utensils,     label: 'Food'          },
  transport:     { icon: Car,          label: 'Transport'     },
  utilities:     { icon: Wifi,         label: 'Utilities'     },
  health:        { icon: Heart,        label: 'Health'        },
  business:      { icon: Briefcase,    label: 'Business'      },
  entertainment: { icon: Film,         label: 'Entertainment' },
  shopping:      { icon: ShoppingCart, label: 'Shopping'      },
  travel:        { icon: Plane,        label: 'Travel'        },
  education:     { icon: BookOpen,     label: 'Education'     },
  fitness:       { icon: Dumbbell,     label: 'Fitness'       },
  coffee:        { icon: Coffee,       label: 'Coffee'        },
  other:         { icon: PiggyBank,    label: 'Other'         },
};

const budgetColors: Record<BudgetCategory, string> = {
  housing: '#3b82f6', food: '#10b981', transport: '#8b5cf6', utilities: '#06b6d4',
  health: '#ef4444', business: '#0ea5e9', entertainment: '#ec4899', shopping: '#f97316',
  travel: '#a855f7', education: '#6366f1', fitness: '#16a34a', coffee: '#a16207', other: '#6b7280',
};

const sortOptions = [
  { value: 'percent',   label: '% Used (High → Low)' },
  { value: 'spent',     label: 'Amount Spent'          },
  { value: 'remaining', label: 'Remaining Budget'       },
  { value: 'name',      label: 'Name (A → Z)'           },
] as const;

// ============================================
// BUDGET FORM MODAL
// ============================================

interface BudgetFormData {
  name: string; category: BudgetCategory; budgeted: string;
  spent: string; rollover: boolean; alertAt: string;
}
const defaultFormData: BudgetFormData = { name: '', category: 'other', budgeted: '', spent: '0', rollover: false, alertAt: '85' };

interface BudgetModalProps { onClose: () => void; onSave: (b: Budget) => void; editBudget?: Budget | null; }

function BudgetModal({ onClose, onSave, editBudget }: BudgetModalProps) {
  const [form, setForm] = useState<BudgetFormData>(
    editBudget
      ? { name: editBudget.name, category: editBudget.category, budgeted: String(editBudget.budgeted), spent: String(editBudget.spent), rollover: editBudget.rollover, alertAt: String(editBudget.alertAt) }
      : defaultFormData
  );
  const [errors, setErrors] = useState<Partial<Record<keyof BudgetFormData, string>>>({});

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'Budget name is required';
    if (!form.budgeted || Number(form.budgeted) <= 0) errs.budgeted = 'Enter a valid amount';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      id: editBudget?.id || String(Date.now()),
      name: form.name.trim(),
      category: form.category,
      budgeted: Number(form.budgeted),
      spent: Number(form.spent) || 0,
      rollover: form.rollover,
      alertAt: Number(form.alertAt) || 85,
      color: budgetColors[form.category],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative bg-dark-900 border border-dark-700/60 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2 }}
      >
        <div className="sticky top-0 bg-dark-900 border-b border-dark-700/60 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-white">{editBudget ? 'Edit Budget' : 'New Budget Category'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-dark-700 transition-colors text-dark-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Budget Name</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Groceries"
              className={cn('w-full bg-dark-800 border rounded-xl px-4 py-2.5 text-white placeholder-dark-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all', errors.name ? 'border-red-500/60' : 'border-dark-700')} />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(categoryConfig) as [BudgetCategory, { icon: React.ComponentType<{ className?: string }>; label: string }][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button key={key} onClick={() => setForm(f => ({ ...f, category: key }))}
                    className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all', form.category === key ? 'border-primary-500 bg-primary-500/15 text-primary-400' : 'border-dark-700 bg-dark-800 text-dark-400 hover:border-dark-600 hover:text-dark-200')}>
                    <Icon className="w-4 h-4 flex-shrink-0" /><span className="truncate">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Amounts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Monthly Budget</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">$</span>
                <input type="number" value={form.budgeted} onChange={e => setForm(f => ({ ...f, budgeted: e.target.value }))} placeholder="500"
                  className={cn('w-full bg-dark-800 border rounded-xl pl-7 pr-4 py-2.5 text-white placeholder-dark-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all', errors.budgeted ? 'border-red-500/60' : 'border-dark-700')} />
              </div>
              {errors.budgeted && <p className="mt-1 text-xs text-red-400">{errors.budgeted}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Amount Spent</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">$</span>
                <input type="number" value={form.spent} onChange={e => setForm(f => ({ ...f, spent: e.target.value }))} placeholder="0"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl pl-7 pr-4 py-2.5 text-white placeholder-dark-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
              </div>
            </div>
          </div>
          {/* Alert threshold */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Alert threshold: <span className="text-primary-400 font-semibold">{form.alertAt}%</span>
            </label>
            <input type="range" min="50" max="100" value={form.alertAt} onChange={e => setForm(f => ({ ...f, alertAt: e.target.value }))}
              className="w-full h-2 accent-primary-500 cursor-pointer" />
            <div className="flex justify-between text-xs text-dark-600 mt-1"><span>50%</span><span>100%</span></div>
          </div>
          {/* Rollover */}
          <div className="flex items-center justify-between p-3.5 bg-dark-800 rounded-xl border border-dark-700/60">
            <div>
              <p className="text-sm font-medium text-white">Rollover Unused Budget</p>
              <p className="text-xs text-dark-400 mt-0.5">Add unspent amount to next month</p>
            </div>
            <button onClick={() => setForm(f => ({ ...f, rollover: !f.rollover }))}
              className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200', form.rollover ? 'bg-primary-500' : 'bg-dark-600')}>
              <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200', form.rollover ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={onClose} fullWidth>Cancel</Button>
            <Button onClick={handleSubmit} fullWidth>{editBudget ? 'Save Changes' : 'Create Budget'}</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// BUDGET ITEM
// ============================================

interface BudgetItemProps { budget: Budget; onEdit: (b: Budget) => void; onDelete: (id: string) => void; highlighted: boolean; }

function BudgetItem({ budget, onEdit, onDelete, highlighted }: BudgetItemProps) {
  const percent  = Math.round((budget.spent / budget.budgeted) * 100);
  const isOver   = budget.spent > budget.budgeted;
  const isNear   = !isOver && percent >= budget.alertAt;
  const isGood   = !isOver && !isNear && percent < 60;
  const remaining = budget.budgeted - budget.spent;
  const CategoryIcon = categoryConfig[budget.category].icon;
  const barColor = isOver ? '#ef4444' : isNear ? '#f59e0b' : budget.color;

  return (
    <motion.div
      layout
      className={cn(
        'group relative bg-dark-900/80 border rounded-2xl p-4 transition-all duration-300',
        highlighted ? 'border-primary-500/60 shadow-lg shadow-primary-500/10' : 'border-dark-700/60 hover:border-dark-600/80'
      )}
    >
      <div className="flex items-center gap-3.5">
        {/* Icon */}
        <div className="flex-shrink-0 p-2.5 rounded-xl" style={{ backgroundColor: `${budget.color}18` }}>
          <CategoryIcon className="w-[18px] h-[18px]" style={{ color: budget.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0 mr-2">
              <span className="text-sm font-semibold text-white truncate">{budget.name}</span>
              {budget.rollover && (
                <span className="hidden sm:inline text-xs text-dark-500 bg-dark-800 px-1.5 py-0.5 rounded-md">rollover</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Status badge */}
              {isOver && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/12 border border-red-500/20 rounded-full text-xs font-medium text-red-400">
                  <AlertTriangle className="w-3 h-3" />Over
                </span>
              )}
              {isNear && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/12 border border-amber-500/20 rounded-full text-xs font-medium text-amber-400">
                  <Bell className="w-3 h-3" />Near limit
                </span>
              )}
              {isGood && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/12 border border-emerald-500/20 rounded-full text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />On track
                </span>
              )}
              {/* Amounts */}
              <span className={cn('text-sm font-bold tabular-nums', isOver ? 'text-red-400' : 'text-white')}>
                {formatCurrency(budget.spent)}
              </span>
              <span className="text-xs text-dark-600">/ {formatCurrency(budget.budgeted)}</span>
              {/* Actions — visible on hover */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(budget)} className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-500 hover:text-dark-200 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(budget.id)} className="p-1.5 rounded-lg hover:bg-red-500/12 text-dark-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-dark-800 rounded-full overflow-hidden mb-1.5">
            {/* Alert threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-dark-600/80 z-10"
              style={{ left: `${Math.min(budget.alertAt, 100)}%` }}
            />
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: barColor }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, percent)}%` }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <span className={cn('text-xs tabular-nums', isOver ? 'text-red-400' : isNear ? 'text-amber-400' : 'text-dark-500')}>
              {percent}% used
            </span>
            <span className={cn('text-xs tabular-nums font-medium', isOver ? 'text-red-400' : 'text-dark-500')}>
              {isOver ? `${formatCurrency(Math.abs(remaining))} over budget` : `${formatCurrency(remaining)} remaining`}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// CUSTOM CHART TOOLTIP
// ============================================

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const budgeted = payload.find(p => p.name === 'budgeted')?.value ?? 0;
  const spent    = payload.find(p => p.name === 'spent')?.value ?? 0;
  const diff     = budgeted - spent;
  const isOver   = spent > budgeted;
  return (
    <div className="bg-dark-800 border border-dark-700/80 rounded-xl p-3.5 shadow-2xl min-w-[160px]">
      <p className="text-xs font-semibold text-dark-300 mb-2.5">{label} 2024{label === 'Jan' || label === 'Feb' ? '/25' : ''}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-dark-400"><span className="w-2 h-2 rounded-sm bg-primary-500/70" />Budget</span>
          <span className="text-sm font-bold text-white tabular-nums">{formatCurrency(budgeted)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-dark-400"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: isOver ? '#ef4444' : '#f59e0b' }} />Spent</span>
          <span className={cn('text-sm font-bold tabular-nums', isOver ? 'text-red-400' : 'text-amber-400')}>{formatCurrency(spent)}</span>
        </div>
        <div className="border-t border-dark-700 pt-1.5 flex items-center justify-between gap-4">
          <span className="text-xs text-dark-500">{isOver ? 'Over by' : 'Saved'}</span>
          <span className={cn('text-xs font-semibold tabular-nums', isOver ? 'text-red-400' : 'text-emerald-400')}>{isOver ? '+' : ''}{formatCurrency(Math.abs(diff))}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// INTERACTIVE MONTHLY OVERVIEW
// ============================================

interface MonthlyOverviewProps {
  budgets: Budget[];
  totalBudgeted: number;
  totalSpent: number;
  onSegmentClick: (id: string) => void;
}

function MonthlyOverview({ budgets, totalBudgeted, totalSpent, onSegmentClick }: MonthlyOverviewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Pre-compute segment positions in useMemo — never mutate inside JSX
  const segments = useMemo(() => {
    const sorted = [...budgets].filter(b => b.spent > 0).sort((a, b) => b.spent - a.spent);
    let cumLeft = 0;
    return sorted.map(b => {
      const width = (b.spent / totalBudgeted) * 100;
      const left  = cumLeft;
      cumLeft += width;
      return {
        id: b.id, name: b.name, spent: b.spent, color: b.color,
        width, left,
        pct: Math.round((b.spent / totalBudgeted) * 100),
      };
    });
  }, [budgets, totalBudgeted]);

  // Day progress — stable computed values, never in render
  const today        = new Date();
  const daysInMonth  = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth   = today.getDate();
  const dayPercent   = (dayOfMonth / daysInMonth) * 100;
  const projected    = dayPercent > 0 ? Math.round(totalSpent / (dayPercent / 100)) : totalSpent;
  const daysLeft     = daysInMonth - dayOfMonth;
  const overallPct   = Math.round((totalSpent / totalBudgeted) * 100);
  const projectedPct = Math.round((projected / totalBudgeted) * 100);

  // Derive active segment BEFORE returning JSX — no IIFE needed
  const activeSeg = segments.find(s => s.id === activeId) ?? null;

  return (
    <div className="bg-dark-900 border border-dark-700/60 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary-400" />
          <h2 className="font-semibold text-white">Monthly Overview</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-dark-500">Day {dayOfMonth} of {daysInMonth}</span>
          <span className={cn(
            'text-sm font-bold tabular-nums px-2.5 py-1 rounded-lg',
            overallPct > 100 ? 'bg-red-500/15 text-red-400' : overallPct > 85 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
          )}>
            {overallPct}% used
          </span>
        </div>
      </div>

      {/* Segmented bar + scale */}
      <div className="mb-4">
        {/* Bar — overflow-hidden clips segments, day marker lives inside */}
        <div className="relative h-6 bg-dark-800 rounded-full overflow-hidden">
          {segments.map(seg => (
            <motion.div
              key={seg.id}
              className="absolute top-0 h-full cursor-pointer"
              style={{
                left: `${seg.left}%`,
                backgroundColor: seg.color,
                // Use CSS transition for opacity so it doesn't fight Framer's width animation
                opacity: activeId ? (activeId === seg.id ? 1 : 0.3) : 0.85,
                transition: 'opacity 0.15s ease',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${seg.width}%` }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              onMouseEnter={() => setActiveId(seg.id)}
              onMouseLeave={() => setActiveId(null)}
              onClick={() => onSegmentClick(seg.id)}
            />
          ))}
          {/* Day-of-month marker — inside overflow-hidden so it clips cleanly */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/25 pointer-events-none z-10"
            style={{ left: `${dayPercent}%` }}
          />
        </div>

        {/* Scale labels — plain flex, no absolute positioning */}
        <div className="flex justify-between mt-1.5 text-xs text-dark-600">
          <span>$0</span>
          <span>Day {dayOfMonth}</span>
          <span>{formatCurrency(totalBudgeted)}</span>
        </div>
      </div>

      {/* Active segment detail — derived variable, not IIFE */}
      <AnimatePresence mode="wait">
        {activeSeg ? (
          <motion.div
            key={activeSeg.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border mb-4"
            style={{ backgroundColor: `${activeSeg.color}12`, borderColor: `${activeSeg.color}35` }}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: activeSeg.color }} />
              <span className="text-sm font-semibold text-white">{activeSeg.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-dark-400">{activeSeg.pct}% of budget</span>
              <span className="font-bold text-white tabular-nums">{formatCurrency(activeSeg.spent)}</span>
            </div>
          </motion.div>
        ) : (
          // Reserve height so layout doesn't jump when detail appears/disappears
          <div key="placeholder" className="mb-4 h-[46px]" />
        )}
      </AnimatePresence>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-800/60 rounded-xl p-3">
          <p className="text-xs text-dark-400 mb-1.5">Total Spent</p>
          <p className="text-base font-bold text-white tabular-nums">{formatCurrency(totalSpent)}</p>
          <p className="text-xs text-dark-500 mt-0.5">of {formatCurrency(totalBudgeted)}</p>
        </div>
        <div className="bg-dark-800/60 rounded-xl p-3">
          <p className="text-xs text-dark-400 mb-1.5">Projected</p>
          <p className={cn('text-base font-bold tabular-nums', projectedPct > 100 ? 'text-red-400' : 'text-white')}>{formatCurrency(projected)}</p>
          <p className="text-xs text-dark-500 mt-0.5">end-of-month</p>
        </div>
        <div className="bg-dark-800/60 rounded-xl p-3">
          <p className="text-xs text-dark-400 mb-1.5">Remaining</p>
          <p className={cn('text-base font-bold tabular-nums', totalBudgeted - totalSpent < 0 ? 'text-red-400' : 'text-emerald-400')}>
            {formatCurrency(Math.max(0, totalBudgeted - totalSpent))}
          </p>
          <p className="text-xs text-dark-500 mt-0.5">{daysLeft} days left</p>
        </div>
      </div>

      {/* Category legend */}
      <div className="mt-4 pt-4 border-t border-dark-800 flex flex-wrap gap-2">
        {segments.slice(0, 6).map(seg => (
          <button
            key={seg.id}
            onMouseEnter={() => setActiveId(seg.id)}
            onMouseLeave={() => setActiveId(null)}
            onClick={() => onSegmentClick(seg.id)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all border',
              activeId === seg.id
                ? 'text-white'
                : 'text-dark-400 hover:text-dark-200 border-dark-700/60 hover:border-dark-600'
            )}
            style={activeId === seg.id ? { backgroundColor: `${seg.color}18`, borderColor: `${seg.color}40`, color: seg.color } : {}}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            {seg.name}
          </button>
        ))}
        {segments.length > 6 && (
          <span className="flex items-center px-2.5 py-1 text-xs text-dark-500">
            +{segments.length - 6} more
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// SORT DROPDOWN
// ============================================

interface SortDropdownProps {
  value: string;
  onChange: (v: 'name' | 'spent' | 'remaining' | 'percent') => void;
}

function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = sortOptions.find(o => o.value === value);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-9 pl-3 pr-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-dark-300 hover:text-white hover:border-dark-600 transition-all"
      >
        <ArrowUpDown className="w-3.5 h-3.5 text-dark-500" />
        <span>{current?.label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-dark-500 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-52 bg-dark-800 border border-dark-700/80 rounded-xl shadow-2xl overflow-hidden z-30"
          >
            <div className="p-1">
              {sortOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value as typeof value extends string ? 'name' | 'spent' | 'remaining' | 'percent' : never); setOpen(false); }}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    value === opt.value ? 'bg-primary-500/15 text-primary-400' : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                  )}
                >
                  <span>{opt.label}</span>
                  {value === opt.value && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// MAIN BUDGETS PAGE
// ============================================

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>(mockBudgets);
  const [showModal, setShowModal] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'spent' | 'remaining' | 'percent'>('percent');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const stats = useMemo(() => {
    const totalBudgeted = budgets.reduce((s, b) => s + b.budgeted, 0);
    const totalSpent    = budgets.reduce((s, b) => s + b.spent, 0);
    const overBudget    = budgets.filter(b => b.spent > b.budgeted).length;
    const onTrack       = budgets.filter(b => b.spent <= b.budgeted * (b.alertAt / 100)).length;
    return { totalBudgeted, totalSpent, overBudget, onTrack, remaining: totalBudgeted - totalSpent };
  }, [budgets]);

  const sortedBudgets = useMemo(() => [...budgets].sort((a, b) => {
    if (sortBy === 'name')      return a.name.localeCompare(b.name);
    if (sortBy === 'spent')     return b.spent - a.spent;
    if (sortBy === 'remaining') return (a.budgeted - a.spent) - (b.budgeted - b.spent);
    return (b.spent / b.budgeted) - (a.spent / a.budgeted); // percent
  }), [budgets, sortBy]);

  const overBudgetItems = budgets.filter(b => b.spent > b.budgeted);
  const nearLimitItems  = budgets.filter(b => b.spent <= b.budgeted && (b.spent / b.budgeted) * 100 >= b.alertAt);

  const handleSave = (budget: Budget) => {
    if (editBudget) {
      setBudgets(prev => prev.map(b => b.id === budget.id ? budget : b));
      setEditBudget(null);
    } else {
      setBudgets(prev => [...prev, budget]);
      setShowModal(false);
    }
  };

  const handleDelete = (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
    setDeleteConfirm(null);
  };

  const handleSegmentClick = (id: string) => {
    setHighlightedId(id);
    const el = itemRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightedId(null), 2500);
  };

  const overallPct     = Math.round((stats.totalSpent / stats.totalBudgeted) * 100);
  const currentMonth   = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const hasAlerts      = overBudgetItems.length > 0 || nearLimitItems.length > 0;

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Budgets</h1>
          <p className="text-dark-400 text-sm mt-0.5">{currentMonth} · Manage your spending limits</p>
          {/* Inline alert chips */}
          <AnimatePresence>
            {hasAlerts && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-wrap gap-2 mt-2.5"
              >
                {overBudgetItems.map(b => (
                  <button
                    key={b.id}
                    onClick={() => handleSegmentClick(b.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/25 rounded-full text-xs font-medium text-red-400 hover:bg-red-500/18 transition-colors"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {b.name} · over by {formatCurrency(b.spent - b.budgeted)}
                  </button>
                ))}
                {nearLimitItems.map(b => (
                  <button
                    key={b.id}
                    onClick={() => handleSegmentClick(b.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full text-xs font-medium text-amber-400 hover:bg-amber-500/18 transition-colors"
                  >
                    <Bell className="w-3 h-3" />
                    {b.name} · {Math.round((b.spent / b.budgeted) * 100)}% used
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Button onClick={() => setShowModal(true)} leftIcon={<Plus className="w-4 h-4" />} className="flex-shrink-0">
          New Budget
        </Button>
      </div>

      {/* ── KPI Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Monthly Budget',
            value: formatCurrency(stats.totalBudgeted),
            sub: `${budgets.length} categories`,
            icon: PiggyBank,
            color: 'text-primary-400',
            bg: 'bg-primary-500/10',
            border: 'border-primary-500/20',
            accent: 'bg-primary-500',
          },
          {
            label: 'Total Spent',
            value: formatCurrency(stats.totalSpent),
            sub: `${overallPct}% of budget`,
            icon: TrendingDown,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            accent: 'bg-amber-500',
          },
          {
            label: 'Remaining',
            value: formatCurrency(Math.max(0, stats.remaining)),
            sub: stats.remaining >= 0 ? 'available to spend' : 'over budget',
            icon: TrendingUp,
            color: stats.remaining >= 0 ? 'text-emerald-400' : 'text-red-400',
            bg:  stats.remaining >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
            border: stats.remaining >= 0 ? 'border-emerald-500/20' : 'border-red-500/20',
            accent: stats.remaining >= 0 ? 'bg-emerald-500' : 'bg-red-500',
          },
          {
            label: 'On Track',
            value: `${stats.onTrack} / ${budgets.length}`,
            sub: `${stats.overBudget} over budget`,
            icon: CheckCircle2,
            color: stats.overBudget > 0 ? 'text-red-400' : 'text-emerald-400',
            bg:   stats.overBudget > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10',
            border: stats.overBudget > 0 ? 'border-red-500/20' : 'border-emerald-500/20',
            accent: stats.overBudget > 0 ? 'bg-red-500' : 'bg-emerald-500',
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={cn('relative bg-dark-900 border rounded-2xl p-4 overflow-hidden', s.border)}>
              <div className={cn('absolute top-0 left-0 right-0 h-0.5', s.accent)} />
              <div className="flex items-center gap-2.5 mb-3">
                <div className={cn('p-2 rounded-xl', s.bg)}>
                  <Icon className={cn('w-4 h-4', s.color)} />
                </div>
                <span className="text-xs text-dark-400 font-medium">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-white tabular-nums">{s.value}</p>
              <p className="text-xs text-dark-500 mt-0.5">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ── Interactive Monthly Overview ────────────── */}
      <MonthlyOverview
        budgets={budgets}
        totalBudgeted={stats.totalBudgeted}
        totalSpent={stats.totalSpent}
        onSegmentClick={handleSegmentClick}
      />

      {/* ── Spending History ───────────────────────── */}
      <div className="bg-dark-900 border border-dark-700/60 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-white">Spending History</h2>
            <p className="text-xs text-dark-500 mt-0.5">6-month budget vs actual spend</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-dark-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm bg-primary-500/50 inline-block" />
              Budgeted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm bg-amber-500/85 inline-block" />
              Spent
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyHistory} barGap={3} barCategoryGap="28%" margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="budgetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2032" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={v => `$${v / 1000}k`}
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false} tickLine={false} width={38}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 6 }} />
            {/* Budget baseline */}
            <Bar
              dataKey="budgeted" name="budgeted" fill="url(#budgetGrad)"
              radius={[5, 5, 0, 0]}
              animationBegin={0} animationDuration={900} animationEasing="ease-out"
            />
            {/* Spent bars — color changes when over budget */}
            <Bar
              dataKey="spent" name="spent"
              radius={[5, 5, 0, 0]}
              animationBegin={250} animationDuration={900} animationEasing="ease-out"
            >
              {monthlyHistory.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.spent > entry.budgeted ? '#ef4444' : '#f59e0b'}
                  opacity={entry.spent > entry.budgeted ? 0.9 : 0.82}
                />
              ))}
            </Bar>
            {/* Highlight Feb as current month */}
            <ReferenceLine x="Feb" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} label={{ value: 'Now', position: 'top', fill: '#6366f1', fontSize: 10 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Budget Categories ─────────────────────── */}
      <div className="bg-dark-900 border border-dark-700/60 rounded-2xl overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-800">
          <div>
            <h2 className="font-semibold text-white">Budget Categories</h2>
            <p className="text-xs text-dark-500 mt-0.5">{budgets.length} categories · click a segment above to jump</p>
          </div>
          <SortDropdown value={sortBy} onChange={setSortBy} />
        </div>

        {/* Items */}
        <div className="p-4 space-y-2.5">
          <AnimatePresence initial={false}>
            {sortedBudgets.map(budget => (
              <div
                key={budget.id}
                ref={el => { itemRefs.current[budget.id] = el; }}
              >
                <BudgetItem
                  budget={budget}
                  onEdit={b => { setEditBudget(b); setShowModal(true); }}
                  onDelete={setDeleteConfirm}
                  highlighted={highlightedId === budget.id}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>

        {/* Add category */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-dark-700/80 rounded-xl text-sm text-dark-500 hover:text-dark-300 hover:border-dark-600 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Budget Category
          </button>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────── */}
      <AnimatePresence>
        {(showModal || editBudget) && (
          <BudgetModal
            onClose={() => { setShowModal(false); setEditBudget(null); }}
            onSave={handleSave}
            editBudget={editBudget}
          />
        )}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirm(null)} />
            <motion.div className="relative bg-dark-900 border border-dark-700/60 rounded-2xl w-full max-w-sm p-6 shadow-2xl" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-red-500/12 rounded-xl border border-red-500/20">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Delete Budget?</h3>
                  <p className="text-xs text-dark-400 mt-0.5">{budgets.find(b => b.id === deleteConfirm)?.name}</p>
                </div>
              </div>
              <p className="text-dark-300 text-sm mb-5">This budget category and all spending data will be permanently removed.</p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setDeleteConfirm(null)} fullWidth>Cancel</Button>
                <Button variant="danger" onClick={() => handleDelete(deleteConfirm)} fullWidth>Delete</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
