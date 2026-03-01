import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info, X } from 'lucide-react';

// ============================================
// TYPES
// ============================================

type CardVariant = 'default' | 'glass' | 'gradient' | 'outline' | 'elevated';
type CardSize = 'sm' | 'md' | 'lg' | 'none';
type HoverEffect = 'none' | 'lift' | 'glow' | 'scale';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  size?: CardSize;
  hover?: HoverEffect;
  children: React.ReactNode;
}

// ============================================
// STYLES
// ============================================

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-dark-900 border border-dark-800',
  glass: 'bg-dark-900/50 backdrop-blur-xl border border-dark-800/50',
  gradient: 'bg-gradient-to-br from-dark-900 to-dark-800 border border-dark-700/50',
  outline: 'bg-transparent border-2 border-dark-700',
  elevated: 'bg-dark-900 border border-dark-800 shadow-xl shadow-black/20',
};

const sizeStyles: Record<CardSize, string> = {
  sm: 'p-4 rounded-xl',
  md: 'p-6 rounded-2xl',
  lg: 'p-8 rounded-3xl',
  none: '',
};

const hoverStyles: Record<HoverEffect, string> = {
  none: '',
  lift: 'hover:-translate-y-1 hover:shadow-xl transition-all duration-300',
  glow: 'hover:shadow-lg hover:shadow-primary-500/20 transition-all duration-300',
  scale: 'hover:scale-[1.02] transition-all duration-300',
};

// ============================================
// CARD COMPONENT
// ============================================

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', size = 'md', hover = 'none', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variantStyles[variant],
          sizeStyles[size],
          hoverStyles[hover],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// ============================================
// STAT CARD COMPONENT
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, change, trend, icon, className }: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-dark-400';

  return (
    <Card variant="glass" hover="lift" className={cn('relative overflow-hidden', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dark-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {change !== undefined && (
            <div className={cn('flex items-center gap-1 mt-2 text-sm', trendColor)}>
              {TrendIcon && <TrendIcon className="w-4 h-4" />}
              <span>{change > 0 ? '+' : ''}{change}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================
// ALERT CARD COMPONENT
// ============================================

interface AlertCardProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function AlertCard({ 
  type, 
  title, 
  message, 
  icon, 
  action, 
  dismissible, 
  onDismiss,
  className 
}: AlertCardProps) {
  const typeStyles = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  const defaultIcons = {
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'p-4 rounded-xl border flex items-start gap-4',
        typeStyles[type],
        className
      )}
    >
      <div className="flex-shrink-0">{icon || defaultIcons[type]}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm opacity-80 mt-1">{message}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-3 text-sm font-medium underline hover:no-underline"
          >
            {action.label}
          </button>
        )}
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}

export default Card;
