import React, { forwardRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { Loader2, Check, AlertCircle, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// TYPES
// ============================================

type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'ghost' 
  | 'outline' 
  | 'danger' 
  | 'success' 
  | 'warning'
  | 'gradient';

type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  state?: ButtonState;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showArrow?: boolean;
  external?: boolean;
  href?: string;
  children?: React.ReactNode;
}

// ============================================
// STYLES
// ============================================

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40',
  secondary: 'bg-dark-800 text-white hover:bg-dark-700 border border-dark-700',
  ghost: 'bg-transparent text-dark-300 hover:text-white hover:bg-white/10',
  outline: 'bg-transparent text-primary-400 border border-primary-500/50 hover:bg-primary-500/10 hover:border-primary-500',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/25',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25',
  warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/25',
  gradient: 'bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 text-white hover:opacity-90 shadow-lg shadow-primary-500/25',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
  xl: 'h-14 px-8 text-lg gap-3 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
};

// ============================================
// BUTTON COMPONENT
// ============================================

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      state = 'idle',
      loading = false,
      disabled = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      showArrow = false,
      external = false,
      href,
      children,
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading || state === 'loading';
    const currentState = loading ? 'loading' : state;

    const renderIcon = () => {
      switch (currentState) {
        case 'loading':
          return <Loader2 className="w-4 h-4 animate-spin" />;
        case 'success':
          return <Check className="w-4 h-4" />;
        case 'error':
          return <AlertCircle className="w-4 h-4" />;
        default:
          return null;
      }
    };

    const content = (
      <>
        {currentState !== 'idle' && renderIcon()}
        {currentState === 'idle' && leftIcon}
        {size !== 'icon' && children}
        {currentState === 'idle' && rightIcon}
        {showArrow && currentState === 'idle' && (
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        )}
        {external && currentState === 'idle' && (
          <ExternalLink className="w-3.5 h-3.5" />
        )}
      </>
    );

    const buttonClasses = cn(
      'group relative inline-flex items-center justify-center font-medium transition-all duration-200',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      variantStyles[variant],
      sizeStyles[size],
      fullWidth && 'w-full',
      className
    );

    // Render as link if href is provided
    if (href && !isDisabled) {
      return (
        <motion.a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          className={buttonClasses}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {content}
        </motion.a>
      );
    }

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        className={buttonClasses}
        onClick={onClick}
        whileHover={isDisabled ? undefined : { scale: 1.02 }}
        whileTap={isDisabled ? undefined : { scale: 0.98 }}
        {...props}
      >
        {content}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
