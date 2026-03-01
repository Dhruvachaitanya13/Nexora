import React, { forwardRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Search, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// TYPES
// ============================================

type InputVariant = 'default' | 'filled' | 'outline' | 'ghost';
type InputSize = 'sm' | 'md' | 'lg';
type InputState = 'default' | 'error' | 'success' | 'warning';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: InputVariant;
  size?: InputSize;
  state?: InputState;
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  loading?: boolean;
  onClear?: () => void;
  showPasswordToggle?: boolean;
  showStrength?: boolean;
}

// ============================================
// STYLES
// ============================================

const variantStyles: Record<InputVariant, string> = {
  default: 'bg-dark-800/50 border border-dark-700 focus:border-primary-500',
  filled: 'bg-dark-800 border border-transparent focus:border-primary-500',
  outline: 'bg-transparent border-2 border-dark-700 focus:border-primary-500',
  ghost: 'bg-transparent border border-transparent focus:border-dark-700',
};

const sizeStyles: Record<InputSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-sm rounded-xl',
  lg: 'h-14 px-5 text-base rounded-xl',
};

const stateStyles: Record<InputState, string> = {
  default: '',
  error: 'border-red-500 focus:border-red-500',
  success: 'border-emerald-500 focus:border-emerald-500',
  warning: 'border-amber-500 focus:border-amber-500',
};

// ============================================
// INPUT COMPONENT
// ============================================

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant = 'default',
      size = 'md',
      state = 'default',
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      clearable,
      loading,
      onClear,
      showPasswordToggle,
      showStrength,
      className,
      type = 'text',
      value,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const actualType = type === 'password' && showPassword ? 'text' : type;
    const actualState = error ? 'error' : state;
    const hasValue = value !== undefined && value !== '';

    return (
      <div className={cn('w-full', className)}>
        {/* Label */}
        {label && (
          <label className="block text-sm font-medium text-dark-300 mb-2">
            {label}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            type={actualType}
            value={value}
            disabled={disabled || loading}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            className={cn(
              'w-full text-white placeholder-dark-500 transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              variantStyles[variant],
              sizeStyles[size],
              stateStyles[actualState],
              leftIcon && 'pl-10',
              (rightIcon || clearable || showPasswordToggle || loading) && 'pr-10'
            )}
            {...props}
          />

          {/* Right Icons */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 text-dark-500 animate-spin" />}
            
            {clearable && hasValue && !loading && (
              <button
                type="button"
                onClick={onClear}
                className="text-dark-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            {showPasswordToggle && type === 'password' && !loading && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-dark-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
            
            {rightIcon && !loading && rightIcon}
            
            {actualState === 'success' && !loading && (
              <Check className="w-4 h-4 text-emerald-500" />
            )}
            
            {actualState === 'error' && !loading && (
              <AlertCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>

        {/* Helper Text / Error */}
        <AnimatePresence mode="wait">
          {(error || helperText) && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={cn(
                'mt-2 text-sm',
                error ? 'text-red-400' : 'text-dark-500'
              )}
            >
              {error || helperText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================
// SEARCH INPUT COMPONENT
// ============================================

interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'type'> {
  onSearch?: (value: string) => void;
}

export function SearchInput({ onSearch, ...props }: SearchInputProps) {
  return (
    <Input
      type="text"
      leftIcon={<Search className="w-4 h-4" />}
      clearable
      placeholder="Search..."
      {...props}
    />
  );
}

// ============================================
// PASSWORD INPUT COMPONENT
// ============================================

interface PasswordInputProps extends Omit<InputProps, 'type' | 'showPasswordToggle'> {
  showStrength?: boolean;
}

export function PasswordInput({ showStrength = false, value, ...props }: PasswordInputProps) {
  const getStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const strength = showStrength && typeof value === 'string' ? getStrength(value) : 0;
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'];
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div>
      <Input
        type="password"
        showPasswordToggle
        value={value}
        {...props}
      />
      {showStrength && typeof value === 'string' && value.length > 0 && (
        <div className="mt-2">
          <div className="flex gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  level <= strength ? strengthColors[strength - 1] : 'bg-dark-700'
                )}
              />
            ))}
          </div>
          <p className={cn('text-xs', strength <= 2 ? 'text-red-400' : strength <= 3 ? 'text-amber-400' : 'text-emerald-400')}>
            {strengthLabels[strength - 1] || 'Enter password'}
          </p>
        </div>
      )}
    </div>
  );
}

export default Input;
