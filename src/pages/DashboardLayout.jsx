import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  FiGrid, FiUsers, FiUserCheck, FiLayers, FiTrendingUp, FiSettings, FiLogOut,
  FiMenu, FiX, FiMoon, FiSun, FiExternalLink, FiCheckSquare, FiShield, FiBell
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { initials } from '../lib/helpers';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const { manager, logout, isVP, isTeamLeader } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);

  const name = [manager?.first_name, manager?.last_name].filter(Boolean).join(' ');

  useEffect(() => {
    if (!isTeamLeader || !manager || !isSupabaseConfigured) return;
    supabase
      .from('approval_requests')
      .select('id', { count: 'exact', head: true })
      .eq('approver_id', manager.id)
      .eq('status', 'pending')
      .then(({ count }) => setPending(count || 0));
  }, [isTeamLeader, manager]);

  const nav = [
    { to: '/dashboard', end: true, icon: FiGrid, label: 'Dashboard' },
    { to: '/dashboard/leads', icon: FiUsers, label: 'My Leads' },
    { to: '/dashboard/followups', icon: FiCheckSquare, label: 'Follow Ups' },
    { to: '/dashboard/all-leads', icon: FiLayers, label: 'All Leads', gate: isVP },
    { to: '/dashboard/lead-assignment', icon: FiUserCheck, label: 'Lead Assignment', gate: isVP },
    { to: '/dashboard/all-team-leads', icon: FiLayers, label: 'All Team Leads', gate: isTeamLeader },
    { to: '/dashboard/team', icon: FiUsers, label: 'Team Contacts' },
    { to: '/dashboard/team-performance', icon: FiTrendingUp, label: 'Team Performance' },
    { to: '/dashboard/approvals', icon: FiBell, label: 'Approvals', gate: isTeamLeader, badge: pending },
    { to: '/dashboard/admin', icon: FiShield, label: 'Admin Panel', gate: isVP },
    { to: '/dashboard/settings', icon: FiSettings, label: 'Settings' }
  ].filter((item) => item.gate === undefined || item.gate);

  const signOut = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div className={`dash-shell${open ? ' nav-open' : ''}`}>
      <aside className="dash-sidebar">
        <div className="sidebar-brand">
          <img src="/aiesec-india.svg" alt="AIESEC in India" />
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <FiX />
          </button>
        </div>

        <nav className="sidebar-nav">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <item.icon />
              <span>{item.label}</span>
              {item.badge > 0 && <em className="nav-badge">{item.badge}</em>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <a className="nav-item subtle" href="/cv-pool" target="_blank" rel="noopener noreferrer">
            <FiExternalLink /> <span>Public CV Pool</span>
          </a>
          <button className="nav-item subtle" onClick={signOut}>
            <FiLogOut /> <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <FiMenu />
          </button>

          <div className="topbar-title">
            <strong>oGX INDIA</strong>
            <span>Talent Hub</span>
          </div>

          <div className="topbar-actions">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>
            <div className="topbar-user">
              <div className="user-avatar">{initials(name)}</div>
              <div className="user-meta">
                <strong>{name || 'Member'}</strong>
                <span>{manager?.key_area || 'oGX'}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>

      {open && <div className="nav-scrim" onClick={() => setOpen(false)} />}
    </div>
  );
}
