import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'ogx_india_theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    // The tokens live on <html> so body's own `background: var(--bg-app)` picks
    // them up by inheritance; the body class stays for `body.dark-mode .x` rules.
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    document.body.classList.toggle('dark-mode', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  // Persist the manager's preference so it follows them across devices.
  const saveThemeFor = useCallback(async (managerId, next) => {
    setTheme(next);
    if (!managerId || !isSupabaseConfigured) return;
    await supabase
      .from('manager_profiles')
      .upsert({ manager_id: managerId, theme_preference: next }, { onConflict: 'manager_id' });
  }, []);

  const loadThemeFor = useCallback(async (managerId) => {
    if (!managerId || !isSupabaseConfigured) return;
    const { data } = await supabase
      .from('manager_profiles')
      .select('theme_preference')
      .eq('manager_id', managerId)
      .maybeSingle();
    if (data?.theme_preference) setTheme(data.theme_preference);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, saveThemeFor, loadThemeFor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
