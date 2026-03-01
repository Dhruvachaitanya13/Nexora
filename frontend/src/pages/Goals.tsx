/* ============================================
   NEXORA - GOALS PAGE
   Production-level financial goals tracking
   ============================================ */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, TrendingUp, CheckCircle2, Trophy,
  Home, Car, Plane, GraduationCap, Heart, Briefcase, Umbrella,
  ChevronDown, Edit2, Trash2, X, DollarSign, Flag,
  ArrowUpRight, Zap, BarChart3,
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import Button from '../components/ui/Button';

// ============================================
// TYPES
// ============================================

type GoalCategory = 'home' | 'vehicle' | 'travel' | 'education' | 'health' | 'business' | 'emergency' | 'retirement' | 'other';
type GoalStatus = 'on_track' | 'behind' | 'completed' | 'paused';

interface GoalMilestone {
  id: string;
  label: string;
  amount: number;
  reached: boolean;
}

interface Goal {
  id: string;
  name: string;
  category: GoalCategory;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  status: GoalStatus;
  monthlyContribution: number;
  color: string;
  milestones: GoalMilestone[];
  notes?: string;
}

// ============================================
// MOCK DATA
// ============================================

const mockGoals: Goal[] = [
  {
    id: '1',
    name: 'Down Payment – Condo',
    category: 'home',
    targetAmount: 80000,
    currentAmount: 47250,
    targetDate: '2026-12-31',
    status: 'on_track',
    monthlyContribution: 2500,
    color: 'from-blue-500 to-cyan-500',
    milestones: [
      { id: 'm1', label: '25% Reached', amount: 20000, reached: true },
      { id: 'm2', label: 'Halfway There', amount: 40000, reached: true },
      { id: 'm3', label: '75% Complete', amount: 60000, reached: false },
      { id: 'm4', label: 'Goal Achieved!', amount: 80000, reached: false },
    ],
    notes: 'Target: Lincoln Park area. Looking at 2BR/2BA units.',
  },
  {
    id: '2',
    name: 'Emergency Fund',
    category: 'emergency',
    targetAmount: 30000,
    currentAmount: 18500,
    targetDate: '2025-09-30',
    status: 'behind',
    monthlyContribution: 800,
    color: 'from-amber-500 to-orange-500',
    milestones: [
      { id: 'm1', label: '3 Months Expenses', amount: 15000, reached: true },
      { id: 'm2', label: '6 Months Expenses', amount: 30000, reached: false },
    ],
    notes: '6 months of living expenses as safety net.',
  },
  {
    id: '3',
    name: 'Vacation – Japan & SE Asia',
    category: 'travel',
    targetAmount: 12000,
    currentAmount: 8750,
    targetDate: '2025-06-15',
    status: 'on_track',
    monthlyContribution: 600,
    color: 'from-pink-500 to-rose-500',
    milestones: [
      { id: 'm1', label: 'Flights Covered', amount: 3000, reached: true },
      { id: 'm2', label: 'Hotels Covered', amount: 7000, reached: true },
      { id: 'm3', label: 'Spending Money', amount: 12000, reached: false },
    ],
    notes: '3-week trip: Tokyo, Kyoto, Bangkok, Bali.',
  },
  {
    id: '4',
    name: 'MBA Program',
    category: 'education',
    targetAmount: 55000,
    currentAmount: 55000,
    targetDate: '2024-08-01',
    status: 'completed',
    monthlyContribution: 0,
    color: 'from-emerald-500 to-teal-500',
    milestones: [
      { id: 'm1', label: 'First Semester', amount: 14000, reached: true },
      { id: 'm2', label: 'Half Tuition', amount: 27500, reached: true },
      { id: 'm3', label: 'Full Tuition', amount: 55000, reached: true },
    ],
    notes: 'Kellogg School of Management — Completed Aug 2024.',
  },
  {
    id: '5',
    name: 'Tesla Model 3',
    category: 'vehicle',
    targetAmount: 15000,
    currentAmount: 4200,
    targetDate: '2026-06-30',
    status: 'on_track',
    monthlyContribution: 500,
    color: 'from-violet-500 to-purple-500',
    milestones: [
      { id: 'm1', label: '25% Down', amount: 3750, reached: true },
      { id: 'm2', label: '50% Down', amount: 7500, reached: false },
      { id: 'm3', label: 'Full Amount', amount: 15000, reached: false },
    ],
    notes: 'Down payment for lease or purchase.',
  },
  {
    id: '6',
    name: 'Retirement – Roth IRA',
    category: 'retirement',
    targetAmount: 500000,
    currentAmount: 89300,
    targetDate: '2045-01-01',
    status: 'on_track',
    monthlyContribution: 583,
    color: 'from-indigo-500 to-blue-500',
    milestones: [
      { id: 'm1', label: '$25K Milestone', amount: 25000, reached: true },
      { id: 'm2', label: '$50K Milestone', amount: 50000, reached: true },
      { id: 'm3', label: '$100K Milestone', amount: 100000, reached: false },
      { id: 'm4', label: '$250K Milestone', amount: 250000, reached: false },
    ],
    notes: 'Max contribution each year ($7,000 for 2025).',
  },
];

const categoryConfig: Record<GoalCategory, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  home: { icon: Home, label: 'Home' },
  vehicle: { icon: Car, label: 'Vehicle' },
  travel: { icon: Plane, label: 'Travel' },
  education: { icon: GraduationCap, label: 'Education' },
  health: { icon: Heart, label: 'Health' },
  business: { icon: Briefcase, label: 'Business' },
  emergency: { icon: Umbrella, label: 'Emergency' },
  retirement: { icon: TrendingUp, label: 'Retirement' },
  other: { icon: Target, label: 'Other' },
};

const statusConfig: Record<GoalStatus, { label: string; color: string; bg: string; dot: string }> = {
  on_track: { label: 'On Track', color: 'text-emerald-400', bg: 'bg-emerald-500/15', dot: 'bg-emerald-400' },
  behind: { label: 'Behind', color: 'text-amber-400', bg: 'bg-amber-500/15', dot: 'bg-amber-400' },
  completed: { label: 'Completed', color: 'text-blue-400', bg: 'bg-blue-500/15', dot: 'bg-blue-400' },
  paused: { label: 'Paused', color: 'text-dark-400', bg: 'bg-dark-700/50', dot: 'bg-dark-500' },
};

// ============================================
// HELPERS
// ============================================

function getDaysRemaining(targetDate: string): number {
  const today = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getProjectedDate(goal: Goal): string {
  if (goal.currentAmount >= goal.targetAmount) return 'Completed';
  const remaining = goal.targetAmount - goal.currentAmount;
  if (goal.monthlyContribution <= 0) return 'No contributions set';
  const monthsLeft = Math.ceil(remaining / goal.monthlyContribution);
  const projected = new Date();
  projected.setMonth(projected.getMonth() + monthsLeft);
  return projected.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ============================================
// ADD GOAL FORM
// ============================================

interface GoalFormData {
  name: string;
  category: GoalCategory;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  monthlyContribution: string;
  notes: string;
}

const defaultFormData: GoalFormData = {
  name: '',
  category: 'other',
  targetAmount: '',
  currentAmount: '',
  targetDate: '',
  monthlyContribution: '',
  notes: '',
};

const goalColors: string[] = [
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-500',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-blue-500',
];

interface AddGoalModalProps {
  onClose: () => void;
  onAdd: (goal: Goal) => void;
  editGoal?: Goal | null;
}

function AddGoalModal({ onClose, onAdd, editGoal }: AddGoalModalProps) {
  const [form, setForm] = useState<GoalFormData>(
    editGoal
      ? {
          name: editGoal.name,
          category: editGoal.category,
          targetAmount: String(editGoal.targetAmount),
          currentAmount: String(editGoal.currentAmount),
          targetDate: editGoal.targetDate,
          monthlyContribution: String(editGoal.monthlyContribution),
          notes: editGoal.notes || '',
        }
      : defaultFormData
  );
  const [selectedColor, setSelectedColor] = useState(editGoal?.color || goalColors[0]);
  const [errors, setErrors] = useState<Partial<GoalFormData>>({});

  const validate = () => {
    const errs: Partial<GoalFormData> = {};
    if (!form.name.trim()) errs.name = 'Goal name is required';
    if (!form.targetAmount || Number(form.targetAmount) <= 0) errs.targetAmount = 'Enter a valid amount';
    if (!form.targetDate) errs.targetDate = 'Target date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const current = Number(form.currentAmount) || 0;
    const target = Number(form.targetAmount);
    const newGoal: Goal = {
      id: editGoal?.id || String(Date.now()),
      name: form.name.trim(),
      category: form.category,
      targetAmount: target,
      currentAmount: current,
      targetDate: form.targetDate,
      status: current >= target ? 'completed' : 'on_track',
      monthlyContribution: Number(form.monthlyContribution) || 0,
      color: selectedColor,
      milestones: editGoal?.milestones || [
        { id: 'm1', label: '25% Reached', amount: Math.round(target * 0.25), reached: current >= target * 0.25 },
        { id: 'm2', label: '50% Reached', amount: Math.round(target * 0.5), reached: current >= target * 0.5 },
        { id: 'm3', label: '75% Reached', amount: Math.round(target * 0.75), reached: current >= target * 0.75 },
        { id: 'm4', label: 'Goal Achieved!', amount: target, reached: current >= target },
      ],
      notes: form.notes.trim(),
    };
    onAdd(newGoal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative bg-dark-900 border border-dark-700/60 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
      >
        <div className="sticky top-0 bg-dark-900 border-b border-dark-700/60 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold text-white">{editGoal ? 'Edit Goal' : 'Create New Goal'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-dark-700 transition-colors text-dark-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Goal Name */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Goal Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Down Payment – Condo"
              className={cn(
                'w-full bg-dark-800 border rounded-xl px-4 py-2.5 text-white placeholder-dark-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all',
                errors.name ? 'border-red-500/60' : 'border-dark-700'
              )}
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(categoryConfig) as [GoalCategory, { icon: React.ComponentType<{ className?: string }>; label: string }][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setForm(f => ({ ...f, category: key }))}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all',
                      form.category === key
                        ? 'border-primary-500 bg-primary-500/15 text-primary-400'
                        : 'border-dark-700 bg-dark-800 text-dark-400 hover:border-dark-600 hover:text-dark-200'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Color Theme</label>
            <div className="flex gap-2">
              {goalColors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    'w-8 h-8 rounded-full bg-gradient-to-br transition-transform',
                    color,
                    selectedColor === color ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-dark-900 scale-110' : 'hover:scale-105'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Target & Current Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Target Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">$</span>
                <input
                  type="number"
                  value={form.targetAmount}
                  onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                  placeholder="50,000"
                  className={cn(
                    'w-full bg-dark-800 border rounded-xl pl-7 pr-4 py-2.5 text-white placeholder-dark-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all',
                    errors.targetAmount ? 'border-red-500/60' : 'border-dark-700'
                  )}
                />
              </div>
              {errors.targetAmount && <p className="mt-1 text-xs text-red-400">{errors.targetAmount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Amount Saved</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">$</span>
                <input
                  type="number"
                  value={form.currentAmount}
                  onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl pl-7 pr-4 py-2.5 text-white placeholder-dark-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Target Date & Monthly Contribution */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Target Date</label>
              <input
                type="date"
                value={form.targetDate}
                onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                className={cn(
                  'w-full bg-dark-800 border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all',
                  errors.targetDate ? 'border-red-500/60' : 'border-dark-700'
                )}
              />
              {errors.targetDate && <p className="mt-1 text-xs text-red-400">{errors.targetDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Monthly Contribution</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">$</span>
                <input
                  type="number"
                  value={form.monthlyContribution}
                  onChange={e => setForm(f => ({ ...f, monthlyContribution: e.target.value }))}
                  placeholder="500"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl pl-7 pr-4 py-2.5 text-white placeholder-dark-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Notes <span className="text-dark-500">(optional)</span></label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes about this goal..."
              rows={2}
              className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-white placeholder-dark-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={onClose} fullWidth>Cancel</Button>
            <Button onClick={handleSubmit} fullWidth>{editGoal ? 'Save Changes' : 'Create Goal'}</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// CONTRIBUTE MODAL
// ============================================

interface ContributeModalProps {
  goal: Goal;
  onClose: () => void;
  onContribute: (goalId: string, amount: number) => void;
}

function ContributeModal({ goal, onClose, onContribute }: ContributeModalProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const quickAmounts = [100, 250, 500, 1000];
  const remaining = goal.targetAmount - goal.currentAmount;

  const handleContribute = () => {
    const val = Number(amount);
    if (!val || val <= 0) { setError('Enter a valid amount'); return; }
    onContribute(goal.id, val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative bg-dark-900 border border-dark-700/60 rounded-2xl w-full max-w-md shadow-2xl"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Add Contribution</h2>
              <p className="text-sm text-dark-400 mt-0.5">{goal.name}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-dark-700 transition-colors text-dark-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="bg-dark-800 rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-dark-400">Current Progress</span>
              <span className="text-white font-medium">{Math.round((goal.currentAmount / goal.targetAmount) * 100)}%</span>
            </div>
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden mb-3">
              <div
                className={cn('h-full rounded-full bg-gradient-to-r', goal.color)}
                style={{ width: `${Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white font-semibold">{formatCurrency(goal.currentAmount)}</span>
              <span className="text-dark-400">{formatCurrency(remaining)} remaining</span>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="mb-4">
            <p className="text-xs text-dark-400 mb-2">Quick Add</p>
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map(qa => (
                <button
                  key={qa}
                  onClick={() => { setAmount(String(qa)); setError(''); }}
                  className={cn(
                    'py-1.5 rounded-lg text-sm font-medium transition-all border',
                    amount === String(qa)
                      ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                      : 'bg-dark-800 border-dark-700 text-dark-300 hover:border-dark-600 hover:text-white'
                  )}
                >
                  ${qa}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Custom Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">$</span>
              <input
                type="number"
                value={amount}
                onChange={e => { setAmount(e.target.value); setError(''); }}
                placeholder="Enter amount"
                className={cn(
                  'w-full bg-dark-800 border rounded-xl pl-7 pr-4 py-2.5 text-white placeholder-dark-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all',
                  error ? 'border-red-500/60' : 'border-dark-700'
                )}
              />
            </div>
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
            {amount && Number(amount) > 0 && (
              <p className="mt-1.5 text-xs text-dark-400">
                After contribution: <span className="text-white font-medium">{formatCurrency(goal.currentAmount + Number(amount))}</span>
                {' '}of {formatCurrency(goal.targetAmount)}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} fullWidth>Cancel</Button>
            <Button onClick={handleContribute} fullWidth leftIcon={<DollarSign className="w-4 h-4" />}>Contribute</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// GOAL CARD
// ============================================

interface GoalCardProps {
  goal: Goal;
  onContribute: (goal: Goal) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
}

function GoalCard({ goal, onContribute, onEdit, onDelete }: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
  const daysLeft = getDaysRemaining(goal.targetDate);
  const CategoryIcon = categoryConfig[goal.category].icon;
  const status = statusConfig[goal.status];
  const projectedDate = getProjectedDate(goal);

  return (
    <motion.div
      layout
      className="bg-dark-900 border border-dark-700/60 rounded-2xl overflow-hidden hover:border-dark-600/80 transition-colors"
    >
      {/* Top gradient bar */}
      <div className={cn('h-1 w-full bg-gradient-to-r', goal.color)} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2.5 rounded-xl bg-gradient-to-br', goal.color, 'shadow-lg')}>
              <CategoryIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm leading-tight">{goal.name}</h3>
              <span className={cn('inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-xs font-medium', status.bg, status.color)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                {status.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(goal)}
              className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-500 hover:text-dark-200 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(goal.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/15 text-dark-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Amounts */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-2xl font-bold text-white">{formatCurrency(goal.currentAmount)}</p>
            <p className="text-xs text-dark-400 mt-0.5">of {formatCurrency(goal.targetAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{Math.round(progress)}%</p>
            <p className="text-xs text-dark-400 mt-0.5">complete</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-dark-800 rounded-full overflow-hidden mb-4">
          <motion.div
            className={cn('h-full rounded-full bg-gradient-to-r', goal.color)}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-dark-800/60 rounded-xl p-2.5 text-center">
            <p className="text-xs text-dark-400 mb-0.5">Monthly</p>
            <p className="text-sm font-semibold text-white">{formatCurrency(goal.monthlyContribution)}</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl p-2.5 text-center">
            <p className="text-xs text-dark-400 mb-0.5">Days Left</p>
            <p className={cn('text-sm font-semibold', goal.status === 'completed' ? 'text-blue-400' : daysLeft < 90 ? 'text-amber-400' : 'text-white')}>
              {goal.status === 'completed' ? '—' : daysLeft}
            </p>
          </div>
          <div className="bg-dark-800/60 rounded-xl p-2.5 text-center">
            <p className="text-xs text-dark-400 mb-0.5">Projected</p>
            <p className="text-sm font-semibold text-white">{projectedDate}</p>
          </div>
        </div>

        {/* Milestones toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between text-xs text-dark-400 hover:text-dark-200 transition-colors py-1"
        >
          <span className="flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5" />
            Milestones ({goal.milestones.filter(m => m.reached).length}/{goal.milestones.length} reached)
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2">
                {goal.milestones.map(milestone => (
                  <div
                    key={milestone.id}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-xl text-xs',
                      milestone.reached ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-dark-800/60'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {milestone.reached
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        : <div className="w-3.5 h-3.5 rounded-full border border-dark-600" />
                      }
                      <span className={milestone.reached ? 'text-emerald-300' : 'text-dark-400'}>{milestone.label}</span>
                    </div>
                    <span className={milestone.reached ? 'text-emerald-400 font-medium' : 'text-dark-500'}>
                      {formatCurrency(milestone.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {goal.notes && (
          <p className="mt-3 text-xs text-dark-500 leading-relaxed">{goal.notes}</p>
        )}

        {/* Actions */}
        {goal.status !== 'completed' && (
          <div className="mt-4 pt-4 border-t border-dark-800">
            <Button
              onClick={() => onContribute(goal)}
              size="sm"
              fullWidth
              leftIcon={<ArrowUpRight className="w-4 h-4" />}
            >
              Add Contribution
            </Button>
          </div>
        )}
        {goal.status === 'completed' && (
          <div className="mt-4 pt-4 border-t border-dark-800 flex items-center justify-center gap-2 text-emerald-400">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-medium">Goal Achieved!</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// MAIN GOALS PAGE
// ============================================

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>(mockGoals);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [filter, setFilter] = useState<'all' | GoalStatus>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = goals.length;
    const onTrack = goals.filter(g => g.status === 'on_track').length;
    const completed = goals.filter(g => g.status === 'completed').length;
    const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
    const monthlyTotal = goals.filter(g => g.status !== 'completed').reduce((s, g) => s + g.monthlyContribution, 0);
    return { total, onTrack, completed, totalSaved, totalTarget, monthlyTotal };
  }, [goals]);

  const filteredGoals = useMemo(() =>
    filter === 'all' ? goals : goals.filter(g => g.status === filter),
    [goals, filter]
  );

  const handleAddGoal = (goal: Goal) => {
    if (editGoal) {
      setGoals(prev => prev.map(g => g.id === goal.id ? goal : g));
      setEditGoal(null);
    } else {
      setGoals(prev => [goal, ...prev]);
      setShowAddModal(false);
    }
  };

  const handleContribute = (goalId: string, amount: number) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      const newAmount = g.currentAmount + amount;
      const newMilestones = g.milestones.map(m => ({ ...m, reached: m.reached || newAmount >= m.amount }));
      return {
        ...g,
        currentAmount: newAmount,
        status: newAmount >= g.targetAmount ? 'completed' : g.status,
        milestones: newMilestones,
      };
    }));
    setContributeGoal(null);
  };

  const handleDelete = (goalId: string) => {
    setGoals(prev => prev.filter(g => g.id !== goalId));
    setDeleteConfirm(null);
  };

  const filterOptions: { value: 'all' | GoalStatus; label: string }[] = [
    { value: 'all', label: 'All Goals' },
    { value: 'on_track', label: 'On Track' },
    { value: 'behind', label: 'Behind' },
    { value: 'completed', label: 'Completed' },
    { value: 'paused', label: 'Paused' },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Financial Goals</h1>
          <p className="text-dark-400 text-sm mt-0.5">Track your savings goals and milestones</p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Goal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Goals', value: stats.total, icon: Target, color: 'text-primary-400', bg: 'bg-primary-500/15' },
          { label: 'On Track', value: stats.onTrack, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
          { label: 'Completed', value: stats.completed, icon: Trophy, color: 'text-blue-400', bg: 'bg-blue-500/15' },
          { label: 'Monthly Contributions', value: formatCurrency(stats.monthlyTotal), icon: Zap, color: 'text-violet-400', bg: 'bg-violet-500/15' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-dark-900 border border-dark-700/60 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('p-2 rounded-xl', stat.bg)}>
                  <Icon className={cn('w-4 h-4', stat.color)} />
                </div>
                <span className="text-sm text-dark-400">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Overall Progress */}
      <div className="bg-dark-900 border border-dark-700/60 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-400" />
            <h2 className="font-semibold text-white">Overall Progress</h2>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{formatCurrency(stats.totalSaved)} <span className="text-dark-400 font-normal">of {formatCurrency(stats.totalTarget)}</span></p>
          </div>
        </div>
        <div className="h-3 bg-dark-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 via-violet-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (stats.totalSaved / stats.totalTarget) * 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-dark-500">
          <span>{Math.round((stats.totalSaved / stats.totalTarget) * 100)}% of total savings goals reached</span>
          <span>{formatCurrency(stats.totalTarget - stats.totalSaved)} remaining</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border',
              filter === opt.value
                ? 'bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/25'
                : 'border-dark-700 bg-dark-900 text-dark-400 hover:border-dark-600 hover:text-white'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="bg-dark-900 border border-dark-700/60 rounded-2xl p-12 text-center">
          <Target className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <p className="text-dark-300 font-medium mb-1">No goals found</p>
          <p className="text-dark-500 text-sm">
            {filter === 'all' ? 'Create your first financial goal to get started.' : `No goals with status "${filter.replace('_', ' ')}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredGoals.map(goal => (
              <motion.div
                key={goal.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <GoalCard
                  goal={goal}
                  onContribute={setContributeGoal}
                  onEdit={goal => { setEditGoal(goal); setShowAddModal(true); }}
                  onDelete={setDeleteConfirm}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(showAddModal || editGoal) && (
          <AddGoalModal
            onClose={() => { setShowAddModal(false); setEditGoal(null); }}
            onAdd={handleAddGoal}
            editGoal={editGoal}
          />
        )}
        {contributeGoal && (
          <ContributeModal
            goal={contributeGoal}
            onClose={() => setContributeGoal(null)}
            onContribute={handleContribute}
          />
        )}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              className="relative bg-dark-900 border border-dark-700/60 rounded-2xl w-full max-w-sm p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-red-500/15 rounded-xl">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="font-semibold text-white">Delete Goal?</h3>
              </div>
              <p className="text-dark-300 text-sm mb-5">This will permanently delete this goal and all its progress. This action cannot be undone.</p>
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
