/* ============================================
   FINTRACK AI - API SERVICE
   Axios-based API client with interceptors
   ============================================ */

import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// ============================================
// TYPES
// ============================================

interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

// ============================================
// API CLIENT SETUP
// ============================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// REQUEST INTERCEPTOR
// ============================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================
// RESPONSE INTERCEPTOR
// ============================================

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ============================================
// AUTH API
// ============================================

export const authAPI = {
  login: async (email: string, password: string): Promise<AuthTokens & { user: User }> => {
    // Backend expects form data for OAuth2
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await apiClient.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthTokens & { user: User }> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await apiClient.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },
};

// ============================================
// USERS API
// ============================================

export const usersAPI = {
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await apiClient.patch('/users/me', data);
    return response.data;
  },

  updatePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/users/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};

// ============================================
// DASHBOARD API
// ============================================

export const dashboardAPI = {
  getOverview: async (): Promise<any> => {
    const response = await apiClient.get('/dashboard/overview');
    return response.data;
  },

  getStats: async (): Promise<any> => {
    const response = await apiClient.get('/dashboard/stats');
    return response.data;
  },

  getRecentTransactions: async (limit = 10): Promise<any[]> => {
    const response = await apiClient.get(`/dashboard/recent-transactions?limit=${limit}`);
    return response.data;
  },

  getInsights: async (): Promise<any[]> => {
    const response = await apiClient.get('/dashboard/insights');
    return response.data;
  },
};

// ============================================
// ACCOUNTS API
// ============================================

export const accountsAPI = {
  getAll: async (): Promise<any[]> => {
    const response = await apiClient.get('/accounts');
    return response.data;
  },

  getById: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/accounts/${id}`);
    return response.data;
  },

  sync: async (id: string): Promise<any> => {
    const response = await apiClient.post(`/accounts/${id}/sync`);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/accounts/${id}`);
  },
};

// ============================================
// PLAID API
// ============================================

export const plaidAPI = {
  createLinkToken: async (): Promise<{ link_token: string }> => {
    const response = await apiClient.post('/plaid/link-token');
    return response.data;
  },

  exchangeToken: async (publicToken: string): Promise<any> => {
    const response = await apiClient.post('/plaid/exchange-token', {
      public_token: publicToken,
    });
    return response.data;
  },

  syncTransactions: async (accountId: string): Promise<any> => {
    const response = await apiClient.post(`/plaid/sync/${accountId}`);
    return response.data;
  },
};

// ============================================
// TRANSACTIONS API
// ============================================

export const transactionsAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    account_id?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }): Promise<{ items: any[]; total: number; page: number; pages: number }> => {
    const response = await apiClient.get('/transactions', { params });
    return response.data;
  },

  getById: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/transactions/${id}`);
    return response.data;
  },

  update: async (id: string, data: any): Promise<any> => {
    const response = await apiClient.patch(`/transactions/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/transactions/${id}`);
  },

  categorize: async (id: string, category: string): Promise<any> => {
    const response = await apiClient.post(`/transactions/${id}/categorize`, { category });
    return response.data;
  },

  bulkCategorize: async (ids: string[], category: string): Promise<any> => {
    const response = await apiClient.post('/transactions/bulk/categorize', { ids, category });
    return response.data;
  },
};

// ============================================
// AI API
// ============================================

export const aiAPI = {
  chat: async (message: string, conversationId?: string): Promise<any> => {
    const response = await apiClient.post('/ai/chat', {
      message,
      conversation_id: conversationId,
    });
    return response.data;
  },

  getInsights: async (): Promise<any[]> => {
    const response = await apiClient.get('/ai/insights');
    return response.data;
  },

  categorizeTransaction: async (transactionId: string): Promise<any> => {
    const response = await apiClient.post(`/ai/categorize/${transactionId}`);
    return response.data;
  },

  getConversations: async (): Promise<any[]> => {
    const response = await apiClient.get('/ai/conversations');
    return response.data;
  },

  getConversation: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/ai/conversations/${id}`);
    return response.data;
  },
};

// ============================================
// TAX API
// ============================================

export const taxAPI = {
  getSummary: async (year?: number): Promise<any> => {
    const response = await apiClient.get('/tax/summary', { params: { year } });
    return response.data;
  },

  getDeductions: async (year?: number): Promise<any[]> => {
    const response = await apiClient.get('/tax/deductions', { params: { year } });
    return response.data;
  },

  getQuarterlyPayments: async (year?: number): Promise<any[]> => {
    const response = await apiClient.get('/tax/quarterly-payments', { params: { year } });
    return response.data;
  },

  calculateEstimate: async (income: number, expenses: number): Promise<any> => {
    const response = await apiClient.post('/tax/estimate', { income, expenses });
    return response.data;
  },
};

// ============================================
// INVOICES API
// ============================================

export const invoicesAPI = {
  getAll: async (params?: { status?: string; page?: number; limit?: number }): Promise<any> => {
    const response = await apiClient.get('/invoices', { params });
    return response.data;
  },

  getById: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/invoices/${id}`);
    return response.data;
  },

  create: async (data: any): Promise<any> => {
    const response = await apiClient.post('/invoices', data);
    return response.data;
  },

  update: async (id: string, data: any): Promise<any> => {
    const response = await apiClient.patch(`/invoices/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/invoices/${id}`);
  },

  send: async (id: string): Promise<any> => {
    const response = await apiClient.post(`/invoices/${id}/send`);
    return response.data;
  },

  markPaid: async (id: string): Promise<any> => {
    const response = await apiClient.post(`/invoices/${id}/mark-paid`);
    return response.data;
  },
};

// ============================================
// GOALS API
// ============================================

export const goalsAPI = {
  getAll: async (): Promise<any[]> => {
    const response = await apiClient.get('/goals');
    return response.data;
  },

  getById: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/goals/${id}`);
    return response.data;
  },

  create: async (data: any): Promise<any> => {
    const response = await apiClient.post('/goals', data);
    return response.data;
  },

  update: async (id: string, data: any): Promise<any> => {
    const response = await apiClient.patch(`/goals/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/goals/${id}`);
  },
};

// ============================================
// EXPORT DEFAULT CLIENT
// ============================================

export default apiClient;
