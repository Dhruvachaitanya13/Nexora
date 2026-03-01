/* ============================================
   FINTRACK AI - AUTH STORE
   Comprehensive authentication state management
   ============================================ */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { authAPI, usersAPI } from '../services/api';
import type { User, NotificationPreferences } from '../types';

// ============================================
// TYPES
// ============================================

export interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  
  // Session
  sessionExpiresAt: number | null;
  lastActivity: number;
  
  // 2FA
  twoFactorPending: boolean;
  twoFactorSecret: string | null;
  twoFactorQRCode: string | null;
  
  // Password Reset
  passwordResetSent: boolean;
  passwordResetEmail: string | null;
  
  // Actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, fullName: string, businessType?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshSession: () => Promise<void>;
  
  // Profile
  updateProfile: (data: Partial<User>) => Promise<void>;
  updateAvatar: (file: File) => Promise<string>;
  updateNotificationPreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  
  // Password
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  
  // Email Verification
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  
  // 2FA
  enable2FA: () => Promise<void>;
  verify2FA: (code: string) => Promise<string[]>;
  disable2FA: (code: string) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  setError: (error: string) => void;
  updateLastActivity: () => void;
  
  // Account
  deleteAccount: (password: string) => Promise<void>;
}

// ============================================
// CONSTANTS
// ============================================

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // 1 minute

// ============================================
// HELPERS
// ============================================

/**
 * Parse JWT token to get expiration
 */
function parseJwtExpiration(token: string): number | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Check if session is expired
 */
function isSessionExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return true;
  return Date.now() >= expiresAt;
}

/**
 * Extract error message from API error
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for axios error response
    const axiosError = error as { response?: { data?: { message?: string; detail?: string } } };
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    if (axiosError.response?.data?.detail) {
      return axiosError.response.data.detail;
    }
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

// ============================================
// STORE
// ============================================

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      // ============================================
      // INITIAL STATE
      // ============================================
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,
      
      sessionExpiresAt: null,
      lastActivity: Date.now(),
      
      twoFactorPending: false,
      twoFactorSecret: null,
      twoFactorQRCode: null,
      
      passwordResetSent: false,
      passwordResetEmail: null,

      // ============================================
      // AUTHENTICATION ACTIONS
      // ============================================

      /**
       * Login with email and password
       */
      login: async (email: string, password: string, rememberMe: boolean = false) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const response = await authAPI.login(email, password);
          const { access_token, refresh_token, user } = response;

          // Store tokens
          localStorage.setItem('access_token', access_token);
          if (rememberMe && refresh_token) {
            localStorage.setItem('refresh_token', refresh_token);
          } else if (refresh_token) {
            sessionStorage.setItem('refresh_token', refresh_token);
          }

          // Parse token expiration
          const expiresAt = parseJwtExpiration(access_token);

          set((state) => {
            state.user = user;
            state.isAuthenticated = true;
            state.isLoading = false;
            state.isInitialized = true;
            state.sessionExpiresAt = expiresAt;
            state.lastActivity = Date.now();
            state.error = null;
          });

          // Log login event
          console.info('User logged in:', user.email);
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      /**
       * Register new user
       */
      register: async (
        email: string,
        password: string,
        fullName: string,
        businessType?: string
      ) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const response = await authAPI.register({
            email,
            password,
            full_name: fullName,
            business_type: businessType,
          });

          const { access_token, refresh_token, user } = response;

          // Store tokens
          localStorage.setItem('access_token', access_token);
          if (refresh_token) {
            localStorage.setItem('refresh_token', refresh_token);
          }

          // Parse token expiration
          const expiresAt = parseJwtExpiration(access_token);

          set((state) => {
            state.user = user;
            state.isAuthenticated = true;
            state.isLoading = false;
            state.isInitialized = true;
            state.sessionExpiresAt = expiresAt;
            state.lastActivity = Date.now();
            state.error = null;
          });

          console.info('User registered:', user.email);
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      /**
       * Logout current user
       */
      logout: async () => {
        set((state) => {
          state.isLoading = true;
        });

        try {
          await authAPI.logout();
        } catch (error) {
          // Ignore logout errors - we'll clear local state anyway
          console.warn('Logout API error:', error);
        } finally {
          // Clear tokens
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          sessionStorage.removeItem('refresh_token');

          set((state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.isLoading = false;
            state.sessionExpiresAt = null;
            state.twoFactorPending = false;
            state.twoFactorSecret = null;
            state.twoFactorQRCode = null;
            state.error = null;
          });

          console.info('User logged out');
        }
      },

      /**
       * Check authentication status
       */
      checkAuth: async () => {
        const token = localStorage.getItem('access_token');

        if (!token) {
          set((state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.isLoading = false;
            state.isInitialized = true;
          });
          return;
        }

        // Check if token is expired
        const expiresAt = parseJwtExpiration(token);
        if (isSessionExpired(expiresAt)) {
          // Try to refresh
          const refreshToken =
            localStorage.getItem('refresh_token') ||
            sessionStorage.getItem('refresh_token');

          if (refreshToken) {
            try {
              await get().refreshSession();
              return;
            } catch {
              // Refresh failed, clear auth
              set((state) => {
                state.user = null;
                state.isAuthenticated = false;
                state.isLoading = false;
                state.isInitialized = true;
              });
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              sessionStorage.removeItem('refresh_token');
              return;
            }
          }

          set((state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.isLoading = false;
            state.isInitialized = true;
          });
          localStorage.removeItem('access_token');
          return;
        }

        set((state) => {
          state.isLoading = true;
        });

        try {
          const user = await authAPI.me();

          set((state) => {
            state.user = user;
            state.isAuthenticated = true;
            state.isLoading = false;
            state.isInitialized = true;
            state.sessionExpiresAt = expiresAt;
            state.lastActivity = Date.now();
          });
        } catch (error) {
          console.error('Auth check failed:', error);

          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          sessionStorage.removeItem('refresh_token');

          set((state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.isLoading = false;
            state.isInitialized = true;
          });
        }
      },

      /**
       * Refresh session token
       */
      refreshSession: async () => {
        const refreshToken =
          localStorage.getItem('refresh_token') ||
          sessionStorage.getItem('refresh_token');

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const response = await authAPI.refresh(refreshToken);
          const { access_token, refresh_token: newRefreshToken } = response;

          localStorage.setItem('access_token', access_token);
          if (newRefreshToken) {
            if (localStorage.getItem('refresh_token')) {
              localStorage.setItem('refresh_token', newRefreshToken);
            } else {
              sessionStorage.setItem('refresh_token', newRefreshToken);
            }
          }

          const expiresAt = parseJwtExpiration(access_token);

          set((state) => {
            state.sessionExpiresAt = expiresAt;
            state.lastActivity = Date.now();
          });

          // Fetch fresh user data
          const user = await authAPI.me();
          set((state) => {
            state.user = user;
            state.isAuthenticated = true;
          });
        } catch (error) {
          console.error('Session refresh failed:', error);
          await get().logout();
          throw error;
        }
      },

      // ============================================
      // PROFILE ACTIONS
      // ============================================

      /**
       * Update user profile
       */
      updateProfile: async (data: Partial<User>) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const updatedUser = await usersAPI.updateProfile(data);

          set((state) => {
            state.user = updatedUser;
            state.isLoading = false;
          });
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      /**
       * Update avatar
       */
      updateAvatar: async (file: File) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const { avatar_url } = await usersAPI.uploadAvatar(file);

          set((state) => {
            if (state.user) {
              state.user.avatar_url = avatar_url;
            }
            state.isLoading = false;
          });

          return avatar_url;
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      /**
       * Update notification preferences
       */
      updateNotificationPreferences: async (
        preferences: Partial<NotificationPreferences>
      ) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const updatedUser = await usersAPI.updateNotifications(preferences);

          set((state) => {
            state.user = updatedUser;
            state.isLoading = false;
          });
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      // ============================================
      // PASSWORD ACTIONS
      // ============================================

      /**
       * Change password
       */
      changePassword: async (currentPassword: string, newPassword: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          await authAPI.changePassword(currentPassword, newPassword);

          set((state) => {
            state.isLoading = false;
          });
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      /**
       * Request password reset
       */
      requestPasswordReset: async (email: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
          state.passwordResetSent = false;
        });

        try {
          await authAPI.requestPasswordReset(email);

          set((state) => {
            state.isLoading = false;
            state.passwordResetSent = true;
            state.passwordResetEmail = email;
          });
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      /**
       * Confirm password reset
       */
      confirmPasswordReset: async (token: string, newPassword: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          await authAPI.confirmPasswordReset(token, newPassword);

          set((state) => {
            state.isLoading = false;
            state.passwordResetSent = false;
            state.passwordResetEmail = null;
          });
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      // ============================================
      // EMAIL VERIFICATION ACTIONS
      // ============================================

      /**
       * Verify email
       */
      verifyEmail: async (token: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          await authAPI.verifyEmail(token);

          set((state) => {
            if (state.user) {
              state.user.email_verified = true;
            }
            state.isLoading = false;
          });
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      /**
       * Resend verification email
       */
      resendVerification: async () => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          await authAPI.resendVerification();

          set((state) => {
            state.isLoading = false;
          });
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      // ============================================
      // 2FA ACTIONS
      // ============================================

      /**
       * Enable 2FA - Step 1: Get secret and QR code
       */
      enable2FA: async () => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const { secret, qr_code } = await authAPI.enable2FA();

          set((state) => {
            state.twoFactorPending = true;
            state.twoFactorSecret = secret;
            state.twoFactorQRCode = qr_code;
            state.isLoading = false;
          });
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      /**
       * Verify 2FA - Step 2: Confirm with code
       */
      verify2FA: async (code: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const { backup_codes } = await authAPI.verify2FA(code);

          set((state) => {
            if (state.user) {
              state.user.two_factor_enabled = true;
            }
            state.twoFactorPending = false;
            state.twoFactorSecret = null;
            state.twoFactorQRCode = null;
            state.isLoading = false;
          });

          return backup_codes;
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      /**
       * Disable 2FA
       */
      disable2FA: async (code: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          await authAPI.disable2FA(code);

          set((state) => {
            if (state.user) {
              state.user.two_factor_enabled = false;
            }
            state.isLoading = false;
          });
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },

      // ============================================
      // UTILITY ACTIONS
      // ============================================

      /**
       * Clear error
       */
      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      /**
       * Set error
       */
      setError: (error: string) => {
        set((state) => {
          state.error = error;
        });
      },

      /**
       * Update last activity timestamp
       */
      updateLastActivity: () => {
        set((state) => {
          state.lastActivity = Date.now();
        });
      },

      // ============================================
      // ACCOUNT ACTIONS
      // ============================================

      /**
       * Delete account
       */
      deleteAccount: async (password: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          await usersAPI.deleteAccount(password);

          // Clear all auth data
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          sessionStorage.removeItem('refresh_token');

          set((state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.isLoading = false;
            state.sessionExpiresAt = null;
          });
        } catch (error) {
          const message = extractErrorMessage(error);
          set((state) => {
            state.isLoading = false;
            state.error = message;
          });
          throw error;
        }
      },
    })),
    {
      name: 'fintrack-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        sessionExpiresAt: state.sessionExpiresAt,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;
export const selectIsInitialized = (state: AuthState) => state.isInitialized;

export const selectUserName = (state: AuthState) => state.user?.full_name || '';
export const selectUserEmail = (state: AuthState) => state.user?.email || '';
export const selectUserAvatar = (state: AuthState) => state.user?.avatar_url;
export const selectSubscriptionTier = (state: AuthState) =>
  state.user?.subscription_tier || 'free';
export const selectIs2FAEnabled = (state: AuthState) =>
  state.user?.two_factor_enabled || false;
export const selectIsEmailVerified = (state: AuthState) =>
  state.user?.email_verified || false;
export const selectOnboardingCompleted = (state: AuthState) =>
  state.user?.onboarding_completed || false;

// ============================================
// HOOKS
// ============================================

/**
 * Hook for user data
 */
export const useUser = () => useAuthStore(selectUser);

/**
 * Hook for auth status
 */
export const useIsAuthenticated = () => useAuthStore(selectIsAuthenticated);

/**
 * Hook for loading state
 */
export const useAuthLoading = () => useAuthStore(selectIsLoading);

/**
 * Hook for auth error
 */
export const useAuthError = () => useAuthStore(selectError);

/**
 * Hook for subscription tier
 */
export const useSubscriptionTier = () => useAuthStore(selectSubscriptionTier);

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Initialize session activity tracking
 */
export function initSessionTracking() {
  // Update activity on user interactions
  const updateActivity = () => {
    useAuthStore.getState().updateLastActivity();
  };

  // Track user activity
  window.addEventListener('click', updateActivity);
  window.addEventListener('keypress', updateActivity);
  window.addEventListener('scroll', updateActivity);
  window.addEventListener('mousemove', updateActivity);

  // Check for session timeout periodically
  const checkSession = setInterval(() => {
    const state = useAuthStore.getState();

    if (!state.isAuthenticated) return;

    const now = Date.now();
    const lastActivity = state.lastActivity;
    const sessionExpires = state.sessionExpiresAt;

    // Check for inactivity timeout
    if (now - lastActivity > SESSION_TIMEOUT) {
      console.info('Session timeout due to inactivity');
      state.logout();
      return;
    }

    // Check for token expiration (refresh 5 minutes before)
    if (sessionExpires && sessionExpires - now < 5 * 60 * 1000) {
      state.refreshSession().catch(() => {
        console.error('Failed to refresh session');
        state.logout();
      });
    }
  }, ACTIVITY_CHECK_INTERVAL);

  // Cleanup function
  return () => {
    window.removeEventListener('click', updateActivity);
    window.removeEventListener('keypress', updateActivity);
    window.removeEventListener('scroll', updateActivity);
    window.removeEventListener('mousemove', updateActivity);
    clearInterval(checkSession);
  };
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default useAuthStore;