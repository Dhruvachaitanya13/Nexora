import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'indigo' | 'violet' | 'emerald' | 'cyan' | 'rose' | 'amber';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Apply saved theme before React hydration to avoid flash
try {
  const stored = localStorage.getItem('nexora-theme');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed?.state?.theme) applyTheme(parsed.state.theme);
  }
} catch {
  // ignore
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'indigo',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'nexora-theme',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme);
      },
    },
  ),
);
