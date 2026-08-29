import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiAlertCircle, FiArrowRight, FiGrid } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import './Login.css';

export default function Login() {
  const { login, isAuthenticated, manager } = useAuth();
  const { loadThemeFor } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ogx_india_remember_email');
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const row = await login(email, password);
      try {
        if (remember) localStorage.setItem('ogx_india_remember_email', email);
        else localStorage.removeItem('ogx_india_remember_email');
      } catch {
        /* ignore */
      }
      await loadThemeFor(row.id);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <aside className="brand-side">
          <div className="logo-container">
            <div className="logo-image">
              <img src="/aiesec-india.svg" alt="AIESEC in India" />
            </div>
            <h1 className="logo-text">AIESEC in India</h1>
            <p className="logo-tagline">oGX Talent Hub</p>
          </div>
          <ul className="brand-points">
            <li><span className="dot" /> Track every GTa and GTe lead in one place</li>
            <li><span className="dot" /> Assign, follow up and approve without spreadsheets</li>
            <li><span className="dot" /> Share a ready-to-browse CV pool with partners</li>
          </ul>
          <Link className="brand-link" to="/cv-pool">
            <FiGrid /> Browse the public CV pool <FiArrowRight />
          </Link>
        </aside>

        <section className="form-side">
          <div className="form-content">
            <div className="form-header">
              <h2>Welcome Back</h2>
              <p>Sign in to continue your journey</p>
            </div>

            {!isSupabaseConfigured && (
              <div className="login-alert">
                <FiAlertCircle />
                <span>
                  Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and{' '}
                  <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code>, then restart the dev server.
                </span>
              </div>
            )}

            <form onSubmit={submit}>
              <div className="input-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="member@aiesec.net"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
                <span className="input-icon"><FiMail /></span>
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="........"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <span className="input-icon"><FiLock /></span>
              </div>

              <div className="form-options">
                <label className="checkbox-container">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span className="checkbox-text">Remember me</span>
                </label>
              </div>

              {error && (
                <div className="login-error"><FiAlertCircle /> {error}</div>
              )}

              <button type="submit" className={`login-btn${busy ? ' busy' : ''}`} disabled={busy}>
                {busy ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="footer-text">
              &copy; {new Date().getFullYear()} AIESEC in India. All rights reserved.
              {manager && <> Signed in as {manager.email}.</>}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
