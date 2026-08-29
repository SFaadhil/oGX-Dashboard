import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { isVP, isTeamLeader } from '../lib/helpers';

const STORAGE_KEY = 'ogx_india_manager';

const AuthContext = createContext(null);

const MANAGER_FIELDS =
  'id, first_name, last_name, email, phone_number, key_area, ogt, expa_id, reports_to, profile_picture, last_login, created_at';

export function AuthProvider({ children }) {
  const [manager, setManager] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setManager(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setLoading(false);
  }, []);

  const persist = useCallback((row) => {
    setManager(row);
    try {
      if (row) localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      if (!isSupabaseConfigured) {
        const msg = 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.';
        setError(msg);
        throw new Error(msg);
      }
      const { data, error: qErr } = await supabase
        .from('managers')
        .select(`${MANAGER_FIELDS}, password`)
        .eq('email', String(email).trim().toLowerCase())
        .maybeSingle();

      if (qErr) { setError(qErr.message); throw qErr; }
      if (!data || data.password !== password) {
        const msg = 'Incorrect email or password.';
        setError(msg);
        throw new Error(msg);
      }

      const { password: _pw, ...safe } = data;
      await supabase.from('managers').update({ last_login: new Date().toISOString() }).eq('id', data.id);
      persist(safe);
      return safe;
    },
    [persist]
  );

  // Used by the admin "click a manager to sign in instantly" list.
  const loginAs = useCallback(
    async (managerId) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error: qErr } = await supabase
        .from('managers')
        .select(MANAGER_FIELDS)
        .eq('id', managerId)
        .maybeSingle();
      if (qErr) throw qErr;
      if (!data) throw new Error('Manager not found.');
      persist(data);
      return data;
    },
    [persist]
  );

  const logout = useCallback(() => persist(null), [persist]);

  const refresh = useCallback(async () => {
    if (!manager || !isSupabaseConfigured) return;
    const { data } = await supabase
      .from('managers')
      .select(MANAGER_FIELDS)
      .eq('id', manager.id)
      .maybeSingle();
    if (data) persist(data);
  }, [manager, persist]);

  const value = useMemo(
    () => ({
      manager,
      loading,
      error,
      login,
      loginAs,
      logout,
      refresh,
      isAuthenticated: Boolean(manager),
      isVP: isVP(manager),
      isTeamLeader: isTeamLeader(manager)
    }),
    [manager, loading, error, login, loginAs, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
