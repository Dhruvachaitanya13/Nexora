/* ============================================
   NEXORA - DASHBOARD PAGE
   ============================================ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, CreditCard, PiggyBank, AlertTriangle,
  ArrowUpRight, ArrowDownRight, ArrowRight,
  Sparkles, ChevronRight, RefreshCw,
  Receipt, Wallet, Clock, Brain, Shield, Info, X,

} from 'lucide-react';
import {
  AreaChart, Area, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuthStore } from '../store/auth';
import { cn, formatCurrency } from '../lib/utils';
import { AlertCard } from '../components/ui/Card';
import Button from '../components/ui/Button';

// ============================================
// TYPES
// ============================================

interface Transaction {
  id: string;
  merchant_name: string;
  amount: number;
  category: string;
  transaction_date: string;
  is_income: boolean;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  navigateTo: string;
}

// ============================================
// MOCK DATA
// ============================================

const mockIncomeExpenseData = [
  { month: 'Sep', income: 8500, expenses: 5200 },
  { month: 'Oct', income: 9200, expenses: 4800 },
  { month: 'Nov', income: 7800, expenses: 5500 },
  { month: 'Dec', income: 11500, expenses: 6200 },
  { month: 'Jan', income: 9800, expenses: 5100 },
  { month: 'Feb', income: 10200, expenses: 4900 },
];

const mockCategoryData = [
  { name: 'Consulting Income', value: 8500, color: '#6366f1' },
  { name: 'Downtown Dining',   value: 542,  color: '#f43f5e' },
  { name: 'Transit & Commute', value: 105,  color: '#8b5cf6' },
  { name: 'Co-working Space',  value: 450,  color: '#a855f7' },
  { name: 'Professional Dev',  value: 280,  color: '#10b981' },
  { name: 'Other Loop Exp.',   value: 310,  color: '#f59e0b' },
];

const mockRecentTransactions: Transaction[] = [
  { id: '1', merchant_name: 'Client Invoice — CME',  amount:  4200,   category: 'Income',   transaction_date: '2026-02-27', is_income: true  },
  { id: '2', merchant_name: 'CTA Transit Card',      amount: -105,    category: 'Transit',  transaction_date: '2026-02-26', is_income: false },
  { id: '3', merchant_name: 'Lou Malnati\'s',        amount: -38.50,  category: 'Dining',   transaction_date: '2026-02-25', is_income: false },
  { id: '4', merchant_name: 'Industrious Co-work',   amount: -450,    category: 'Office',   transaction_date: '2026-02-24', is_income: false },
  { id: '5', merchant_name: 'Folio Coffee',          amount: -6.75,   category: 'Coffee',   transaction_date: '2026-02-24', is_income: false },
];

const mockAlerts: AlertItem[] = [
  { id: '1', type: 'warning', title: 'IL Q1 Tax Due in 46 Days',  message: 'Illinois Q1 estimated tax of $3,850 due April 15. Set aside funds now — IL flat rate 4.95% + federal 22%.', navigateTo: '/tax'     },
  { id: '2', type: 'info',    title: 'Chicago Hub is Live',        message: 'Your Loop financial intelligence is ready. See commute optimizer, neighborhood spend map, and IL tax intel.', navigateTo: '/chicago' },
];

const mockInsights = [
  {
    icon: TrendingUp,
    title: 'CTA commute saves you $4,440/year vs parking',
    type: 'positive' as const,
    detail: 'Your CTA monthly pass ($105) saves $370/month vs Loop parking ($475). That\'s $4,440 annually — equivalent to a round-trip to Tokyo or a month\'s rent in Pilsen.',
  },
  {
    icon: PiggyBank,
    title: 'IL tax deduction opportunity: $8,750 found',
    type: 'positive' as const,
    detail: 'Illinois flat tax at 4.95% on all income. Deductions found: home office ($1,200), professional development ($600), transit commuter benefit ($1,260/yr). Visit Tax Center to claim.',
  },
  {
    icon: AlertTriangle,
    title: 'Downtown dining 27% over budget — $380 vs $300',
    type: 'warning' as const,
    detail: 'West Loop and River North dining spiked this month. Consider using your employer\'s pre-tax FSA to offset up to $300/mo in qualifying dining expenses.',
  },
];

// ============================================
// ANIMATIONS
// ============================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ============================================
// MINI SPARKLINE
// ============================================

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 72; const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = data[data.length - 1];
  const dotY = h - ((last - min) / range) * (h - 4) - 2;
  return (
    <svg width={w} height={h} className="overflow-visible opacity-75">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={dotY} r="2.5" fill={color} />
    </svg>
  );
}

// ============================================
// AI SUMMARY MODAL
// ============================================

function AISummaryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const points = [
    { icon: TrendingUp,    bg: 'bg-emerald-500/15', color: 'text-emerald-400', text: 'Income up 8.2% — $10,200 earned this month vs $9,420 last month' },
    { icon: PiggyBank,     bg: 'bg-primary-500/15', color: 'text-primary-400', text: '52% savings rate — well above the recommended 20% target' },
    { icon: AlertTriangle, bg: 'bg-amber-500/15',   color: 'text-amber-400',   text: 'Q1 estimated tax of $3,250 due in 45 days — plan and pay on time' },
    { icon: Shield,        bg: 'bg-blue-500/15',    color: 'text-blue-400',    text: '$8,750 in deductions identified — maximize your tax savings now' },
  ];
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700/80 bg-gradient-to-r from-primary-500/5 to-purple-500/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">AI Financial Summary</h3>
                  <p className="text-xs text-dark-400">February 2024 · Auto-generated</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-dark-300 text-sm leading-relaxed">
                Your financial health is strong at <span className="text-emerald-400 font-semibold">82/100</span>. This month
                you've earned <span className="text-emerald-400 font-semibold">$10,200</span> with expenses of{' '}
                <span className="text-white font-semibold">$4,900</span>, leaving a net savings of{' '}
                <span className="text-primary-400 font-semibold">$5,300</span>.
              </p>
              <div className="space-y-2">
                {points.map((p, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }}
                    className="flex items-start gap-3 p-3 bg-dark-700/40 rounded-xl border border-dark-700/60">
                    <div className={cn('p-1.5 rounded-lg flex-shrink-0', p.bg)}>
                      <p.icon className={cn('w-4 h-4', p.color)} />
                    </div>
                    <span className="text-sm text-dark-200 leading-snug">{p.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-dark-700/80 bg-dark-800/50 flex items-center justify-between">
              <p className="text-xs text-dark-500">Based on your last 30 days of activity</p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
                <Button variant="primary" size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  onClick={() => { onClose(); navigate('/advisor'); }}>Ask AI</Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// STATS CARDS
// ============================================

function StatsCards({ animKey }: { animKey: number }) {
  const navigate = useNavigate();
  const stats = [
    {
      label: 'Total Balance',     value: formatCurrency(47250), change: 12.5, trend: 'up' as const,
      icon: Wallet,    gradient: 'from-indigo-500 to-violet-600',
      badge: 'text-indigo-300 bg-indigo-500/10',  glow: 'group-hover:shadow-indigo-500/10',
      sparkColor: '#818cf8', sparkData: [38, 40, 37, 43, 41, 44, 47], navigateTo: '/transactions',
    },
    {
      label: 'Monthly Income',    value: formatCurrency(10200), change: 8.2,  trend: 'up' as const,
      icon: TrendingUp, gradient: 'from-emerald-500 to-teal-500',
      badge: 'text-emerald-300 bg-emerald-500/10', glow: 'group-hover:shadow-emerald-500/10',
      sparkColor: '#10b981', sparkData: [78, 85, 80, 92, 88, 95, 102], navigateTo: '/transactions',
    },
    {
      label: 'Monthly Expenses',  value: formatCurrency(4900),  change: 5.3,  trend: 'down' as const,
      icon: CreditCard, gradient: 'from-rose-500 to-pink-500',
      badge: 'text-rose-300 bg-rose-500/10',      glow: 'group-hover:shadow-rose-500/10',
      sparkColor: '#f43f5e', sparkData: [55, 52, 58, 60, 54, 51, 49], navigateTo: '/transactions',
    },
    {
      label: 'Net Savings',       value: formatCurrency(5300),  change: 23.1, trend: 'up' as const,
      icon: PiggyBank,  gradient: 'from-amber-500 to-orange-500',
      badge: 'text-amber-300 bg-amber-500/10',    glow: 'group-hover:shadow-amber-500/10',
      sparkColor: '#f59e0b', sparkData: [28, 30, 22, 35, 38, 45, 53], navigateTo: '/transactions',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <motion.div key={`${animKey}-${s.label}`} variants={itemVariants} custom={i} whileHover={{ y: -2 }}>
          <div
            onClick={() => navigate(s.navigateTo)}
            className={cn(
              'group relative overflow-hidden rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-5',
              'cursor-pointer select-none transition-all duration-200',
              'hover:border-dark-700 hover:shadow-xl', s.glow
            )}
          >
            {/* Top accent line */}
            <div className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r', s.gradient)} />

            {/* Icon + badge */}
            <div className="flex items-center justify-between mb-5">
              <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md', s.gradient)}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <div className={cn('flex items-center gap-0.5 text-[11px] font-semibold px-2 py-1 rounded-full', s.badge)}>
                {s.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {s.change}%
              </div>
            </div>

            {/* Label + value */}
            <div className="mb-4">
              <p className="text-[10px] text-dark-500 font-semibold uppercase tracking-widest mb-1.5">{s.label}</p>
              <p className="text-[26px] font-bold text-white leading-none tracking-tight">{s.value}</p>
            </div>

            {/* Sparkline + arrow */}
            <div className="flex items-end justify-between">
              <MiniSparkline data={s.sparkData} color={s.sparkColor} />
              <ArrowRight className="w-3.5 h-3.5 text-dark-700 group-hover:text-dark-500 group-hover:translate-x-0.5 transition-all duration-150" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// FINANCIAL HEALTH CARD
// ============================================

function HealthScoreCard({ score, animKey }: { score: number; animKey: number }) {
  const [hoveredFactor, setHoveredFactor] = useState<number | null>(null);
  const size = 140; const cx = size / 2; const cy = size / 2; const r = 56;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 90 ? 'Excellent' : score >= 80 ? 'Very Good' : score >= 70 ? 'Good' : score >= 60 ? 'Fair' : 'Needs Work';
  const labelCls = score >= 80
    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    : score >= 60 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    : 'bg-red-500/10 text-red-400 border border-red-500/20';
  const accentGrad = score >= 80 ? 'from-emerald-500 to-teal-400' : score >= 60 ? 'from-amber-500 to-yellow-400' : 'from-red-500 to-rose-400';

  const factors = [
    { name: 'Cash Flow',       value: 92, icon: TrendingUp, desc: 'Strong positive flow — income exceeds expenses by 52%.' },
    { name: 'Savings Rate',    value: 78, icon: PiggyBank,  desc: 'Saving 52% of income, above the 20% recommended minimum.' },
    { name: 'Tax Prep',        value: 85, icon: Shield,     desc: '$8,750 in deductions found; Q1 payment on track.' },
    { name: 'Income Stability',value: 70, icon: Wallet,     desc: 'Good consistency but some month-to-month variance.' },
    { name: 'Expense Mgmt',    value: 88, icon: CreditCard, desc: 'Expenses controlled at 48% of income — no overspend.' },
  ];

  const barColor = (v: number) => v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444';
  const textColor = (v: number) => v >= 80 ? 'text-emerald-400' : v >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full">
      <div className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r', accentGrad)} />
      <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full blur-3xl opacity-[0.07]" style={{ backgroundColor: scoreColor }} />

      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">Financial Health</h3>
            <p className="text-xs text-dark-500 mt-0.5">Based on 5 indicators</p>
          </div>
          <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold', labelCls)}>{label}</span>
        </div>

        {/* Ring + factors */}
        <div className="flex items-center gap-7 flex-1">
          {/* Ring */}
          <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2535" strokeWidth="11" />
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={scoreColor} strokeWidth="11" opacity="0.08" />
              <motion.circle
                key={animKey} cx={cx} cy={cy} r={r} fill="none" stroke={scoreColor}
                strokeWidth="11" strokeLinecap="round"
                initial={{ strokeDasharray: circ, strokeDashoffset: circ }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.8, ease: 'easeOut' as const }}
                style={{ strokeDasharray: circ, filter: `drop-shadow(0 0 12px ${scoreColor}) drop-shadow(0 0 5px ${scoreColor})` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span key={`s-${animKey}`} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7, duration: 0.5, ease: 'easeOut' as const }}
                className="text-[40px] font-bold leading-none tracking-tight text-white">
                {score}
              </motion.span>
              <span className="text-[11px] text-dark-500 mt-1">/ 100</span>
            </div>
          </div>

          {/* Factors */}
          <div className="flex-1 space-y-3.5">
            {factors.map((f, i) => (
              <div key={f.name} onMouseEnter={() => setHoveredFactor(i)} onMouseLeave={() => setHoveredFactor(null)}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <f.icon className={cn('w-3.5 h-3.5 flex-shrink-0 transition-colors duration-150',
                      hoveredFactor === i ? textColor(f.value) : 'text-dark-600')} />
                    <span className={cn('text-xs font-medium transition-colors duration-150',
                      hoveredFactor === i ? 'text-white' : 'text-dark-400')}>{f.name}</span>
                  </div>
                  <span className={cn('text-xs font-bold tabular-nums', textColor(f.value))}>{f.value}</span>
                </div>
                <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                  <motion.div
                    key={`b-${animKey}-${i}`}
                    initial={{ width: 0 }} animate={{ width: `${f.value}%` }}
                    transition={{ delay: 1.1 + i * 0.1, duration: 0.7, ease: 'easeOut' as const }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: barColor(f.value),
                      boxShadow: hoveredFactor === i ? `0 0 12px ${barColor(f.value)}80` : `0 0 6px ${barColor(f.value)}40`,
                      transition: 'box-shadow 0.2s',
                    }}
                  />
                </div>
                <AnimatePresence>
                  {hoveredFactor === i && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
                      className="text-[10px] text-dark-500 mt-1 leading-snug overflow-hidden">
                      {f.desc}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// INCOME VS EXPENSES CHART
// ============================================

function IncomeExpensesChart({ animKey }: { animKey: number }) {
  const [period, setPeriod] = useState<'3m' | '6m'>('6m');
  const data = period === '3m' ? mockIncomeExpenseData.slice(-3) : mockIncomeExpenseData;

  const Tip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const net = (payload[0]?.value || 0) - (payload[1]?.value || 0);
    return (
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-3.5 shadow-2xl min-w-[160px]">
        <p className="text-white font-semibold text-sm mb-3">{label}</p>
        <div className="space-y-2">
          {[
            { label: 'Income',   val: payload[0]?.value, color: 'bg-emerald-500', text: 'text-emerald-400' },
            { label: 'Expenses', val: payload[1]?.value, color: 'bg-rose-500',    text: 'text-rose-400'    },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-xs text-dark-400">
                <span className={cn('w-1.5 h-1.5 rounded-full', row.color)} />{row.label}
              </span>
              <span className={cn('text-xs font-semibold', row.text)}>{formatCurrency(row.val || 0)}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-dark-700/60 flex items-center justify-between">
            <span className="text-xs text-dark-500">Net</span>
            <span className={cn('text-xs font-bold', net >= 0 ? 'text-primary-400' : 'text-red-400')}>{formatCurrency(net)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">Income vs Expenses</h3>
          <p className="text-xs text-dark-500 mt-0.5">Monthly trend</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3.5">
            <span className="flex items-center gap-1.5 text-[11px] text-dark-500"><span className="w-2 h-2 rounded-full bg-emerald-500" />Income</span>
            <span className="flex items-center gap-1.5 text-[11px] text-dark-500"><span className="w-2 h-2 rounded-full bg-rose-500" />Expenses</span>
          </div>
          <div className="flex bg-dark-800 border border-dark-700/60 rounded-lg p-0.5">
            {(['3m', '6m'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                  period === p ? 'bg-dark-700 text-white' : 'text-dark-500 hover:text-dark-300')}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-[168px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id={`ig-${animKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`eg-${animKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" vertical={false} />
            <XAxis dataKey="month" stroke="#334155" tickLine={false} axisLine={false}
              tick={{ fontSize: 11, fill: '#475569' }} dy={8} />
            <YAxis stroke="#334155" tickLine={false} axisLine={false}
              tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={(v) => `$${v / 1000}k`} />
            <Tooltip content={<Tip />} cursor={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2}
              fill={`url(#ig-${animKey})`} dot={false} activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} />
            <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2}
              fill={`url(#eg-${animKey})`} dot={false} activeDot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================
// AI INSIGHTS
// ============================================

function AIInsights({ animKey }: { animKey: number }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full flex flex-col">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-500/70 via-violet-500/50 to-transparent" />
      <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-3xl opacity-[0.07] bg-primary-500 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-lg shadow-primary-500/25 flex-shrink-0">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">AI Insights</h3>
            <p className="text-[11px] text-dark-500">Tap an insight for details</p>
          </div>
        </div>

        <div className="space-y-2 flex-1">
          {mockInsights.map((ins, i) => (
            <div key={`${animKey}-${i}`}>
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className={cn(
                  'flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all duration-150 select-none',
                  ins.type === 'positive'
                    ? 'bg-emerald-500/[0.06] border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/[0.09]'
                    : 'bg-amber-500/[0.06] border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/[0.09]'
                )}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                  ins.type === 'positive' ? 'bg-emerald-500/15' : 'bg-amber-500/15')}>
                  <ins.icon className={cn('w-3.5 h-3.5', ins.type === 'positive' ? 'text-emerald-400' : 'text-amber-400')} />
                </div>
                <p className={cn('text-xs font-medium flex-1 leading-snug mt-0.5',
                  ins.type === 'positive' ? 'text-emerald-300' : 'text-amber-300')}>
                  {ins.title}
                </p>
                <ChevronRight className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 mt-0.5',
                  ins.type === 'positive' ? 'text-emerald-700' : 'text-amber-700',
                  expanded === i && 'rotate-90')} />
              </motion.div>

              <AnimatePresence>
                {expanded === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                    <p className={cn('text-[11px] leading-relaxed px-3 py-2.5 rounded-b-xl border-x border-b',
                      ins.type === 'positive'
                        ? 'text-emerald-200/70 bg-emerald-500/[0.05] border-emerald-500/15'
                        : 'text-amber-200/70 bg-amber-500/[0.05] border-amber-500/15')}>
                      {ins.detail}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/advisor')}
          className="mt-4 w-full py-2.5 rounded-xl border border-primary-500/25 text-primary-400 text-xs font-semibold hover:bg-primary-500/8 hover:border-primary-500/50 transition-all flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          Ask AI Advisor
        </button>
      </div>
    </div>
  );
}

// ============================================
// EXPENSE BREAKDOWN
// ============================================

function ExpenseBreakdownChart({ animKey: _animKey }: { animKey: number }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<number | null>(null);
  const total = mockCategoryData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">Expense Breakdown</h3>
          <p className="text-xs text-dark-500 mt-0.5">By category this month</p>
        </div>
        <button onClick={() => navigate('/transactions')}
          className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors">
          View All <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex gap-5">
        {/* Donut */}
        <div className="relative w-[112px] h-[112px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPie>
              <Pie data={mockCategoryData} cx="50%" cy="50%" innerRadius={32} outerRadius={52}
                paddingAngle={2} dataKey="value"
                onMouseEnter={(_, i) => setHovered(i)} onMouseLeave={() => setHovered(null)}
                onClick={() => navigate('/transactions')} style={{ cursor: 'pointer' }}>
                {mockCategoryData.map((e, i) => (
                  <Cell key={i} fill={e.color} opacity={hovered === null || hovered === i ? 1 : 0.25}
                    style={{ transition: 'opacity 0.15s', outline: 'none' }} />
                ))}
              </Pie>
            </RechartsPie>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[11px] font-bold text-white">{formatCurrency(total)}</span>
            <span className="text-[9px] text-dark-600 mt-0.5">total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-0.5 min-w-0">
          {mockCategoryData.map((item, i) => (
            <div key={item.name}
              className={cn('flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
                hovered === i ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]')}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              onClick={() => navigate('/transactions')}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] text-dark-400 truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                <span className="text-[11px] font-semibold text-white">{formatCurrency(item.value)}</span>
                <span className="text-[10px] text-dark-600 w-6 text-right">{((item.value / total) * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// RECENT TRANSACTIONS
// ============================================

function RecentTransactions() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const filtered = mockRecentTransactions.filter((tx) =>
    filter === 'all' ? true : filter === 'income' ? tx.is_income : !tx.is_income
  );

  const categoryChip: Record<string, string> = {
    Income:  'bg-emerald-500/10 text-emerald-400',
    Transit: 'bg-primary-500/10 text-primary-400',
    Dining:  'bg-rose-500/10 text-rose-400',
    Office:  'bg-blue-500/10 text-blue-400',
    Coffee:  'bg-amber-500/10 text-amber-400',
  };

  const avatarGradient: Record<string, string> = {
    'Client Invoice — CME': 'from-emerald-500 to-teal-600',
    'CTA Transit Card':     'from-indigo-500 to-violet-600',
    "Lou Malnati's":        'from-red-500 to-rose-600',
    'Industrious Co-work':  'from-blue-500 to-cyan-600',
    'Folio Coffee':         'from-amber-500 to-orange-600',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">Recent Transactions</h3>
          <p className="text-xs text-dark-500 mt-0.5">Your latest activity</p>
        </div>
        <button onClick={() => navigate('/transactions')}
          className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors">
          View All <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex bg-dark-800/60 border border-dark-700/50 rounded-xl p-1 mb-4">
        {(['all', 'income', 'expense'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('flex-1 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all',
              filter === f ? 'bg-dark-700 text-white shadow-sm' : 'text-dark-500 hover:text-dark-300')}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-0.5 min-h-[180px]">
        <AnimatePresence mode="popLayout">
          {filtered.map((tx, i) => (
            <motion.div key={tx.id} layout
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10, transition: { duration: 0.15 } }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer group"
              onClick={() => navigate('/transactions')}>
              {/* Avatar */}
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-white bg-gradient-to-br',
                avatarGradient[tx.merchant_name] ?? 'from-slate-600 to-slate-700')}>
                {tx.merchant_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark-200 group-hover:text-white transition-colors leading-tight truncate">
                  {tx.merchant_name}
                </p>
                <span className={cn('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-0.5',
                  categoryChip[tx.category] ?? 'bg-dark-700 text-dark-400')}>
                  {tx.category}
                </span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={cn('text-sm font-semibold tabular-nums', tx.is_income ? 'text-emerald-400' : 'text-white')}>
                  {tx.is_income ? '+' : '−'}{formatCurrency(Math.abs(tx.amount))}
                </p>
                <p className="text-[11px] text-dark-600 mt-0.5">
                  {new Date(tx.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-10 text-dark-700">
              <Receipt className="w-8 h-8 mb-2" />
              <p className="text-xs">No {filter} transactions</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button onClick={() => navigate('/transactions')}
        className="w-full mt-3 py-2 text-[11px] font-medium text-center text-dark-600 hover:text-primary-400 hover:bg-primary-500/5 rounded-xl transition-colors border border-transparent hover:border-primary-500/15">
        View all transactions →
      </button>
    </div>
  );
}

// ============================================
// TAX SUMMARY
// ============================================

function TaxSummary({ animKey }: { animKey: number }) {
  const navigate = useNavigate();
  const daysLeft = 45; const quarterly = 3250; const paid = 6500; const total = 13000;
  const pct = (paid / total) * 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-amber-500/60 via-orange-500/40 to-transparent" />

      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">Tax Summary</h3>
          <p className="text-xs text-dark-500 mt-0.5">2024 fiscal year</p>
        </div>
        <button onClick={() => navigate('/tax')}
          className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:opacity-80',
            daysLeft <= 14
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20')}>
          <Clock className="w-3 h-3" />
          {daysLeft} days until Q1
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-dark-500">Annual tax payment progress</span>
              <span className="text-white font-semibold">{pct.toFixed(0)}% paid</span>
            </div>
            <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
              <motion.div key={animKey} initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 1, delay: 0.4 }}
                className="h-full bg-gradient-to-r from-primary-500 to-violet-500 rounded-full" />
            </div>
            <div className="flex justify-between text-[11px] mt-1.5">
              <span className="text-dark-600">Paid: {formatCurrency(paid)}</span>
              <span className="text-dark-600">Estimated: {formatCurrency(total)}</span>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'YTD Deductions', value: formatCurrency(8750), sub: '↑ 12% vs last year', subColor: 'text-emerald-400' },
              { label: 'Effective Rate',  value: '24.5%',              sub: 'Self-employed',       subColor: 'text-primary-400' },
            ].map((tile) => (
              <motion.div key={tile.label} whileHover={{ y: -1 }}
                className="p-4 bg-dark-800/60 rounded-xl border border-dark-700/50 hover:border-dark-600 cursor-pointer hover:bg-dark-800/80 transition-all"
                onClick={() => navigate('/tax')}>
                <p className="text-[10px] text-dark-500 font-semibold uppercase tracking-widest">{tile.label}</p>
                <p className="text-2xl font-bold text-white mt-2 mb-1 tracking-tight">{tile.value}</p>
                <p className={cn('text-[11px] font-medium', tile.subColor)}>{tile.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Q1 due card */}
        <div className="p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-xl flex flex-col">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Q1 Estimated Due</p>
            </div>
            <p className="text-[32px] font-bold text-white leading-none tracking-tight">{formatCurrency(quarterly)}</p>
            <p className="text-xs text-amber-500/50 mt-2">Due April 15, 2024</p>
          </div>
          <div className="space-y-2 mt-5">
            <Button variant="warning" size="sm" className="w-full" onClick={() => navigate('/tax')}>Pay Now</Button>
            <button onClick={() => navigate('/tax')}
              className="w-full py-1.5 text-[11px] font-medium text-amber-500/50 hover:text-amber-400 transition-colors text-center">
              View full report →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD
// ============================================

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboardKey, setDashboardKey] = useState(0);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [showAISummary, setShowAISummary] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setDashboardKey((k) => k + 1);
    setIsRefreshing(false);
  };

  const visibleAlerts = mockAlerts.filter((a) => !dismissedAlerts.includes(a.id));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <AISummaryModal isOpen={showAISummary} onClose={() => setShowAISummary(false)} />

      <motion.div key={dashboardKey} variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">

        {/* ── Header ── */}
        <motion.div variants={itemVariants}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight leading-none">
                {greeting}, {user?.full_name?.split(' ')[0] || 'there'} 👋
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleRefresh} disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-dark-400 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-dark-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <Button variant="primary" size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                onClick={() => setShowAISummary(true)}>
                AI Summary
              </Button>
            </div>
          </div>

        </motion.div>

        {/* ── Alert Banners ── */}
        <AnimatePresence>
          {visibleAlerts.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-2">
              {visibleAlerts.map((alert) => (
                <AlertCard key={alert.id} type={alert.type} title={alert.title} message={alert.message}
                  icon={alert.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                  dismissible onDismiss={() => setDismissedAlerts((p) => [...p, alert.id])}
                  action={{ label: 'View Details →', onClick: () => navigate(alert.navigateTo) }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stat Cards ── */}
        <motion.div variants={itemVariants}>
          <StatsCards animKey={dashboardKey} />
        </motion.div>

        {/* ── Main Grid: Health + Chart (2/3) | AI Insights (1/3, spans 2 rows) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <HealthScoreCard score={82} animKey={dashboardKey} />
          </motion.div>
          <motion.div variants={itemVariants} className="lg:row-span-2">
            <AIInsights animKey={dashboardKey} />
          </motion.div>
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <IncomeExpensesChart animKey={dashboardKey} />
          </motion.div>
        </div>

        {/* ── Bottom Grid: Transactions (2/3) | Expense Breakdown (1/3) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <RecentTransactions />
          </motion.div>
          <motion.div variants={itemVariants}>
            <ExpenseBreakdownChart animKey={dashboardKey} />
          </motion.div>
        </div>

        {/* ── Tax Summary ── */}
        <motion.div variants={itemVariants}>
          <TaxSummary animKey={dashboardKey} />
        </motion.div>

      </motion.div>
    </>
  );
}
