import { Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import InstallPrompt from './components/InstallPrompt';

import CVPool from './pages/CVPool';
import DashboardLayout from './pages/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import LeadsPage from './pages/LeadsPage';
import LeadDetail from './pages/LeadDetail';
import TeamContacts from './pages/TeamContacts';
import TeamLeads from './pages/TeamLeads';
import TeamPerformance from './pages/TeamPerformance';
import SyncStatus from './pages/SyncStatus';
import NotFound from './pages/NotFound';

import './styles/global.css';
import './styles/dashboard.css';

/**
 * Every route is public and read-only. Nothing in the UI writes to Supabase;
 * data arrives only through the hourly EXPA sync, which uses the service-role
 * key server-side.
 */
export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/cv-pool" replace />} />
          <Route path="/cv-pool" element={<CVPool />} />

          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="team" element={<TeamContacts />} />
            <Route path="team-leads/:memberId" element={<TeamLeads scope="member" />} />
            <Route path="team-performance" element={<TeamPerformance />} />
            <Route path="sync" element={<SyncStatus />} />
          </Route>

          <Route path="/lead/:id" element={<DashboardLayout />}>
            <Route index element={<LeadDetail />} />
          </Route>

          {/* Paths from the earlier information architecture. */}
          <Route path="/leads" element={<Navigate to="/dashboard/leads" replace />} />
          <Route path="/all-leads" element={<Navigate to="/dashboard/leads" replace />} />
          <Route path="/all-team-leads" element={<Navigate to="/dashboard/leads" replace />} />
          <Route path="/team" element={<Navigate to="/dashboard/team" replace />} />
          <Route path="/team-performance" element={<Navigate to="/dashboard/team-performance" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
          <Route path="/admin" element={<Navigate to="/dashboard/sync" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>

        <InstallPrompt />
      </ToastProvider>
    </ThemeProvider>
  );
}
