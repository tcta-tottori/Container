'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'cns-theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored === 'light' ? 'light' : 'dark';
    setThemeState(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, toggleTheme };
}
