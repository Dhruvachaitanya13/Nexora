/* ============================================
   NEXORA - REPORTS PAGE
   ============================================ */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Download, TrendingUp, TrendingDown, DollarSign,
  FileText, ArrowUpRight, ArrowDownRight,
  ChevronDown, RefreshCw, PieChart as PieIcon, Eye,
  CheckCircle2, Layers,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import Button from '../components/ui/Button';

// ============================================
// TYPES
// ============================================

type Period = '1m' | '3m' | '6m' | '1y' | 'ytd';
type ReportType = 'overview' | 'income' | 'expenses' | 'cashflow';

// ============================================
// MOCK DATA
// ============================================

const fullMonthlyData = [
  { month: 'Mar 24', income: 7800,  expenses: 4200, net: 3600 },
  { month: 'Apr 24', income: 8200,  expenses: 4800, net: 3400 },
  { month: 'May 24', income: 8500,  expenses: 4500, net: 4000 },
  { month: 'Jun 24', income: 9100,  expenses: 5100, net: 4000 },
  { month: 'Jul 24', income: 8800,  expenses: 4700, net: 4100 },
  { month: 'Aug 24', income: 9400,  expenses: 5200, net: 4200 },
  { month: 'Sep 24', income: 8500,  expenses: 5200, net: 3300 },
  { month: 'Oct 24', income: 9200,  expenses: 5600, net: 3600 },
  { month: 'Nov 24', income: 9800,  expenses: 6200, net: 3600 },
  { month: 'Dec 24', income: 11200, expenses: 7400, net: 3800 },
  { month: 'Jan 25', income: 9500,  expenses: 5200, net: 4300 },
  { month: 'Feb 25', income: 10200, expenses: 4900, net: 5300 },
];

const expenseCategoryData = [
  { name: 'Housing',      value: 2200, color: '#3b82f6', percent: 45 },
  { name: 'Business',     value: 980,  color: '#0ea5e9', percent: 20 },
  { name: 'Health',       value: 425,  color: '#ef4444', percent: 9  },
  { name: 'Food & Dining',value: 672,  color: '#10b981', percent: 14 },
  { name: 'Transport',    value: 195,  color: '#8b5cf6', percent: 4  },
  { name: 'Utilities',    value: 90,   color: '#f59e0b', percent: 2  },
  { name: 'Shopping',     value: 114,  color: '#f97316', percent: 2  },
  { name: 'Other',        value: 224,  color: '#6b7280', percent: 4  },
];

const incomeSourceData = [
  { name: 'Client Retainers', value: 5900, color: '#6366f1', percent: 58 },
  { name: 'Project Work',     value: 2900, color: '#10b981', percent: 28 },
  { name: 'Consulting',       value: 1400, color: '#f59e0b', percent: 14 },
];

const cashflowData = [
  { month: 'Sep', inflow: 8500,  outflow: 5200 },
  { month: 'Oct', inflow: 9200,  outflow: 5600 },
  { month: 'Nov', inflow: 9800,  outflow: 6200 },
  { month: 'Dec', inflow: 11200, outflow: 7400 },
  { month: 'Jan', inflow: 9500,  outflow: 5200 },
  { month: 'Feb', inflow: 10200, outflow: 4900 },
];

const topTransactions = [
  { name: 'Monthly Retainer (Marcus & Co)', amount: 3500, category: 'Business Income', change: 0,   type: 'income'  },
  { name: 'Consulting Services',            amount: 2400, category: 'Business Income', change: 16,  type: 'income'  },
  { name: 'Design Sprint Project',          amount: 1900, category: 'Project Work',    change: 0,   type: 'income'  },
  { name: 'Advisory Fee',                   amount: 2400, category: 'Business Income', change: 5,   type: 'income'  },
  { name: 'Housing / Office Rent',          amount: 2200, category: 'Housing',         change: 0,   type: 'expense' },
  { name: 'Business Expenses',              amount: 980,  category: 'Business',        change: -8,  type: 'expense' },
  { name: 'Health Insurance',               amount: 425,  category: 'Health',          change: 0,   type: 'expense' },
  { name: 'Food & Dining',                  amount: 672,  category: 'Food',            change: 12,  type: 'expense' },
];

// ============================================
// PERIOD HELPERS
// ============================================

const periodOptions: { value: Period; label: string; full: string }[] = [
  { value: '1m',  label: '1M',  full: 'Last Month'      },
  { value: '3m',  label: '3M',  full: 'Last 3 Months'   },
  { value: '6m',  label: '6M',  full: 'Last 6 Months'   },
  { value: 'ytd', label: 'YTD', full: 'Year to Date'     },
  { value: '1y',  label: '1Y',  full: 'Last 12 Months'  },
];

function filterDataByPeriod(data: typeof fullMonthlyData, period: Period) {
  if (period === '1m')  return data.slice(-2); // need ≥2 points for area chart
  if (period === '3m')  return data.slice(-3);
  if (period === '6m')  return data.slice(-6);
  if (period === 'ytd') return data.slice(-2); // Jan + Feb 2025
  return data; // 1y — all 12 months
}

// ============================================
// REPORT DOWNLOAD HELPERS
// ============================================

function downloadCSV(rows: string[], filename: string) {
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// CUSTOM TOOLTIPS
// ============================================

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 shadow-xl min-w-[140px]">
      <p className="text-xs text-dark-400 mb-2 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 text-sm py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-dark-300 capitalize">{p.name}:</span>
          <span className="font-semibold text-white ml-auto pl-3">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { percent: number } }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 shadow-xl">
      <p className="text-sm font-semibold text-white">{payload[0].name}</p>
      <p className="text-sm text-dark-300">{formatCurrency(payload[0].value)}</p>
      <p className="text-xs text-dark-400">{payload[0].payload.percent}% of total</p>
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  label: string; value: string; change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string; bg: string; sub?: string;
}

function StatCard({ label, value, change, icon: Icon, color, bg, sub }: StatCardProps) {
  return (
    <div className="bg-dark-900 border border-dark-700/60 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-2.5 rounded-xl', bg)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
        {change !== undefined && (
          <span className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            change >= 0 ? 'text-emerald-400 bg-emerald-500/15' : 'text-red-400 bg-red-500/15'
          )}>
            {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-0.5 tabular-nums">{value}</p>
      <p className="text-sm text-dark-400">{label}</p>
      {sub && <p className="text-xs text-dark-500 mt-1">{sub}</p>}
    </div>
  );
}

// ============================================
// SINGLE-MONTH VIEW (used when period = 1m)
// ============================================

function SingleMonthView({ data, type }: { data: typeof fullMonthlyData[0]; type: ReportType }) {
  const items =
    type === 'cashflow'
      ? [
          { label: 'Money In',  value: data.income,   color: '#10b981', bg: 'bg-emerald-500/15' },
          { label: 'Money Out', value: data.expenses,  color: '#ef4444', bg: 'bg-red-500/15'     },
          { label: 'Net',       value: data.net,       color: '#6366f1', bg: 'bg-primary-500/15' },
        ]
      : type === 'income'
      ? [{ label: 'Total Income', value: data.income, color: '#10b981', bg: 'bg-emerald-500/15' }]
      : type === 'expenses'
      ? [{ label: 'Total Expenses', value: data.expenses, color: '#ef4444', bg: 'bg-red-500/15' }]
      : [
          { label: 'Income',   value: data.income,   color: '#10b981', bg: 'bg-emerald-500/15' },
          { label: 'Expenses', value: data.expenses,  color: '#ef4444', bg: 'bg-red-500/15'     },
          { label: 'Net',      value: data.net,       color: '#6366f1', bg: 'bg-primary-500/15' },
        ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {items.map(item => (
          <div key={item.label} className="bg-dark-800/60 rounded-xl p-4 text-center">
            <div className={cn('w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center', item.bg)}>
              <DollarSign className="w-5 h-5" style={{ color: item.color }} />
            </div>
            <p className="text-xs text-dark-400 mb-1">{item.label}</p>
            <p className="text-xl font-bold text-white tabular-nums">{formatCurrency(item.value)}</p>
          </div>
        ))}
      </div>
      {/* Mini bar for income vs expenses */}
      {(type === 'overview' || type === 'cashflow') && (
        <div className="space-y-3">
          {[
            { label: 'Income',   value: data.income,   max: data.income, color: '#10b981' },
            { label: 'Expenses', value: data.expenses,  max: data.income, color: '#ef4444' },
          ].map(row => (
            <div key={row.label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-dark-400">{row.label}</span>
                <span className="text-white font-medium tabular-nums">{formatCurrency(row.value)}</span>
              </div>
              <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: row.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(row.value / row.max) * 100}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN REPORTS PAGE
// ============================================

export default function Reports() {
  const [period,      setPeriod]      = useState<Period>('6m');
  const [reportType,  setReportType]  = useState<ReportType>('overview');
  const [generating,  setGenerating]  = useState<string | null>(null);
  const [generated,   setGenerated]   = useState<string[]>([]);
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [showIncome,  setShowIncome]  = useState(true);

  const chartData = useMemo(() => filterDataByPeriod(fullMonthlyData, period), [period]);
  const isSingleMonth = period === '1m';

  // KPI stats computed from selected period
  const periodStats = useMemo(() => {
    const income       = chartData.reduce((s, d) => s + d.income,   0);
    const expenses     = chartData.reduce((s, d) => s + d.expenses, 0);
    const net          = income - expenses;
    const len          = chartData.length;
    const prev         = fullMonthlyData.slice(
      Math.max(0, fullMonthlyData.length - len * 2),
      fullMonthlyData.length - len
    );
    const prevIncome   = prev.reduce((s, d) => s + d.income,   0);
    const prevExpenses = prev.reduce((s, d) => s + d.expenses, 0);
    const incomeChange   = prevIncome   > 0 ? Math.round(((income   - prevIncome)   / prevIncome)   * 100) : 0;
    const expenseChange  = prevExpenses > 0 ? Math.round(((expenses - prevExpenses) / prevExpenses) * 100) : 0;
    const savingsRate    = income > 0 ? Math.round((net / income) * 100) : 0;
    return { income, expenses, net, incomeChange, expenseChange, savingsRate };
  }, [chartData]);

  // ── PDF export ────────────────────────────────────────────────
  const handleGeneratePDF = () => {
    const periodLabel = periodOptions.find(p => p.value === period)?.full ?? period;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    const rows = chartData.map(d =>
      `<tr><td>${d.month}</td><td style="color:#059669">$${d.income.toLocaleString()}</td><td style="color:#dc2626">$${d.expenses.toLocaleString()}</td><td>$${d.net.toLocaleString()}</td></tr>`
    ).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Nexora Report</title>
<style>
  body{font-family:system-ui,sans-serif;color:#111;padding:40px;max-width:800px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#6b7280;font-size:13px;margin-bottom:28px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px}
  .stat{padding:16px;background:#f9fafb;border-radius:8px}
  .stat label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px}
  .stat p{font-size:20px;font-weight:700;margin:0}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;padding:10px 12px;background:#f3f4f6;color:#4b5563;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  td{padding:10px 12px;border-bottom:1px solid #f3f4f6}
  tr:last-child td{border-bottom:none}
  @media print{@page{margin:15mm}}
</style></head><body>
<h1>Nexora Financial Report</h1>
<p class="sub">${periodLabel} · Generated ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
<div class="stats">
  <div class="stat"><label>Total Income</label><p style="color:#059669">$${periodStats.income.toLocaleString()}</p></div>
  <div class="stat"><label>Total Expenses</label><p style="color:#dc2626">$${periodStats.expenses.toLocaleString()}</p></div>
  <div class="stat"><label>Net Profit</label><p>$${periodStats.net.toLocaleString()}</p></div>
  <div class="stat"><label>Savings Rate</label><p>${periodStats.savingsRate}%</p></div>
</div>
<table>
  <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net Profit</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 400);
  };

  // ── CSV export (header button) ───────────────────────────────
  const handleExportCSV = () => {
    const rows = ['Month,Income,Expenses,Net'];
    chartData.forEach(d => rows.push(`${d.month},${d.income},${d.expenses},${d.net}`));
    downloadCSV(rows, `nexora-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ── Report template generation + download ───────────────────
  const handleGenerateReport = (id: string) => {
    if (generating) return;
    setGenerating(id);
    setTimeout(() => {
      setGenerating(null);
      setGenerated(prev => [...prev, id]);
    }, 1800);
  };

  const handleDownloadReport = (id: string) => {
    let rows: string[] = [];
    let filename = '';
    switch (id) {
      case 'p&l':
        rows = ['Month,Income,Expenses,Net Profit,Savings Rate'];
        fullMonthlyData.forEach(d =>
          rows.push(`${d.month},${d.income},${d.expenses},${d.net},${Math.round((d.net / d.income) * 100)}%`)
        );
        filename = 'profit-loss-report.csv';
        break;
      case 'cashflow':
        rows = ['Month,Inflow,Outflow,Net Cash Flow'];
        cashflowData.forEach(d =>
          rows.push(`${d.month},${d.inflow},${d.outflow},${d.inflow - d.outflow}`)
        );
        filename = 'cashflow-report.csv';
        break;
      case 'tax-summary':
        rows = ['Category,Amount,Type'];
        rows.push('Housing / Office Rent,2200,deductible');
        rows.push('Business Expenses,980,deductible');
        rows.push('Health Insurance,425,deductible');
        rows.push('Total Income,10200,income');
        rows.push('Total Deductions,3605,deductible');
        filename = 'tax-summary-report.csv';
        break;
      case 'net-worth':
        rows = ['Account,Balance,Type'];
        rows.push('Checking Account,23750,Asset');
        rows.push('Savings Account,23500,Asset');
        rows.push('Roth IRA,89300,Asset');
        rows.push('Total Net Worth,136550,Summary');
        filename = 'net-worth-report.csv';
        break;
    }
    downloadCSV(rows, filename);
  };

  const reportTabs: { value: ReportType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'overview',  label: 'Overview',   icon: BarChart3   },
    { value: 'income',    label: 'Income',      icon: TrendingUp  },
    { value: 'expenses',  label: 'Expenses',    icon: TrendingDown },
    { value: 'cashflow',  label: 'Cash Flow',   icon: DollarSign  },
  ];

  const reportTemplates = [
    { id: 'p&l',         title: 'Profit & Loss',  icon: BarChart3,   description: 'Monthly income vs expenses', pages: 4 },
    { id: 'cashflow',    title: 'Cash Flow',       icon: TrendingUp,  description: 'Money in and out over time', pages: 3 },
    { id: 'tax-summary', title: 'Tax Summary',     icon: FileText,    description: 'Deductions and tax liability', pages: 6 },
    { id: 'net-worth',   title: 'Net Worth',       icon: DollarSign,  description: 'Assets, liabilities, equity', pages: 2 },
  ];

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Financial Reports</h1>
          <p className="text-dark-400 text-sm mt-0.5">Analyze your financial performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleExportCSV} leftIcon={<Download className="w-4 h-4" />} size="sm">
            Export CSV
          </Button>
          <Button size="sm" leftIcon={<FileText className="w-4 h-4" />} onClick={handleGeneratePDF}>
            Generate PDF
          </Button>
        </div>
      </div>

      {/* ── Selectors row ──────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Report type tabs */}
        <div className="flex items-center gap-1 bg-dark-900 border border-dark-700/60 rounded-xl p-1">
          {reportTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setReportType(tab.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  reportType === tab.value
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                    : 'text-dark-400 hover:text-dark-200'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 bg-dark-900 border border-dark-700/60 rounded-xl p-1">
          {periodOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                period === opt.value ? 'bg-dark-700 text-white' : 'text-dark-400 hover:text-dark-200'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Stats ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Income"   value={formatCurrency(periodStats.income)}   change={periodStats.incomeChange}  icon={TrendingUp}  color="text-emerald-400" bg="bg-emerald-500/15" sub="vs prior period" />
        <StatCard label="Total Expenses" value={formatCurrency(periodStats.expenses)} change={periodStats.expenseChange} icon={TrendingDown} color="text-red-400"     bg="bg-red-500/15"     sub="vs prior period" />
        <StatCard label="Net Profit"     value={formatCurrency(periodStats.net)}                                         icon={DollarSign}  color="text-primary-400" bg="bg-primary-500/15" sub={`${periodStats.savingsRate}% savings rate`} />
        <StatCard label="Savings Rate"   value={`${periodStats.savingsRate}%`}                                           icon={BarChart3}   color="text-violet-400" bg="bg-violet-500/15"  sub="of total income" />
      </div>

      {/* ── Main Chart ─────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${reportType}-${period}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="bg-dark-900 border border-dark-700/60 rounded-2xl p-5"
        >
          {/* Chart header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white">
                {reportType === 'overview' ? 'Income vs Expenses'
                  : reportType === 'income'   ? 'Income Trend'
                  : reportType === 'expenses' ? 'Expense Trend'
                  : 'Cash Flow'}
              </h2>
              {isSingleMonth && (
                <p className="text-xs text-dark-500 mt-0.5">
                  {chartData[chartData.length - 1]?.month} — single month view
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-dark-400">
              {reportType !== 'expenses' && reportType !== 'cashflow' && (
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Income</span>
              )}
              {reportType !== 'income' && reportType !== 'cashflow' && (
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" />Expenses</span>
              )}
              {reportType === 'overview' && (
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-500" />Net</span>
              )}
              {reportType === 'cashflow' && (
                <>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80" />Inflow</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400/80" />Outflow</span>
                </>
              )}
            </div>
          </div>

          {/* 1M — single month summary cards (AreaChart needs ≥2 points) */}
          {isSingleMonth ? (
            <SingleMonthView data={chartData[chartData.length - 1]} type={reportType} />
          ) : reportType === 'cashflow' ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cashflowData} barGap={4} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2032" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${v / 1000}k`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="inflow"  name="inflow"  fill="#10b981" opacity={0.8} radius={[4, 4, 0, 0]} animationDuration={900} />
                <Bar dataKey="outflow" name="outflow" fill="#ef4444" opacity={0.8} radius={[4, 4, 0, 0]} animationDuration={900} animationBegin={200} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2032" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${v / 1000}k`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTooltip />} />
                {reportType !== 'expenses' && (
                  <Area type="monotone" dataKey="income"   name="income"   stroke="#10b981" strokeWidth={2} fill="url(#incomeGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                )}
                {reportType !== 'income' && (
                  <Area type="monotone" dataKey="expenses" name="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)"   dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                )}
                {reportType === 'overview' && (
                  <Area type="monotone" dataKey="net"      name="net"      stroke="#6366f1" strokeWidth={2} fill="url(#netGrad)"   dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Breakdown charts ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Expense pie */}
        <div className="bg-dark-900 border border-dark-700/60 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-primary-400" />
              <h2 className="font-semibold text-white">Expense Breakdown</h2>
            </div>
            <span className="text-xs text-dark-400">Feb 2025</span>
          </div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={expenseCategoryData}
                  cx="50%" cy="50%"
                  innerRadius={46} outerRadius={70}
                  paddingAngle={2} dataKey="value"
                  onMouseEnter={(_, i) => setActiveSlice(i)}
                  onMouseLeave={() => setActiveSlice(null)}
                >
                  {expenseCategoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={activeSlice === null || activeSlice === i ? 1 : 0.35} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5 min-w-0">
              {expenseCategoryData.slice(0, 6).map((item, i) => (
                <div
                  key={item.name}
                  className={cn('flex items-center justify-between text-xs cursor-default', activeSlice === i ? 'opacity-100' : activeSlice !== null ? 'opacity-40' : 'opacity-100')}
                  onMouseEnter={() => setActiveSlice(i)}
                  onMouseLeave={() => setActiveSlice(null)}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-dark-300 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-dark-500">{item.percent}%</span>
                    <span className="text-white font-semibold tabular-nums">{formatCurrency(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Income sources */}
        <div className="bg-dark-900 border border-dark-700/60 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="font-semibold text-white">Income Sources</h2>
            </div>
            <span className="text-xs text-dark-400">Feb 2025</span>
          </div>
          <div className="space-y-4">
            {incomeSourceData.map(source => (
              <div key={source.name}>
                <div className="flex items-center justify-between mb-1.5 text-sm">
                  <span className="text-dark-300">{source.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-dark-500 text-xs">{source.percent}%</span>
                    <span className="text-white font-semibold tabular-nums">{formatCurrency(source.value)}</span>
                  </div>
                </div>
                <div className="h-2.5 bg-dark-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: source.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${source.percent}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-dark-800 flex items-center justify-between">
            <span className="text-sm text-dark-400">Total Income (Feb)</span>
            <span className="text-lg font-bold text-white tabular-nums">{formatCurrency(10200)}</span>
          </div>
        </div>
      </div>

      {/* ── Top Transactions ───────────────────────── */}
      <div className="bg-dark-900 border border-dark-700/60 rounded-2xl">
        <div className="flex items-center justify-between p-5 border-b border-dark-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-400" />
            <h2 className="font-semibold text-white">Top Transactions</h2>
          </div>
          <div className="flex items-center gap-1 bg-dark-800 border border-dark-700 rounded-xl p-1">
            <button
              onClick={() => setShowIncome(true)}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-all', showIncome ? 'bg-emerald-500/20 text-emerald-400' : 'text-dark-400 hover:text-dark-200')}
            >
              Income
            </button>
            <button
              onClick={() => setShowIncome(false)}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-all', !showIncome ? 'bg-red-500/20 text-red-400' : 'text-dark-400 hover:text-dark-200')}
            >
              Expenses
            </button>
          </div>
        </div>
        <div className="divide-y divide-dark-800/70">
          {topTransactions
            .filter(t => showIncome ? t.type === 'income' : t.type === 'expense')
            .map((txn, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-dark-800/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-dark-600 w-5 text-right flex-shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{txn.name}</p>
                    <p className="text-xs text-dark-500">{txn.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {txn.change !== 0 && (
                    <span className={cn('flex items-center gap-0.5 text-xs',
                      txn.change > 0
                        ? (txn.type === 'income' ? 'text-emerald-400' : 'text-red-400')
                        : (txn.type === 'income' ? 'text-red-400'     : 'text-emerald-400')
                    )}>
                      {txn.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(txn.change)}%
                    </span>
                  )}
                  <span className={cn('text-sm font-semibold tabular-nums', txn.type === 'income' ? 'text-emerald-400' : 'text-white')}>
                    {txn.type === 'income' ? '+' : ''}{formatCurrency(txn.amount)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── Generate Reports ───────────────────────── */}
      <div className="bg-dark-900 border border-dark-700/60 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <FileText className="w-5 h-5 text-primary-400" />
          <div>
            <h2 className="font-semibold text-white">Generate Reports</h2>
            <p className="text-xs text-dark-500 mt-0.5">Generate then download as CSV</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {reportTemplates.map(template => {
            const Icon       = template.icon;
            const isGen      = generating === template.id;
            const isDone     = generated.includes(template.id);
            return (
              <div key={template.id} className="flex items-center justify-between p-4 bg-dark-800/60 border border-dark-700/60 rounded-xl hover:border-dark-600/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-500/15 rounded-xl">
                    <Icon className="w-4 h-4 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{template.title}</p>
                    <p className="text-xs text-dark-400">{template.description} · {template.pages}p</p>
                  </div>
                </div>
                <button
                  onClick={() => isDone ? handleDownloadReport(template.id) : (!isGen && handleGenerateReport(template.id))}
                  disabled={isGen}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0',
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                      : isGen
                      ? 'bg-dark-700 text-dark-500 cursor-not-allowed'
                      : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
                  )}
                >
                  {isDone
                    ? <><Download  className="w-3.5 h-3.5" />Download</>
                    : isGen
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Generating…</>
                    : <><Eye       className="w-3.5 h-3.5" />Generate</>
                  }
                </button>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
