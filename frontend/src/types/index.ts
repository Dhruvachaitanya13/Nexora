/* ============================================
   FINTRACK AI - TYPE DEFINITIONS
   Comprehensive TypeScript types for the app
   ============================================ */

// ============================================
// USER & AUTHENTICATION TYPES
// ============================================

export type SubscriptionTier = 'free' | 'pro' | 'premium' | 'enterprise';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  timezone: string;
  locale: string;
  business_name?: string;
  business_type?: string;
  industry?: string;
  address?: UserAddress;
  subscription_tier: SubscriptionTier;
  subscription_status: 'active' | 'trialing' | 'canceled' | 'past_due';
  subscription_ends_at?: string;
  onboarding_completed: boolean;
  onboarding_step: number;
  email_verified: boolean;
  two_factor_enabled: boolean;
  notification_preferences: NotificationPreferences;
  feature_flags: Record<string, boolean>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface UserAddress {
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

export interface NotificationPreferences {
  email_marketing: boolean;
  email_transactions: boolean;
  email_insights: boolean;
  email_tax_reminders: boolean;
  email_weekly_summary: boolean;
  push_enabled: boolean;
  push_transactions: boolean;
  push_alerts: boolean;
  sms_enabled: boolean;
  sms_critical_only: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  business_type?: string;
  referral_code?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}

// ============================================
// ACCOUNT & BANKING TYPES
// ============================================

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'loan' | 'mortgage' | 'other';
export type AccountStatus = 'active' | 'inactive' | 'error' | 'pending' | 'disconnected';

export interface Account {
  id: string;
  user_id: string;
  plaid_item_id?: string;
  plaid_account_id?: string;
  account_name: string;
  official_name?: string;
  institution_id?: string;
  institution_name: string;
  institution_logo?: string;
  institution_color?: string;
  account_type: AccountType;
  account_subtype?: string;
  current_balance: number;
  available_balance: number;
  credit_limit?: number;
  currency: string;
  mask: string;
  is_primary: boolean;
  is_business: boolean;
  is_hidden: boolean;
  include_in_net_worth: boolean;
  include_in_budget: boolean;
  auto_sync: boolean;
  status: AccountStatus;
  error_code?: string;
  error_message?: string;
  last_synced_at?: string;
  last_transaction_date?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AccountSummary {
  total_balance: number;
  total_available: number;
  by_type: Record<AccountType, number>;
  accounts_count: number;
  last_updated: string;
}

export interface PlaidItem {
  id: string;
  user_id: string;
  plaid_item_id: string;
  institution_id: string;
  institution_name: string;
  institution_logo?: string;
  products: string[];
  consent_expires_at?: string;
  status: 'active' | 'error' | 'pending_expiration' | 'revoked';
  error_code?: string;
  error_message?: string;
  last_synced_at?: string;
  accounts: Account[];
  created_at: string;
  updated_at: string;
}

export interface PlaidLinkToken {
  link_token: string;
  expiration: string;
  request_id: string;
}

// ============================================
// TRANSACTION TYPES
// ============================================

export type TransactionStatus = 'pending' | 'posted' | 'canceled' | 'failed';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'refund' | 'adjustment';

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  account_name?: string;
  plaid_transaction_id?: string;
  amount: number;
  currency: string;
  merchant_name: string;
  merchant_logo?: string;
  merchant_category?: string;
  description?: string;
  original_description?: string;
  category_id?: string;
  category: string;
  subcategory?: string;
  transaction_date: string;
  posted_date?: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  is_income: boolean;
  is_expense: boolean;
  is_transfer: boolean;
  is_business_expense: boolean;
  is_tax_deductible: boolean;
  is_recurring: boolean;
  is_manual: boolean;
  is_split: boolean;
  is_hidden: boolean;
  is_reviewed: boolean;
  schedule_c_category?: ScheduleCCategory;
  schedule_c_line?: string;
  tax_year?: number;
  receipt_url?: string;
  receipt_data?: ReceiptData;
  notes?: string;
  tags: string[];
  location?: TransactionLocation;
  payment_channel?: 'online' | 'in_store' | 'other';
  payment_method?: string;
  splits?: TransactionSplit[];
  linked_transaction_id?: string;
  confidence_score?: number;
  ai_categorized: boolean;
  ai_insights?: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TransactionLocation {
  address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface TransactionSplit {
  id: string;
  amount: number;
  category: string;
  subcategory?: string;
  is_tax_deductible: boolean;
  schedule_c_category?: ScheduleCCategory;
  notes?: string;
}

export interface ReceiptData {
  vendor_name?: string;
  total_amount?: number;
  tax_amount?: number;
  date?: string;
  items?: ReceiptItem[];
  raw_text?: string;
  confidence?: number;
}

export interface ReceiptItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total_price: number;
}

export type ScheduleCCategory =
  | 'advertising'
  | 'car_and_truck'
  | 'commissions'
  | 'contract_labor'
  | 'depletion'
  | 'depreciation'
  | 'employee_benefits'
  | 'insurance'
  | 'interest_mortgage'
  | 'interest_other'
  | 'legal_and_professional'
  | 'office_expense'
  | 'pension_and_profit_sharing'
  | 'rent_or_lease_vehicles'
  | 'rent_or_lease_equipment'
  | 'rent_or_lease_property'
  | 'repairs_and_maintenance'
  | 'supplies'
  | 'taxes_and_licenses'
  | 'travel'
  | 'meals'
  | 'utilities'
  | 'wages'
  | 'other_expenses'
  | 'home_office';

export interface TransactionFilters {
  account_id?: string;
  category?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  is_income?: boolean;
  is_expense?: boolean;
  is_business_expense?: boolean;
  is_tax_deductible?: boolean;
  is_recurring?: boolean;
  is_reviewed?: boolean;
  status?: TransactionStatus;
  search?: string;
  tags?: string[];
}

export interface TransactionSummary {
  total_income: number;
  total_expenses: number;
  net: number;
  transaction_count: number;
  by_category: CategoryBreakdown[];
  by_day: DailyBreakdown[];
  period: {
    start_date: string;
    end_date: string;
  };
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  count: number;
  percentage: number;
  trend: number;
}

export interface DailyBreakdown {
  date: string;
  income: number;
  expenses: number;
  net: number;
}

// ============================================
// INVOICE TYPES
// ============================================

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'refunded';

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  client_id?: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: ClientAddress;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  paid_date?: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  discount_percentage?: number;
  tax_rate?: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  notes?: string;
  terms?: string;
  footer?: string;
  public_url?: string;
  public_token?: string;
  pdf_url?: string;
  sent_at?: string;
  viewed_at?: string;
  reminder_sent_at?: string;
  reminder_count: number;
  days_overdue: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClientAddress {
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_rate?: number;
  is_taxable: boolean;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference?: string;
  notes?: string;
}

export interface InvoiceSummary {
  total_outstanding: number;
  total_overdue: number;
  total_paid_ytd: number;
  total_paid_mtd: number;
  invoice_count_outstanding: number;
  invoice_count_overdue: number;
  aging: InvoiceAging;
}

export interface InvoiceAging {
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
}

// ============================================
// TAX TYPES
// ============================================

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_of_household';
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface TaxSummary {
  tax_year: number;
  filing_status: FilingStatus;
  gross_income: number;
  total_deductions: number;
  taxable_income: number;
  federal_tax: number;
  state_tax: number;
  self_employment_tax: number;
  total_tax: number;
  effective_rate: number;
  marginal_rate: number;
  quarterly_payment_due: number;
  total_payments_made: number;
  balance_due: number;
  next_deadline: string;
  days_until_deadline: number;
  deductions_by_category: TaxDeductionCategory[];
  quarterly_breakdown: QuarterlyTax[];
  recommendations: TaxRecommendation[];
}

export interface TaxDeductionCategory {
  category: string;
  schedule_c_line?: string;
  amount: number;
  count: number;
  limit?: number;
  remaining?: number;
}

export interface QuarterlyTax {
  quarter: Quarter;
  period_start: string;
  period_end: string;
  due_date: string;
  income: number;
  expenses: number;
  estimated_tax: number;
  amount_paid: number;
  amount_due: number;
  status: 'upcoming' | 'due' | 'paid' | 'overdue' | 'partial';
  payment_date?: string;
  confirmation_number?: string;
}

export interface TaxRecommendation {
  id: string;
  type: 'deduction' | 'credit' | 'strategy' | 'deadline' | 'warning';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potential_savings: number;
  action_required: boolean;
  deadline?: string;
  action_steps: string[];
}

export interface TaxDeadline {
  id: string;
  name: string;
  description: string;
  due_date: string;
  type: 'federal' | 'state' | 'local';
  form?: string;
  is_estimated_payment: boolean;
  quarter?: Quarter;
  status: 'upcoming' | 'due_soon' | 'overdue' | 'completed';
  completed_at?: string;
}

// ============================================
// DASHBOARD & ANALYTICS TYPES
// ============================================

export interface DashboardData {
  user: User;
  financial_health: FinancialHealth;
  balances: BalancesSummary;
  period_summary: PeriodSummary;
  ytd_summary: YTDSummary;
  cash_flow: CashFlowSummary;
  tax: TaxSummary;
  invoices: InvoiceSummary;
  goals: GoalSummary;
  data_quality: DataQuality;
  alerts: Alert[];
  insights: Insight[];
  recent_transactions: Transaction[];
  upcoming_bills: UpcomingBill[];
}

export interface FinancialHealth {
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
  change: number;
  factors: HealthFactor[];
  recommendations: string[];
}

export interface HealthFactor {
  name: string;
  score: number;
  weight: number;
  status: 'good' | 'warning' | 'critical';
  description: string;
}

export interface BalancesSummary {
  total: number;
  available: number;
  checking: number;
  savings: number;
  investment: number;
  credit_used: number;
  credit_available: number;
  net_worth: number;
  change_amount: number;
  change_percentage: number;
}

export interface PeriodSummary {
  income: number;
  expenses: number;
  net: number;
  savings_rate: number;
  income_change: number;
  expenses_change: number;
  net_change: number;
  top_categories: CategoryBreakdown[];
}

export interface YTDSummary {
  income: number;
  expenses: number;
  net: number;
  tax_deductions: number;
  tax_paid: number;
  tax_owed: number;
  invoiced: number;
  collected: number;
}

export interface CashFlowSummary {
  current_runway_months: number;
  target_runway_months: number;
  burn_rate: number;
  average_income: number;
  savings_rate: number;
  trend: 'improving' | 'stable' | 'declining';
  projected_balance_30d: number;
  projected_balance_90d: number;
  low_balance_alert: boolean;
  alert_threshold: number;
}

export interface DataQuality {
  score: number;
  uncategorized_count: number;
  uncategorized_amount: number;
  unreviewed_count: number;
  missing_receipts_count: number;
  stale_accounts_count: number;
  recommendations: string[];
}

export interface UpcomingBill {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  category: string;
  is_recurring: boolean;
  frequency?: string;
  auto_pay: boolean;
  account_id?: string;
}

// ============================================
// ALERT & NOTIFICATION TYPES
// ============================================

export type AlertSeverity = 'critical' | 'urgent' | 'warning' | 'info' | 'success';
export type AlertType =
  | 'low_balance'
  | 'large_transaction'
  | 'unusual_activity'
  | 'bill_due'
  | 'invoice_overdue'
  | 'tax_deadline'
  | 'goal_progress'
  | 'account_error'
  | 'sync_failed'
  | 'security'
  | 'system';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: string;
  action_url?: string;
  action_label?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  is_read: boolean;
  is_dismissed: boolean;
  expires_at?: string;
  created_at: string;
}

// ============================================
// AI & INSIGHT TYPES
// ============================================

export type InsightType =
  | 'tax_saving'
  | 'expense_reduction'
  | 'income_opportunity'
  | 'cash_flow_warning'
  | 'spending_pattern'
  | 'invoice_alert'
  | 'goal_progress'
  | 'anomaly'
  | 'optimization'
  | 'compliance'
  | 'trend';

export type InsightPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Insight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  summary: string;
  detailed_explanation?: string;
  potential_impact: number;
  confidence: number;
  action_steps: string[];
  evidence: string[];
  related_transactions?: string[];
  related_entities?: Record<string, string>;
  deadline?: string;
  expires_at?: string;
  is_actionable: boolean;
  is_read: boolean;
  is_dismissed: boolean;
  is_actioned: boolean;
  feedback_rating?: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent?: AgentType;
  agent_name?: string;
  tokens_used?: number;
  actions?: ChatAction[];
  insights?: Insight[];
  charts?: ChartData[];
  timestamp: string;
  is_streaming?: boolean;
  error?: string;
}

export interface ChatAction {
  id: string;
  type: 'link' | 'button' | 'form' | 'confirm';
  label: string;
  url?: string;
  action?: string;
  data?: Record<string, unknown>;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  data: Record<string, unknown>[];
  config?: Record<string, unknown>;
}

export type AgentType =
  | 'cfo'
  | 'tax_advisor'
  | 'cash_flow'
  | 'expense'
  | 'categorization'
  | 'invoice'
  | 'compliance'
  | 'forecasting';

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  agent_type?: AgentType;
  status: 'active' | 'archived' | 'deleted';
  message_count: number;
  last_message_at: string;
  summary?: string;
  topics?: string[];
  rating?: number;
  feedback?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// GOAL TYPES
// ============================================

export type GoalType =
  | 'savings'
  | 'emergency_fund'
  | 'tax_reserve'
  | 'debt_payoff'
  | 'retirement'
  | 'income'
  | 'expense_reduction'
  | 'investment'
  | 'custom';

export type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled' | 'failed';

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  type: GoalType;
  target_amount: number;
  current_amount: number;
  progress: number;
  start_date: string;
  target_date: string;
  completed_date?: string;
  status: GoalStatus;
  priority: 'high' | 'medium' | 'low';
  linked_account_id?: string;
  auto_contribute: boolean;
  contribution_amount?: number;
  contribution_frequency?: 'weekly' | 'biweekly' | 'monthly';
  milestones: GoalMilestone[];
  contributions: GoalContribution[];
  is_on_track: boolean;
  days_remaining: number;
  projected_completion_date?: string;
  amount_needed_per_month?: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GoalMilestone {
  id: string;
  name: string;
  amount: number;
  target_date?: string;
  is_reached: boolean;
  reached_at?: string;
}

export interface GoalContribution {
  id: string;
  amount: number;
  date: string;
  note?: string;
  is_auto: boolean;
}

export interface GoalSummary {
  total_goals: number;
  active_goals: number;
  completed_goals: number;
  total_target: number;
  total_current: number;
  overall_progress: number;
  on_track_count: number;
  behind_count: number;
}

// ============================================
// CATEGORY TYPES
// ============================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  parent_id?: string;
  type: 'income' | 'expense' | 'transfer';
  is_system: boolean;
  is_tax_deductible: boolean;
  schedule_c_category?: ScheduleCCategory;
  schedule_c_line?: string;
  budget_amount?: number;
  subcategories?: Category[];
  transaction_count?: number;
  total_amount?: number;
}

export interface CategoryRule {
  id: string;
  user_id: string;
  name: string;
  priority: number;
  is_active: boolean;
  conditions: CategoryRuleCondition[];
  actions: CategoryRuleAction;
  match_count: number;
  last_matched_at?: string;
  created_at: string;
}

export interface CategoryRuleCondition {
  field: 'merchant_name' | 'description' | 'amount' | 'account_id';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'regex';
  value: string | number;
  case_sensitive?: boolean;
}

export interface CategoryRuleAction {
  category: string;
  subcategory?: string;
  is_business_expense?: boolean;
  is_tax_deductible?: boolean;
  schedule_c_category?: ScheduleCCategory;
  tags?: string[];
}

// ============================================
// CLIENT TYPES
// ============================================

export interface Client {
  id: string;
  user_id: string;
  name: string;
  company_name?: string;
  email: string;
  phone?: string;
  website?: string;
  address?: ClientAddress;
  notes?: string;
  payment_terms: string;
  hourly_rate?: number;
  default_currency: string;
  status: 'active' | 'inactive' | 'archived';
  tags: string[];
  total_invoiced: number;
  total_paid: number;
  total_outstanding: number;
  average_days_to_pay?: number;
  invoice_count: number;
  last_invoice_date?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// REPORT TYPES
// ============================================

export interface ProfitLossReport {
  period: { start_date: string; end_date: string };
  income: {
    total: number;
    by_source: { source: string; amount: number }[];
  };
  expenses: {
    total: number;
    by_category: { category: string; amount: number; percentage: number }[];
  };
  gross_profit: number;
  net_profit: number;
  profit_margin: number;
}

export interface BalanceSheetReport {
  as_of_date: string;
  assets: {
    total: number;
    cash_and_equivalents: number;
    accounts_receivable: number;
    investments: number;
    other: number;
  };
  liabilities: {
    total: number;
    credit_cards: number;
    accounts_payable: number;
    taxes_owed: number;
    other: number;
  };
  equity: number;
}

export interface CashFlowReport {
  period: { start_date: string; end_date: string };
  operating: {
    inflows: number;
    outflows: number;
    net: number;
  };
  personal: {
    inflows: number;
    outflows: number;
    net: number;
  };
  net_cash_flow: number;
  beginning_balance: number;
  ending_balance: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ApiError {
  error: boolean;
  message: string;
  code?: string;
  details?: Record<string, string[]>;
  status_code: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  description?: string;
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  width?: string | number;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

// ============================================
// UTILITY TYPES
// ============================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type SortDirection = 'asc' | 'desc';
export type DateRange = { start: Date | string; end: Date | string };
export type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

// ============================================
// EXPORT ALL
// ============================================

export default {
  // This file exports types only, no runtime exports
};