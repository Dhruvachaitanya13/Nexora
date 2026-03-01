/* ============================================
   FINTRACK AI - UTILITY FUNCTIONS
   Comprehensive utility library for the app
   ============================================ */

import { clsx, type ClassValue } from 'clsx';

// ============================================
// CLASS NAME UTILITIES
// ============================================

/**
 * Combines class names with clsx for conditional classes
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Creates a class name string from an object of conditional classes
 */
export function classNames(classes: Record<string, boolean>): string {
  return Object.entries(classes)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join(' ');
}

// ============================================
// NUMBER FORMATTING
// ============================================

/**
 * Formats a number as currency
 */
export function formatCurrency(
  amount: number,
  options: {
    currency?: string;
    locale?: string;
    compact?: boolean;
    showSign?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    compact = false,
    showSign = false,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options;

  const absAmount = Math.abs(amount);
  
  if (compact && absAmount >= 1000000) {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(absAmount);
    return showSign && amount > 0 ? `+${formatted}` : amount < 0 ? `-${formatted}` : formatted;
  }
  
  if (compact && absAmount >= 1000) {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(absAmount);
    return showSign && amount > 0 ? `+${formatted}` : amount < 0 ? `-${formatted}` : formatted;
  }

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(absAmount);

  if (showSign && amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Formats a number with thousand separators
 */
export function formatNumber(
  num: number,
  options: {
    locale?: string;
    compact?: boolean;
    decimals?: number;
  } = {}
): string {
  const { locale = 'en-US', compact = false, decimals } = options;

  if (compact) {
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formats a number as a percentage
 */
export function formatPercentage(
  value: number,
  options: {
    decimals?: number;
    showSign?: boolean;
    locale?: string;
  } = {}
): string {
  const { decimals = 1, showSign = true, locale = 'en-US' } = options;

  const formatted = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);

  if (showSign && value > 0) return `+${formatted}`;
  return formatted;
}

/**
 * Formats bytes to human readable format
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Rounds a number to specified decimal places
 */
export function roundTo(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Clamps a number between min and max
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Calculates percentage of a value
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Calculates percentage change between two values
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

// ============================================
// DATE & TIME FORMATTING
// ============================================

/**
 * Formats a date to various formats
 */
export function formatDate(
  date: Date | string | number,
  format: 'short' | 'long' | 'full' | 'relative' | 'time' | 'datetime' | 'iso' | 'month' | 'monthYear' = 'short'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(d.getTime())) return 'Invalid date';

  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    case 'long':
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    case 'full':
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    
    case 'relative':
      return getRelativeTime(d);
    
    case 'time':
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    case 'datetime':
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    
    case 'iso':
      return d.toISOString().split('T')[0];
    
    case 'month':
      return d.toLocaleDateString('en-US', { month: 'long' });
    
    case 'monthYear':
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    default:
      return d.toLocaleDateString();
  }
}

/**
 * Returns relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 5) return 'just now';
  if (diffSecs < 60) return `${diffSecs} seconds ago`;
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
}

/**
 * Checks if a date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/**
 * Checks if a date is in the past
 */
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < Date.now();
}

/**
 * Checks if a date is in the future
 */
export function isFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() > Date.now();
}

/**
 * Gets the number of days between two dates
 */
export function daysBetween(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Adds days to a date
 */
export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Gets the start of a period
 */
export function getStartOf(date: Date | string, period: 'day' | 'week' | 'month' | 'year'): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  
  switch (period) {
    case 'day':
      d.setHours(0, 0, 0, 0);
      break;
    case 'week':
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      break;
    case 'month':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
    case 'year':
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      break;
  }
  
  return d;
}

/**
 * Gets the end of a period
 */
export function getEndOf(date: Date | string, period: 'day' | 'week' | 'month' | 'year'): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  
  switch (period) {
    case 'day':
      d.setHours(23, 59, 59, 999);
      break;
    case 'week':
      d.setDate(d.getDate() + (6 - d.getDay()));
      d.setHours(23, 59, 59, 999);
      break;
    case 'month':
      d.setMonth(d.getMonth() + 1, 0);
      d.setHours(23, 59, 59, 999);
      break;
    case 'year':
      d.setMonth(11, 31);
      d.setHours(23, 59, 59, 999);
      break;
  }
  
  return d;
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Gets initials from a name
 */
export function getInitials(name: string, maxLength: number = 2): string {
  if (!name) return '';
  
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, maxLength);
}

/**
 * Capitalizes the first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Capitalizes the first letter of each word
 */
export function titleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncates a string to a specified length
 */
export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
}

/**
 * Converts a string to slug format
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Converts camelCase to Title Case
 */
export function camelToTitle(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, char => char.toUpperCase())
    .trim();
}

/**
 * Converts snake_case to Title Case
 */
export function snakeToTitle(str: string): string {
  return str
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Masks sensitive data (e.g., account numbers)
 */
export function maskString(str: string, visibleChars: number = 4, maskChar: string = '•'): string {
  if (!str || str.length <= visibleChars) return str;
  const masked = maskChar.repeat(str.length - visibleChars);
  return masked + str.slice(-visibleChars);
}

/**
 * Masks an email address
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  
  const maskedLocal = localPart.length > 2
    ? localPart[0] + '•'.repeat(localPart.length - 2) + localPart.slice(-1)
    : localPart;
  
  return `${maskedLocal}@${domain}`;
}

/**
 * Generates a random string ID
 */
export function generateId(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================
// FINANCIAL HEALTH UTILITIES
// ============================================

/**
 * Gets color class based on health score
 */
export function getHealthScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Gets background color class based on health score
 */
export function getHealthScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/20';
  if (score >= 60) return 'bg-amber-500/20';
  if (score >= 40) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}

/**
 * Gets gradient class based on health score
 */
export function getHealthScoreGradient(score: number): string {
  if (score >= 80) return 'from-emerald-500 to-teal-500';
  if (score >= 60) return 'from-amber-500 to-yellow-500';
  if (score >= 40) return 'from-orange-500 to-amber-500';
  return 'from-red-500 to-rose-500';
}

/**
 * Gets health status text based on score
 */
export function getHealthStatus(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Critical';
}

/**
 * Gets trend color based on direction
 */
export function getTrendColor(trend: 'up' | 'down' | 'stable', inverse: boolean = false): string {
  if (trend === 'stable') return 'text-dark-400';
  if (inverse) {
    return trend === 'up' ? 'text-red-400' : 'text-emerald-400';
  }
  return trend === 'up' ? 'text-emerald-400' : 'text-red-400';
}

/**
 * Gets severity color
 */
export function getSeverityColor(severity: 'critical' | 'high' | 'medium' | 'low' | 'info'): string {
  const colors: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-amber-400',
    low: 'text-blue-400',
    info: 'text-dark-400',
  };
  return colors[severity] || colors.info;
}

/**
 * Gets category icon and color
 */
export function getCategoryStyle(category: string): { color: string; bgColor: string } {
  const styles: Record<string, { color: string; bgColor: string }> = {
    income: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
    food: { color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    transport: { color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    entertainment: { color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    shopping: { color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
    utilities: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    health: { color: 'text-red-400', bgColor: 'bg-red-500/20' },
    education: { color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
    business: { color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    tax: { color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
    default: { color: 'text-dark-400', bgColor: 'bg-dark-500/20' },
  };
  
  return styles[category.toLowerCase()] || styles.default;
}

// ============================================
// ARRAY & OBJECT UTILITIES
// ============================================

/**
 * Groups an array by a key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    (result[groupKey] = result[groupKey] || []).push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Sorts an array by a key
 */
export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Removes duplicates from an array
 */
export function unique<T>(array: T[], key?: keyof T): T[] {
  if (key) {
    const seen = new Set();
    return array.filter(item => {
      const val = item[key];
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  }
  return [...new Set(array)];
}

/**
 * Chunks an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Checks if an object is empty
 */
export function isEmpty(obj: object | null | undefined): boolean {
  if (!obj) return true;
  return Object.keys(obj).length === 0;
}

/**
 * Picks specific keys from an object
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) result[key] = obj[key];
  });
  return result;
}

/**
 * Omits specific keys from an object
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
}

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validates an email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a password (min 8 chars, 1 upper, 1 lower, 1 number, 1 special)
 */
export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('One number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('One special character');
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a phone number
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s-()]{10,}$/;
  return phoneRegex.test(phone);
}

/**
 * Validates a URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// ASYNC UTILITIES
// ============================================

/**
 * Delays execution for a specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounces a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttles a function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Retries a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number; backoff?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delay * Math.pow(backoff, attempt - 1));
      }
    }
  }
  
  throw lastError!;
}

// ============================================
// STORAGE UTILITIES
// ============================================

/**
 * Safely gets an item from localStorage
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely sets an item in localStorage
 */
export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

/**
 * Removes an item from localStorage
 */
export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
}

// ============================================
// BROWSER UTILITIES
// ============================================

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

/**
 * Downloads data as a file
 */
export function downloadFile(data: string | Blob, filename: string, mimeType: string = 'text/plain'): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gets the current URL query parameters
 */
export function getQueryParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Checks if the app is running in dark mode
 */
export function isDarkMode(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Checks if the device is mobile
 */
export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// ============================================
// EXPORT ALL
// ============================================

export default {
  cn,
  classNames,
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatBytes,
  roundTo,
  clamp,
  calculatePercentage,
  calculatePercentageChange,
  formatDate,
  getRelativeTime,
  isToday,
  isPast,
  isFuture,
  daysBetween,
  addDays,
  getStartOf,
  getEndOf,
  getInitials,
  capitalize,
  titleCase,
  truncate,
  slugify,
  camelToTitle,
  snakeToTitle,
  maskString,
  maskEmail,
  generateId,
  generateUUID,
  getHealthScoreColor,
  getHealthScoreBgColor,
  getHealthScoreGradient,
  getHealthStatus,
  getTrendColor,
  getSeverityColor,
  getCategoryStyle,
  groupBy,
  sortBy,
  unique,
  chunk,
  deepClone,
  isEmpty,
  pick,
  omit,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  isValidUrl,
  sleep,
  debounce,
  throttle,
  retry,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  copyToClipboard,
  downloadFile,
  getQueryParams,
  isDarkMode,
  isMobile,
};