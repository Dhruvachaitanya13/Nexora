/* ============================================
   NEXORA - SIDEBAR COMPONENT
   Main navigation sidebar with upgrade + payment flow
   ============================================ */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Receipt, Building2, Calculator, Brain,
  Target, FileText, ChevronLeft, ChevronRight, ChevronDown,
  Sparkles, PiggyBank, X, BarChart3, Landmark,
  Check, Zap, CreditCard, Shield, Star, Crown, Infinity as InfinityIcon,
  HeadphonesIcon, Lock, ArrowLeft, CheckCircle2, Mail,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { cn, getInitials } from '../../lib/utils';
import Button from '../ui/Button';

// ============================================
// TYPES
// ============================================

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string | number;
  badgeColor?: string;
  children?: NavItem[];
  isNew?: boolean;
  isPro?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

type BillingCycle = 'monthly' | 'yearly';
type PaymentStep  = 'form' | 'processing' | 'success';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: { monthly: number; yearly: number };
  color: string;
  accentColor: string;
  badge?: string;
  highlight?: boolean;
  icon: React.ElementType;
  features: { label: string; included: boolean }[];
  cta: string;
  ctaVariant: 'primary' | 'secondary' | 'gradient';
  ctaDisabled?: boolean;
}

// ============================================
// NAVIGATION DATA
// ============================================

const navigationSections: NavSection[] = [
  {
    items: [
      { id: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard, href: '/'        },
      { id: 'advisor',   label: 'AI Advisor',   icon: Brain,           href: '/advisor', isNew: true },
      { id: 'chicago',   label: 'Chicago Hub',  icon: Landmark,        href: '/chicago', isNew: true },
    ],
  },
  {
    title: 'Finance',
    items: [
      { id: 'transactions', label: 'Transactions', icon: Receipt,   href: '/transactions', badge: 5 },
      { id: 'accounts',     label: 'Accounts',     icon: Building2, href: '/accounts' },
      { id: 'invoices',     label: 'Invoices',     icon: FileText,  href: '/invoices', badge: 2, badgeColor: 'amber' },
      { id: 'tax',          label: 'Tax Center',   icon: Calculator,href: '/tax' },
    ],
  },
  {
    title: 'Planning',
    items: [
      { id: 'goals',   label: 'Goals',   icon: Target,   href: '/goals' },
      { id: 'budgets', label: 'Budgets', icon: PiggyBank, href: '/budgets' },
      { id: 'reports', label: 'Reports', icon: BarChart3, href: '/reports', isPro: true },
    ],
  },
];

// ============================================
// PLAN DATA
// ============================================

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for getting started',
    price: { monthly: 0, yearly: 0 },
    color: 'border-dark-700',
    accentColor: 'text-dark-300',
    icon: Zap,
    features: [
      { label: 'Up to 3 bank accounts',        included: true  },
      { label: 'Basic transaction tracking',    included: true  },
      { label: '3 months history',              included: true  },
      { label: 'AI Advisor (5 queries/mo)',      included: true  },
      { label: 'Advanced reports & analytics',  included: false },
      { label: 'Unlimited AI queries',          included: false },
      { label: 'Tax exports & summaries',       included: false },
      { label: 'Priority support',              included: false },
    ],
    cta: 'Current Plan',
    ctaVariant: 'secondary',
    ctaDisabled: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For serious financial management',
    price: { monthly: 19, yearly: 15 },
    color: 'border-primary-500',
    accentColor: 'text-primary-400',
    badge: 'Most Popular',
    highlight: true,
    icon: Star,
    features: [
      { label: 'Unlimited bank accounts',       included: true },
      { label: 'Advanced transaction tracking', included: true },
      { label: 'Full history & exports',        included: true },
      { label: 'Unlimited AI queries',          included: true },
      { label: 'Advanced reports & analytics',  included: true },
      { label: 'Goal & budget tracking',        included: true },
      { label: 'Tax exports & summaries',       included: true },
      { label: 'Priority support',              included: true },
    ],
    cta: 'Start Free Trial',
    ctaVariant: 'gradient',
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For growing teams & businesses',
    price: { monthly: 49, yearly: 39 },
    color: 'border-purple-500/60',
    accentColor: 'text-purple-400',
    icon: Crown,
    features: [
      { label: 'Everything in Pro',             included: true },
      { label: 'Team collaboration (5 users)',  included: true },
      { label: 'Custom integrations & API',     included: true },
      { label: 'Dedicated account manager',     included: true },
      { label: 'Custom reporting & white-label',included: true },
      { label: 'SLA guarantee (99.9% uptime)',  included: true },
      { label: 'SSO & advanced security',       included: true },
      { label: '24/7 phone support',            included: true },
    ],
    cta: 'Contact Sales',
    ctaVariant: 'secondary',
  },
];

// ============================================
// ANIMATIONS
// ============================================

const EASE = [0.25, 0.1, 0.25, 1] as [number, number, number, number];

const sidebarVariants = {
  expanded: { width: 280, transition: { duration: 0.3, ease: EASE } },
  collapsed: { width: 80,  transition: { duration: 0.3, ease: EASE } },
};

const itemVariants = {
  expanded: { opacity: 1, x: 0,   transition: { duration: 0.2 } },
  collapsed: { opacity: 0, x: -10, transition: { duration: 0.2 } },
};

const tooltipVariants = {
  hidden:  { opacity: 0, x: -10, scale: 0.95 },
  visible: { opacity: 1, x: 0,   scale: 1, transition: { duration: 0.15 } },
};

// ============================================
// CARD FORMAT HELPERS
// ============================================

function fmtCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ');
}
function fmtExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
}
function trialEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ============================================
// NAV ITEM COMPONENT
// ============================================

function NavItemComponent({
  item, isCollapsed, isActive, depth = 0,
}: {
  item: NavItem; isCollapsed: boolean; isActive: boolean; depth?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const hasChildren = !!(item.children?.length);
  const location = useLocation();
  const isChildActive = hasChildren && item.children?.some(c => location.pathname === c.href);

  return (
    <div className="relative">
      <NavLink
        to={hasChildren ? '#' : item.href}
        onClick={e => { if (hasChildren) { e.preventDefault(); setIsExpanded(!isExpanded); } }}
        onMouseEnter={() => isCollapsed && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={({ isActive: linkActive }) => cn(
          'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative hover:bg-white/5',
          (linkActive || isActive || isChildActive) && !hasChildren
            ? 'bg-primary-500/20 text-primary-400'
            : 'text-dark-400 hover:text-white',
          depth > 0 && 'ml-4 text-sm',
          isCollapsed && 'justify-center px-0',
        )}
      >
        {(isActive || isChildActive) && !hasChildren && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200',
          (isActive || isChildActive) && !hasChildren
            ? 'bg-primary-500/20 text-primary-400'
            : 'text-dark-400 group-hover:text-white',
          isCollapsed && 'w-10 h-10',
        )}>
          <item.icon className="w-5 h-5" />
        </div>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div variants={itemVariants} initial="collapsed" animate="expanded" exit="collapsed"
              className="flex-1 flex items-center justify-between min-w-0">
              <span className="font-medium truncate">{item.label}</span>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                    item.badgeColor === 'amber' ? 'bg-amber-500/20 text-amber-400' : 'bg-primary-500/20 text-primary-400')}>
                    {item.badge}
                  </span>
                )}
                {item.isNew && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">New</span>}
                {item.isPro && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">Pro</span>}
                {hasChildren && (
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4 text-dark-500" />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isCollapsed && showTooltip && (
            <motion.div variants={tooltipVariants} initial="hidden" animate="visible" exit="hidden"
              className="absolute left-full ml-3 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 whitespace-nowrap">
              <span className="text-sm text-white font-medium">{item.label}</span>
              {item.badge && <span className="ml-2 text-xs text-primary-400">({item.badge})</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </NavLink>

      <AnimatePresence>
        {hasChildren && isExpanded && !isCollapsed && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mt-1 space-y-1">
            {item.children?.map(child => (
              <NavItemComponent key={child.id} item={child} isCollapsed={isCollapsed}
                isActive={location.pathname === child.href} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// QUICK STATS (placeholder)
// ============================================

function QuickStats({ isCollapsed }: { isCollapsed: boolean }) {
  if (isCollapsed) return null;
  return null;
}

// ============================================
// USER MENU (static display)
// ============================================

function UserMenu({ isCollapsed }: { isCollapsed: boolean }) {
  const { user } = useAuthStore();
  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-xl', isCollapsed && 'justify-center')}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white font-medium flex-shrink-0">
        {user?.avatar_url
          ? <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-xl object-cover" />
          : getInitials(user?.full_name || 'User')}
      </div>
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div variants={itemVariants} initial="collapsed" animate="expanded" exit="collapsed" className="flex-1 min-w-0">
            <p className="font-medium text-white truncate text-sm">{user?.full_name}</p>
            <p className="text-xs text-dark-500 truncate">{user?.email}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// PAYMENT MODAL
// ============================================

function PaymentModal({
  plan, billing, onClose, onBack,
}: {
  plan: Plan; billing: BillingCycle; onClose: () => void; onBack: () => void;
}) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep]       = useState<PaymentStep>('form');
  const [cardNum, setCardNum] = useState('');
  const [cardName, setCardName] = useState(user?.full_name || '');
  const [expiry, setExpiry]   = useState('');
  const [cvv, setCvv]         = useState('');
  const [email, setEmail]     = useState(user?.email || '');
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [processingMsg, setProcessingMsg] = useState('Verifying card details...');

  const price      = billing === 'yearly' ? plan.price.yearly : plan.price.monthly;
  const yearlyTotal = price * 12;

  const validate = () => {
    const e: Record<string, string> = {};
    if (cardNum.replace(/\s/g, '').length < 16) e.cardNum = 'Enter a valid 16-digit card number';
    if (!cardName.trim())                        e.cardName = 'Cardholder name is required';
    if (expiry.length < 5)                       e.expiry = 'Enter a valid MM/YY expiry';
    if (cvv.length < 3)                          e.cvv = 'Enter a valid CVV';
    if (!email.includes('@'))                    e.email = 'Enter a valid email address';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setStep('processing');
    const msgs = [
      'Verifying card details...',
      'Setting up your account...',
      'Activating Pro features...',
    ];
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (i < msgs.length) setProcessingMsg(msgs[i]);
      else { clearInterval(t); setStep('success'); }
    }, 800);
  };

  const inputClass = (field: string) => cn(
    'w-full bg-dark-800/80 border rounded-xl px-4 py-3 text-sm text-white placeholder-dark-500',
    'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/60 transition-all',
    errors[field] ? 'border-red-500/60 bg-red-500/5' : 'border-dark-600/60 hover:border-dark-500',
  );

  return (
    <AnimatePresence mode="wait">
      {/* Backdrop */}
      <motion.div key="pay-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110]" onClick={step === 'form' ? onBack : undefined} />

      {/* Modal */}
      <motion.div key="pay-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.22, ease: EASE }}
        className="fixed inset-0 flex items-center justify-center z-[111] p-4"
        onClick={e => e.stopPropagation()}
      >

        {/* ── FORM STEP ── */}
        {step === 'form' && (
          <div className="bg-dark-900 border border-dark-700/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-dark-800">
              <button onClick={onBack}
                className="flex items-center gap-2 text-sm text-dark-400 hover:text-white transition-colors group">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to plans
              </button>
              <button onClick={onClose} className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Plan summary */}
              <div className="bg-gradient-to-r from-primary-500/10 to-purple-500/10 border border-primary-500/25 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary-400" />
                    <span className="font-semibold text-white">{plan.name} Plan — {billing === 'yearly' ? 'Yearly' : 'Monthly'}</span>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {billing === 'yearly' ? `$${yearlyTotal}/yr` : `$${price}/mo`}
                  </span>
                </div>
                <p className="text-xs text-dark-400">
                  {billing === 'yearly'
                    ? `$${price}/mo × 12 months = $${yearlyTotal} billed today`
                    : `$${price} billed monthly`}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/25">
                    14-day free trial
                  </span>
                  <span className="text-xs text-dark-500">· No charge today · Cancel anytime</span>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-1.5">Billing Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                  <input value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={cn(inputClass('email'), 'pl-10')} />
                </div>
                {errors.email && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
              </div>

              {/* Card Number */}
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-1.5">Card Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                  <input
                    value={cardNum}
                    onChange={e => setCardNum(fmtCard(e.target.value))}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className={cn(inputClass('cardNum'), 'pl-10 tracking-widest font-mono')}
                  />
                </div>
                {errors.cardNum && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.cardNum}</p>}
              </div>

              {/* Cardholder Name */}
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-1.5">Cardholder Name</label>
                <input value={cardName} onChange={e => setCardName(e.target.value)}
                  placeholder="Full name as on card"
                  className={inputClass('cardName')} />
                {errors.cardName && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.cardName}</p>}
              </div>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1.5">Expiry Date</label>
                  <input value={expiry}
                    onChange={e => setExpiry(fmtExpiry(e.target.value))}
                    placeholder="MM/YY" maxLength={5}
                    className={cn(inputClass('expiry'), 'font-mono tracking-widest')} />
                  {errors.expiry && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.expiry}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1.5">CVV</label>
                  <div className="relative">
                    <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="•••" maxLength={4} type="password"
                      className={cn(inputClass('cvv'), 'font-mono tracking-widest')} />
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-600" />
                  </div>
                  {errors.cvv && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.cvv}</p>}
                </div>
              </div>

              {/* Submit */}
              <Button variant="gradient" size="lg" fullWidth onClick={handleSubmit}
                leftIcon={<Lock className="w-4 h-4" />}>
                Start Free Trial — No Charge Today
              </Button>

              {/* Trust row */}
              <div className="flex items-center justify-center gap-4 text-xs text-dark-600">
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> 256-bit SSL</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> PCI-DSS compliant</span>
                <span>·</span>
                <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> Visa · MC · Amex</span>
              </div>
            </div>
          </div>
        )}

        {/* ── PROCESSING STEP ── */}
        {step === 'processing' && (
          <motion.div key="processing"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-900 border border-dark-700/80 rounded-2xl shadow-2xl w-full max-w-sm p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-xl shadow-primary-500/30">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <Sparkles className="w-7 h-7 text-white" />
              </motion.div>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Setting Up Your Account</h3>
            <AnimatePresence mode="wait">
              <motion.p key={processingMsg}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="text-sm text-dark-400 mb-6">
                {processingMsg}
              </motion.p>
            </AnimatePresence>
            <div className="flex items-center justify-center gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-primary-500"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === 'success' && (
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="bg-dark-900 border border-dark-700/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Celebration gradient bar */}
            <div className="h-1.5 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500" />

            <div className="p-8 text-center">
              {/* Animated checkmark */}
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 18 }}
                className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center"
              >
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 20 }}>
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </motion.div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to {plan.name}! 🎉</h2>
                <p className="text-dark-400 text-sm mb-1">Your 14-day free trial has started.</p>
                <p className="text-dark-500 text-xs mb-6">
                  First charge of <span className="text-white font-medium">
                    {billing === 'yearly' ? `$${price * 12}` : `$${price}`}
                  </span> on <span className="text-white font-medium">{trialEndDate()}</span>. Cancel anytime before that.
                </p>
              </motion.div>

              {/* What's unlocked */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="bg-dark-800/60 border border-dark-700/60 rounded-xl p-4 text-left mb-6 space-y-2">
                <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">Unlocked for you</p>
                {plan.features.filter(f => f.included).slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-dark-300">{f.label}</span>
                  </div>
                ))}
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="flex flex-col gap-3">
                <Button variant="gradient" size="lg" fullWidth onClick={() => { onClose(); navigate('/'); }}>
                  Go to Dashboard
                </Button>
                <button onClick={() => { onClose(); navigate('/advisor'); }}
                  className="text-sm text-dark-400 hover:text-white transition-colors">
                  Explore AI Advisor →
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}

      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// UPGRADE MODAL (plan selection)
// ============================================

function UpgradeModal({
  onClose, onStartTrial,
}: {
  onClose: () => void;
  onStartTrial: (plan: Plan, billing: BillingCycle) => void;
}) {
  const [billing, setBilling] = useState<BillingCycle>('yearly');

  return (
    <AnimatePresence>
      <motion.div key="upgrade-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100]" />

      <motion.div key="upgrade-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.22, ease: EASE }}
        className="fixed inset-0 flex items-center justify-center z-[101] p-4"
        onClick={e => e.stopPropagation()}>

        <div className="bg-dark-900 border border-dark-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">

          {/* Header */}
          <div className="relative px-8 pt-8 pb-6 text-center border-b border-dark-800">
            <button onClick={onClose}
              className="absolute right-5 top-5 p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-xl shadow-primary-500/30">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Unlock Your Financial Potential</h2>
            <p className="text-dark-400 text-sm max-w-md mx-auto">
              Choose the plan that fits your needs. All plans include a 14-day free trial — no credit card required to start.
            </p>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mt-5">
              <span className={cn('text-sm font-medium transition-colors', billing === 'monthly' ? 'text-white' : 'text-dark-500')}>Monthly</span>
              <button onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
                className={cn('relative w-11 h-6 rounded-full transition-colors duration-200', billing === 'yearly' ? 'bg-primary-500' : 'bg-dark-700')}>
                <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200', billing === 'yearly' ? 'left-[22px]' : 'left-0.5')} />
              </button>
              <span className={cn('text-sm font-medium flex items-center gap-1.5 transition-colors', billing === 'yearly' ? 'text-white' : 'text-dark-500')}>
                Yearly
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">SAVE 20%</span>
              </span>
            </div>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
            {plans.map((plan, idx) => {
              const Icon  = plan.icon;
              const price = billing === 'yearly' ? plan.price.yearly : plan.price.monthly;
              return (
                <motion.div key={plan.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.2 }}
                  className={cn(
                    'relative flex flex-col rounded-2xl border p-5 transition-all',
                    plan.highlight
                      ? 'bg-gradient-to-b from-primary-500/10 to-purple-500/5 border-primary-500 shadow-lg shadow-primary-500/15'
                      : 'bg-dark-800/50 hover:bg-dark-800/80',
                    plan.color,
                  )}>

                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-gradient-to-r from-primary-500 to-purple-500 text-white text-xs font-bold rounded-full shadow-lg shadow-primary-500/30">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', plan.highlight ? 'bg-primary-500/20' : 'bg-dark-700')}>
                      <Icon className={cn('w-4.5 h-4.5', plan.accentColor)} style={{ width: 18, height: 18 }} />
                    </div>
                    <div>
                      <p className="font-bold text-white">{plan.name}</p>
                      <p className="text-xs text-dark-400">{plan.description}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    {price === 0 ? (
                      <span className="text-3xl font-bold text-white">Free</span>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-dark-500 text-sm">$</span>
                        <span className="text-3xl font-bold text-white">{price}</span>
                        <span className="text-dark-500 text-sm">/mo</span>
                      </div>
                    )}
                    {billing === 'yearly' && price > 0 && (
                      <p className="text-xs text-dark-500 mt-0.5">
                        ${price * 12}/yr · save ${(plan.price.monthly - price) * 12}/yr
                      </p>
                    )}
                  </div>

                  <div className="border-t border-dark-700/60 mb-4" />

                  <ul className="space-y-2.5 flex-1 mb-5">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={cn(
                          'rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                          feat.included
                            ? plan.highlight ? 'bg-primary-500/20 text-primary-400' : 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-dark-700/60 text-dark-600',
                        )} style={{ width: 18, height: 18 }}>
                          {feat.included
                            ? <Check style={{ width: 10, height: 10 }} />
                            : <X style={{ width: 10, height: 10 }} />}
                        </span>
                        <span className={cn('text-xs leading-relaxed', feat.included ? 'text-dark-300' : 'text-dark-600 line-through')}>
                          {feat.label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={plan.ctaVariant}
                    size="sm"
                    fullWidth
                    disabled={plan.ctaDisabled}
                    onClick={plan.ctaDisabled ? undefined : () => {
                      if (plan.id === 'business') {
                        window.open('mailto:sales@nexora.app?subject=Business Plan Inquiry', '_blank');
                      } else {
                        onStartTrial(plan, billing);
                      }
                    }}
                  >
                    {plan.cta}
                  </Button>
                </motion.div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-dark-800 bg-dark-900/50 rounded-b-2xl">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-dark-500">
              <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-dark-600" />No credit card required</span>
              <span className="text-dark-700">·</span>
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-dark-600" />Bank-level encryption</span>
              <span className="text-dark-700">·</span>
              <span className="flex items-center gap-1.5"><InfinityIcon className="w-3.5 h-3.5 text-dark-600" />Cancel anytime</span>
              <span className="text-dark-700">·</span>
              <span className="flex items-center gap-1.5"><HeadphonesIcon className="w-3.5 h-3.5 text-dark-600" />14-day free trial</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// UPGRADE BANNER
// ============================================

function UpgradeBanner({ isCollapsed }: { isCollapsed: boolean }) {
  const [upgradeOpen,  setUpgradeOpen]  = useState(false);
  const [paymentData,  setPaymentData]  = useState<{ plan: Plan; billing: BillingCycle } | null>(null);

  if (isCollapsed) return null;

  const handleStartTrial = (plan: Plan, billing: BillingCycle) => {
    setUpgradeOpen(false);
    setPaymentData({ plan, billing });
  };

  return (
    <>
      <motion.div variants={itemVariants} initial="collapsed" animate="expanded" exit="collapsed"
        className="mx-3 p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-white">Upgrade to Pro</span>
        </div>
        <p className="text-xs text-dark-400 mb-3">Unlock advanced features, unlimited AI, and more.</p>
        <Button variant="gradient" size="sm" fullWidth onClick={() => setUpgradeOpen(true)}>
          Upgrade Now
        </Button>
      </motion.div>

      {/* Upgrade modal portal */}
      {upgradeOpen && createPortal(
        <UpgradeModal onClose={() => setUpgradeOpen(false)} onStartTrial={handleStartTrial} />,
        document.body,
      )}

      {/* Payment modal portal */}
      {paymentData && createPortal(
        <PaymentModal
          plan={paymentData.plan}
          billing={paymentData.billing}
          onClose={() => setPaymentData(null)}
          onBack={() => { setPaymentData(null); setUpgradeOpen(true); }}
        />,
        document.body,
      )}
    </>
  );
}

// ============================================
// MAIN SIDEBAR COMPONENT
// ============================================

export default function Sidebar({
  isCollapsed, onToggle, isMobile = false, onClose,
}: {
  isCollapsed: boolean; onToggle: () => void; isMobile?: boolean; onClose?: () => void;
}) {
  const location = useLocation();

  return (
    <>
      {isMobile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" />
      )}

      <motion.aside
        variants={sidebarVariants} initial={false}
        animate={isCollapsed && !isMobile ? 'collapsed' : 'expanded'}
        className={cn(
          'fixed top-0 left-0 h-full bg-dark-900/95 backdrop-blur-xl border-r border-dark-800 z-50 flex flex-col',
          isMobile ? 'w-72' : '',
        )}>

        {/* Logo */}
        <div className={cn('flex items-center h-16 px-4 border-b border-dark-800',
          isCollapsed && !isMobile ? 'justify-center' : 'justify-between')}>
          <AnimatePresence mode="wait">
            {(!isCollapsed || isMobile) && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <span className="text-white font-bold text-lg">N</span>
                </div>
                <div>
                  <h1 className="font-bold text-white">Nexora</h1>
                  <p className="text-xs text-dark-500">Financial Intelligence</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {isMobile ? (
            <button onClick={onClose} className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={onToggle}
              className={cn('p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-all', isCollapsed && 'mx-auto')}>
              {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-6 scrollbar-thin">
          {navigationSections.map((section, idx) => (
            <div key={idx}>
              {section.title && !isCollapsed && (
                <motion.h3 variants={itemVariants} initial="collapsed" animate="expanded"
                  className="px-3 mb-2 text-xs font-semibold text-dark-500 uppercase tracking-wider">
                  {section.title}
                </motion.h3>
              )}
              <div className="space-y-1">
                {section.items.map(item => (
                  <NavItemComponent key={item.id} item={item}
                    isCollapsed={isCollapsed && !isMobile} isActive={location.pathname === item.href} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="py-3"><QuickStats isCollapsed={isCollapsed && !isMobile} /></div>
        <div className="py-3"><UpgradeBanner isCollapsed={isCollapsed && !isMobile} /></div>
        <div className="p-3 border-t border-dark-800"><UserMenu isCollapsed={isCollapsed && !isMobile} /></div>
      </motion.aside>
    </>
  );
}
