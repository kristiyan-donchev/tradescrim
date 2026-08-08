import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'tradescrim-theme';
const MODES = ['light', 'dark', 'system'];

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredMode() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return MODES.includes(stored) ? stored : 'dark';
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readStoredMode);
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    mode === 'system' ? getSystemTheme() : mode
  );

  useEffect(() => {
    const next = mode === 'system' ? getSystemTheme() : mode;
    setResolvedTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return undefined;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const next = getSystemTheme();
      setResolvedTheme(next);
      document.documentElement.setAttribute('data-theme', next);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [mode]);

  const setMode = useCallback((next) => {
    if (!MODES.includes(next)) return;
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
