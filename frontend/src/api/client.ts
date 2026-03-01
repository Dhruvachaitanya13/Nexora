const API = 'http://localhost:8000/api/v1';

async function req(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(API + endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers,
    },
  });
  
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  
  return res.json();
}

// Analytics
export const analytics = {
  dashboard: () => req('/analytics/dashboard'),
};

// Accounts
export const accounts = {
  list: () => req('/accounts/'),
  summary: () => req('/accounts/summary'),
  get: (id: string) => req(`/accounts/${id}`),
};

// Transactions
export const transactions = {
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return req(`/transactions/${query}`);
  },
  get: (id: string) => req(`/transactions/${id}`),
  update: (id: string, data: any) => req(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkUpdate: (data: any) => req('/transactions/bulk-update', { method: 'POST', body: JSON.stringify(data) }),
  summary: (period?: string) => req(`/transactions/summary${period ? `?period=${period}` : ''}`),
  trends: (months?: number) => req(`/transactions/trends${months ? `?months=${months}` : ''}`),
  recurring: () => req('/transactions/recurring'),
  categories: () => req('/transactions/categories/schedule-c'),
};

// Tax
export const tax = {
  calculate: (data: any) => req('/tax/calculate', { method: 'POST', body: JSON.stringify(data) }),
  reserve: (data: any) => req('/tax/reserve', { method: 'POST', body: JSON.stringify(data) }),
  quarterly: () => req('/tax/quarterly'),
  summary: () => req('/tax/summary'),
  deductions: () => req('/tax/deductions'),
};

// Plaid
export const plaid = {
  testFlow: () => req('/plaid/sandbox/test-full-flow', { method: 'POST' }),
  syncAll: () => req('/plaid/sync-all', { method: 'POST' }),
};

// AI Advisor (Single Agent)
export const ai = {
  chat: (message: string, context?: any, history?: any[]) => req('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context, conversation_history: history }),
  }),
  analyze: (analysisType: string, timePeriod?: string) => req('/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({ analysis_type: analysisType, time_period: timePeriod }),
  }),
  autoCategorize: (transactionIds?: string[]) => req('/ai/auto-categorize', {
    method: 'POST',
    body: JSON.stringify({ transaction_ids: transactionIds, use_ai: true }),
  }),
  insights: () => req('/ai/insights'),
};

// Multi-Agent System
export const agents = {
  consult: (message: string, agentTypes?: string[]) => req('/agents/consult', {
    method: 'POST',
    body: JSON.stringify({ message, agents: agentTypes }),
  }),
  forecast: (monthsAhead: number = 3, scenario?: string, whatIf?: any) => req('/agents/forecast', {
    method: 'POST',
    body: JSON.stringify({ months_ahead: monthsAhead, scenario, include_what_if: whatIf }),
  }),
  whatIf: (scenarioType: string, parameters: any) => req('/agents/what-if', {
    method: 'POST',
    body: JSON.stringify({ scenario_type: scenarioType, parameters }),
  }),
  autoPilot: (enabled: boolean, features: string[]) => req('/agents/auto-pilot', {
    method: 'POST',
    body: JSON.stringify({ enabled, features }),
  }),
  dashboardInsights: () => req('/agents/dashboard-insights'),
};
