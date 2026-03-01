/* ============================================
   NEXORA - CHICAGO HUB PAGE
   Loop Intelligence & Downtown Finance Tracker
   ============================================ */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Train, Car, Coffee, UtensilsCrossed,
  TrendingUp, Calculator, Shield, Navigation, Landmark,
  Building2, Zap, AlertTriangle, CheckCircle2,
  ArrowUpRight, ArrowDownRight, DollarSign, Clock, Info,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn, formatCurrency } from '../lib/utils';

// ============================================
// DATA
// ============================================

const commuteOptions = [
  {
    id: 'cta',
    label: 'CTA Monthly Pass',
    icon: Train,
    monthly: 105,
    daily: 3.50,
    colorKey: 'primary',
    pros: ['Cheapest — saves $285+/mo', 'Unlimited rides, no surge', 'Commuter pre-tax eligible'],
    cons: ['Fixed schedule', 'Crowded rush hour'],
  },
  {
    id: 'rideshare',
    label: 'Uber / Lyft',
    icon: Navigation,
    monthly: 390,
    daily: 18.50,
    colorKey: 'amber',
    pros: ['Door-to-door convenience', 'Flexible timing', 'Business expense trackable'],
    cons: ['Surge pricing risk', '3.7× more than CTA'],
  },
  {
    id: 'parking',
    label: 'Drive & Park',
    icon: Car,
    monthly: 475,
    daily: 22.60,
    colorKey: 'rose',
    pros: ['Maximum flexibility', 'Good for client meetings'],
    cons: ['Most expensive option', 'Loop traffic & CO₂'],
  },
];

const commuteColors: Record<string, { bg: string; ring: string; text: string; border: string }> = {
  primary: { bg: 'bg-primary-500/10', ring: 'ring-primary-500/50', text: 'text-primary-400', border: 'border-primary-500/30' },
  amber:   { bg: 'bg-amber-500/10',   ring: 'ring-amber-500/50',   text: 'text-amber-400',   border: 'border-amber-500/30'   },
  rose:    { bg: 'bg-rose-500/10',     ring: 'ring-rose-500/50',     text: 'text-rose-400',    border: 'border-rose-500/30'    },
};

const downtownExpenses = [
  { category: 'Transit (CTA)',  amount: 105, budget: 120, color: '#6366f1', icon: Train          },
  { category: 'Lunch & Dining', amount: 380, budget: 300, color: '#f43f5e', icon: UtensilsCrossed },
  { category: 'Coffee',         amount: 87,  budget: 60,  color: '#f59e0b', icon: Coffee          },
  { category: 'After-Work',     amount: 156, budget: 120, color: '#8b5cf6', icon: Zap             },
  { category: 'Misc / Parking', amount: 45,  budget: 50,  color: '#10b981', icon: Car             },
];

const loopPulse = [
  { label: 'Loop Workers',   value: '500K+',   sub: 'Daily commuters',  trend: '+2.3%', up: true  },
  { label: 'Median Income',  value: '$87,400',  sub: 'Avg Loop salary',   trend: '+4.1%', up: true  },
  { label: 'Office Vacancy', value: '23.1%',   sub: 'Co-work savings',  trend: '+1.2%', up: false },
  { label: 'Avg Loop Lunch', value: '$18.50',  sub: 'River North avg',  trend: '+6.8%', up: false },
];

const neighborhoodData = [
  { name: 'West Loop',        value: 340, color: '#6366f1' },
  { name: 'River North',      value: 225, color: '#8b5cf6' },
  { name: 'Magnificent Mile', value: 220, color: '#10b981' },
  { name: 'South Loop',       value: 180, color: '#f59e0b' },
  { name: 'Millennium Park',  value: 145, color: '#f43f5e' },
];

const taxRates = [
  { label: 'Federal Income Tax', rate: 22.0,  note: '22% bracket', color: 'text-primary-400' },
  { label: 'Illinois State Tax', rate: 4.95,  note: 'Flat rate',   color: 'text-violet-400'  },
  { label: 'Chicago City Levy',  rate: 0.50,  note: 'Residents',   color: 'text-cyan-400'    },
];

const IRS_RATE        = 0.67;
const COMBINED_TAX    = 0.2745; // 22% + 4.95% + 0.5%
const Q1_DAYS_LEFT    = 46;
const ANNUAL_INCOME   = 87400;

// ============================================
// ANIMATIONS
// ============================================

const containerVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ============================================
// COMMUTE OPTIMIZER
// ============================================

function CommuteOptimizer() {
  const [selected, setSelected] = useState('cta');
  const current = commuteOptions.find(c => c.id === selected)!;
  const cta     = commuteOptions[0];
  const saving  = current.monthly - cta.monthly;
  const c       = commuteColors[current.colorKey];

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
          <Train className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Commute Cost Optimizer</h3>
          <p className="text-xs text-dark-500">Chicago Loop · Compare your options</p>
        </div>
      </div>

      {/* Option tabs */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {commuteOptions.map(opt => {
          const Icon = opt.icon;
          const oc   = commuteColors[opt.colorKey];
          const sel  = opt.id === selected;
          return (
            <button key={opt.id} onClick={() => setSelected(opt.id)}
              className={cn(
                'p-3 rounded-xl border text-left transition-all duration-200',
                sel ? cn(oc.bg, oc.border, 'ring-1', oc.ring) : 'border-dark-700/60 bg-dark-800/40 hover:border-dark-600',
              )}>
              <Icon className={cn('w-4 h-4 mb-1.5', sel ? oc.text : 'text-dark-500')} />
              <p className={cn('text-[11px] font-semibold leading-snug', sel ? 'text-white' : 'text-dark-400')}>{opt.label}</p>
              <p className={cn('text-base font-bold mt-0.5', sel ? oc.text : 'text-dark-500')}>
                ${opt.monthly}<span className="text-[10px] font-normal">/mo</span>
              </p>
            </button>
          );
        })}
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-dark-800/50 rounded-xl p-3.5">
          <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">Monthly Cost</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(current.monthly)}</p>
          <p className="text-[11px] text-dark-500 mt-0.5">${current.daily.toFixed(2)} per workday</p>
        </div>
        <div className={cn('rounded-xl p-3.5 border', saving === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20')}>
          <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">vs CTA Pass</p>
          <p className={cn('text-2xl font-bold', saving === 0 ? 'text-emerald-400' : 'text-red-400')}>
            {saving === 0 ? 'Best' : `+${formatCurrency(saving)}`}
          </p>
          <p className="text-[11px] text-dark-500 mt-0.5">
            {saving === 0 ? 'Most affordable' : `${formatCurrency(saving * 12)} extra/yr`}
          </p>
        </div>
      </div>

      {/* Pros / Cons */}
      <div className="grid grid-cols-2 gap-2 mb-4 flex-1">
        <div className="space-y-1.5">
          {current.pros.map((p, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-dark-400">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />{p}
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {current.cons.map((con, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-dark-400">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />{con}
            </div>
          ))}
        </div>
      </div>

      <div className={cn('p-3 rounded-xl', saving > 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-500/10 border border-emerald-500/20')}>
        <p className="text-[11px] text-emerald-400">
          {saving > 0
            ? `💡 Switch to CTA and save ${formatCurrency(saving * 12)}/yr — enough for a round-trip to London.`
            : '✅ You\'re on the most cost-efficient commute in the Chicago Loop.'}
        </p>
      </div>
    </div>
  );
}

// ============================================
// DOWNTOWN SPENDING BREAKDOWN
// ============================================

function DowntownSpending() {
  const total      = downtownExpenses.reduce((s, e) => s + e.amount, 0);
  const overBudget = downtownExpenses.filter(e => e.amount > e.budget);

  const CustomTip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-3 shadow-2xl">
        <p className="text-xs font-semibold text-white mb-1">{d.name}</p>
        <p className="text-sm font-bold" style={{ color: d.payload.color }}>{formatCurrency(d.value)}</p>
        <p className="text-[11px] text-dark-500">{Math.round((d.value / total) * 100)}% of total</p>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Downtown Spending</h3>
            <p className="text-xs text-dark-500">February 2026 · Loop expenses</p>
          </div>
        </div>
        {overBudget.length > 0 && (
          <span className="px-2.5 py-1 bg-red-500/15 text-red-400 text-[11px] font-medium rounded-full border border-red-500/20">
            {overBudget.length} over budget
          </span>
        )}
      </div>

      <div className="flex items-center gap-5 mb-5">
        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 112, height: 112 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={downtownExpenses} dataKey="amount" nameKey="category"
                cx="50%" cy="50%" innerRadius={34} outerRadius={52} strokeWidth={0} paddingAngle={2}>
                {downtownExpenses.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<CustomTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[12px] font-bold text-white">{formatCurrency(total)}</span>
            <span className="text-[9px] text-dark-600">total</span>
          </div>
        </div>

        {/* Budget bars */}
        <div className="flex-1 space-y-2.5">
          {downtownExpenses.map((e, i) => {
            const Icon = e.icon;
            const over = e.amount > e.budget;
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3 h-3 flex-shrink-0" style={{ color: e.color }} />
                    <span className="text-[11px] text-dark-400">{e.category}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn('text-[11px] font-semibold', over ? 'text-red-400' : 'text-dark-300')}>{formatCurrency(e.amount)}</span>
                    <span className="text-[10px] text-dark-700">/{formatCurrency(e.budget)}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min((e.amount / e.budget) * 100, 100)}%`, backgroundColor: over ? '#ef4444' : e.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-dark-800 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-dark-600 uppercase tracking-wider mb-0.5">Monthly Loop Cost</p>
          <p className="text-base font-bold text-white">{formatCurrency(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-dark-600 uppercase tracking-wider mb-0.5">Annual Total</p>
          <p className="text-base font-bold text-primary-400">{formatCurrency(total * 12)}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ILLINOIS TAX INTELLIGENCE
// ============================================

function TaxIntelligence() {
  const annualLiability = Math.round(ANNUAL_INCOME * COMBINED_TAX);
  const quarterly       = Math.round(annualLiability / 4);
  const deductions      = 8750;
  const taxSaved        = Math.round(deductions * COMBINED_TAX);

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Illinois Tax Intelligence</h3>
            <p className="text-xs text-dark-500">Chicago Loop · 2026 Tax Year</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/25 rounded-full flex-shrink-0">
          <Clock className="w-3 h-3 text-amber-400" />
          <span className="text-[11px] text-amber-400 font-medium">{Q1_DAYS_LEFT}d to Q1</span>
        </div>
      </div>

      {/* Tax rate breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {taxRates.map((r) => (
          <div key={r.label} className="bg-dark-800/50 rounded-xl p-3 border border-dark-700/40">
            <p className="text-[10px] text-dark-500 mb-1.5 leading-snug">{r.label}</p>
            <p className={cn('text-xl font-bold', r.color)}>{r.rate}%</p>
            <p className="text-[10px] text-dark-600 mt-0.5">{r.note}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between p-3.5 bg-dark-800/40 rounded-xl border border-dark-700/40">
          <div>
            <p className="text-xs text-dark-400 font-medium">Q1 2026 Estimated Due</p>
            <p className="text-[11px] text-dark-600 mt-0.5">April 15 · Based on {formatCurrency(ANNUAL_INCOME)} income</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-white">{formatCurrency(quarterly)}</p>
            <p className="text-[10px] text-amber-400">Set aside now</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <div>
            <p className="text-xs text-emerald-400 font-medium">Deductions Identified</p>
            <p className="text-[11px] text-dark-500 mt-0.5">Home office · Software · Transit · Prof. dev</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-emerald-400">{formatCurrency(deductions)}</p>
            <p className="text-[10px] text-emerald-600">Saves ~{formatCurrency(taxSaved)}</p>
          </div>
        </div>
      </div>

      <div className="mt-auto p-3.5 bg-primary-500/10 border border-primary-500/25 rounded-xl">
        <p className="text-[11px] font-semibold text-primary-400 mb-1.5">💡 Chicago Loop Professional Tip</p>
        <p className="text-[11px] text-dark-400 leading-relaxed">
          Illinois taxes every dollar at a flat <strong className="text-white">4.95%</strong>.
          Loop workers can save up to <strong className="text-white">$3,600/yr</strong> using the IRS
          Commuter Benefit — $300/mo pre-tax transit deducted from your paycheck.
        </p>
      </div>
    </div>
  );
}

// ============================================
// LOOP ECONOMIC PULSE
// ============================================

function EconomicPulse() {
  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Landmark className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Loop Economic Pulse</h3>
          <p className="text-xs text-dark-500">Chicago CBD live indicators</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {loopPulse.map((p, i) => (
          <div key={i} className="bg-dark-800/50 rounded-xl p-4 border border-dark-700/40">
            <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-2">{p.label}</p>
            <p className="text-xl font-bold text-white">{p.value}</p>
            <p className="text-[10px] text-dark-600 mb-2">{p.sub}</p>
            <div className={cn('flex items-center gap-1 text-[11px] font-semibold', p.up ? 'text-emerald-400' : 'text-red-400')}>
              {p.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {p.trend} YoY
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto p-3.5 bg-dark-800/40 rounded-xl border border-dark-700/40">
        <div className="flex items-start gap-2.5">
          <Info className="w-3.5 h-3.5 text-dark-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-dark-500 leading-relaxed">
            Loop office vacancy at <strong className="text-dark-400">23.1%</strong> creates opportunity — co-working spaces
            like WeWork, Industrious & Spaces offer Loop addresses at <strong className="text-dark-400">40–60% less</strong> than
            full-office leases. CME Group and Boeing headquarters anchor the district's economic stability.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// NEIGHBORHOOD SPEND MAP
// ============================================

function NeighborhoodSpend() {
  const total = neighborhoodData.reduce((s, n) => s + n.value, 0);

  const CustomTip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-3 shadow-2xl">
        <p className="text-xs font-semibold text-white">{d.payload.name}</p>
        <p className="text-sm font-bold text-primary-400">{formatCurrency(d.value)}</p>
        <p className="text-[11px] text-dark-500">{Math.round((d.value / total) * 100)}% of downtown spend</p>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Neighborhood Spend Map</h3>
          <p className="text-xs text-dark-500">Where your Loop dollars flow</p>
        </div>
      </div>

      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={neighborhoodData} layout="vertical" margin={{ left: 0, right: 28, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={130}
              tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {neighborhoodData.map((n, i) => <Cell key={i} fill={n.color} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {neighborhoodData.map((n, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: n.color }} />
            <span className="text-[11px] text-dark-500 flex-1 truncate">{n.name}</span>
            <span className="text-[11px] font-semibold text-dark-300">{formatCurrency(n.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MILEAGE DEDUCTION TRACKER
// ============================================

function MileageTracker() {
  const [miles, setMiles] = useState(1240);
  const deduction = Math.round(miles * IRS_RATE);
  const taxSaving = Math.round(deduction * COMBINED_TAX);

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <Car className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Mileage Deduction Tracker</h3>
          <p className="text-xs text-dark-500">IRS standard rate · $0.67/mile (2024)</p>
        </div>
      </div>

      <div className="mb-5">
        <label className="text-[11px] text-dark-500 uppercase tracking-wider mb-2 block">
          Business miles driven (2026 YTD)
        </label>
        <div className="relative">
          <input
            type="number"
            value={miles}
            onChange={e => setMiles(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full bg-dark-800/80 border border-dark-600/60 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/60 transition-all"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-dark-500">miles</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-700/40">
          <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1.5">Deduction Amount</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(deduction)}</p>
          <p className="text-[11px] text-dark-500 mt-1">{miles.toLocaleString()} mi × $0.67</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1.5">Tax Savings</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(taxSaving)}</p>
          <p className="text-[11px] text-dark-600 mt-1">at 27.45% combined</p>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-dark-500">YTD Progress toward 15,000 mi target</span>
          <span className="text-dark-400">{Math.round((miles / 15000) * 100)}%</span>
        </div>
        <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((miles / 15000) * 100, 100)}%` }} />
        </div>
      </div>

      <div className="mt-auto p-3.5 bg-dark-800/40 rounded-xl border border-dark-700/40">
        <p className="text-[11px] text-dark-500 leading-relaxed">
          Loop professionals driving to client offices, courts, or business meetings qualify.{' '}
          <strong className="text-primary-400">Keep a mileage log</strong> — IRS requires date, destination & purpose for each trip.
        </p>
      </div>
    </div>
  );
}

// ============================================
// MAIN CHICAGO HUB PAGE
// ============================================

export default function ChicagoHub() {
  const totalLoopCost      = downtownExpenses.reduce((s, e) => s + e.amount, 0);
  const savingsOpportunity = 370; // CTA switch + dining reduction + commuter benefit

  const summaryChips = [
    { icon: Train,       label: 'CTA Optimized',   value: '$105/mo',    cl: 'bg-primary-500/10 border-primary-500/20 text-primary-400' },
    { icon: Calculator,  label: 'IL Tax Rate',      value: '4.95% flat', cl: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
    { icon: TrendingUp,  label: 'Tax Deductions',   value: '$8,750',     cl: 'bg-amber-500/10 border-amber-500/20 text-amber-400'     },
    { icon: MapPin,      label: 'Neighborhoods',    value: '5 tracked',  cl: 'bg-rose-500/10 border-rose-500/20 text-rose-400'         },
    { icon: Zap,         label: 'Savings Found',    value: '$4,440/yr',  cl: 'bg-violet-500/10 border-violet-500/20 text-violet-400'   },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

      {/* ── HERO ── */}
      <motion.div variants={itemVariants}>
        <div className="relative overflow-hidden rounded-2xl border border-dark-800 bg-dark-900/70 backdrop-blur-xl p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/8 via-transparent to-cyan-500/5 pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 left-16 w-56 h-56 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="px-3 py-1.5 bg-primary-500/15 border border-primary-500/25 text-primary-400 text-xs font-semibold rounded-full">
                    Chicago Loop Intelligence
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
                  Your Downtown Financial Command Center
                </h1>
                <p className="text-dark-400 text-sm max-w-xl leading-relaxed">
                  Built for the <strong className="text-white">500,000 professionals</strong> in Chicago's Loop — track what
                  downtown truly costs, optimize your commute, and maximize Illinois-specific tax savings.
                </p>
              </div>

              <div className="flex-shrink-0 lg:text-right">
                <p className="text-[11px] text-dark-500 uppercase tracking-wider mb-1">Monthly Loop Cost</p>
                <p className="text-5xl font-bold text-white tracking-tight">{formatCurrency(totalLoopCost)}</p>
                <p className="text-sm text-primary-400 mt-1.5">{formatCurrency(totalLoopCost * 12)} per year</p>
              </div>
            </div>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-2.5 mt-6 pt-6 border-t border-dark-800/60">
              {summaryChips.map((chip, i) => {
                const Icon = chip.icon;
                return (
                  <div key={i} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium', chip.cl)}>
                    <Icon className="w-3 h-3" />
                    <span className="text-dark-400">{chip.label}:</span>
                    <span className="font-bold">{chip.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── ROW 2: Commute Optimizer + Downtown Spending ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}><CommuteOptimizer /></motion.div>
        <motion.div variants={itemVariants}><DowntownSpending /></motion.div>
      </div>

      {/* ── ROW 3: Tax Intelligence + Economic Pulse ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}><TaxIntelligence /></motion.div>
        <motion.div variants={itemVariants}><EconomicPulse /></motion.div>
      </div>

      {/* ── ROW 4: Neighborhood Spend + Mileage Tracker ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}><NeighborhoodSpend /></motion.div>
        <motion.div variants={itemVariants}><MileageTracker /></motion.div>
      </div>

      {/* ── SAVINGS OPPORTUNITY BANNER ── */}
      <motion.div variants={itemVariants}>
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-0.5">
                  Nexora identified {formatCurrency(savingsOpportunity)}/month in Loop savings for you
                </h3>
                <p className="text-sm text-dark-400">
                  Switch to CTA pass (+{formatCurrency(285)}/mo) &nbsp;·&nbsp;
                  Reduce dining 20% (+{formatCurrency(76)}/mo) &nbsp;·&nbsp;
                  Commuter pre-tax benefit (+{formatCurrency(9)}/mo)
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 text-right hidden sm:block">
              <p className="text-3xl font-bold text-emerald-400">{formatCurrency(savingsOpportunity * 12)}</p>
              <p className="text-xs text-dark-500 mt-1">saved annually</p>
            </div>
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
}
