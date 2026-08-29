import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  FiGrid, FiUsers, FiLayers, FiTrendingUp, FiMenu, FiX, FiMoon, FiSun,
  FiExternalLink, FiDownloadCloud
} from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';
import './DashboardLayout.css';

const NAV = [
  { to: '/dashboard', end: true, icon: FiGrid, label: 'Overview' },
  { to: '/dashboard/leads', icon: FiLayers, label: 'Leads' },
  { to: '/dashboard/team', icon: FiUsers, label: 'Team Contacts' },
  { to: '/dashboard/team-performance', icon: FiTrendingUp, label: 'Team Performance' },
  { to: '/dashboard/sync', icon: FiDownloadCloud, label: 'EXPA Sync' }
];

export default function DashboardLayout() {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

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
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <item.icon />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <NavLink className="nav-item subtle" to="/cv-pool">
            <FiExternalLink /> <span>CV Pool</span>
          </NavLink>
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
            <span className="live-pill">Live from EXPA</span>
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>
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
