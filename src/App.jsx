import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';

import CVPool from './pages/CVPool';
import Login from './pages/Login';
import DashboardLayout from './pages/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import LeadsPage from './pages/LeadsPage';
import LeadDetail from './pages/LeadDetail';
import LeadAssignment from './pages/LeadAssignment';
import TeamContacts from './pages/TeamContacts';
import TeamLeads from './pages/TeamLeads';
import TeamPerformance from './pages/TeamPerformance';
import Followups from './pages/Followups';
import Approvals from './pages/Approvals';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import NotFound from './pages/NotFound';

import './styles/global.css';
import './styles/dashboard.css';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/cv-pool" replace />} />
            <Route path="/cv-pool" element={<CVPool />} />
            <Route path="/login" element={<Login />} />

            <Route
              path="/dashboard"
              element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}
            >
              <Route index element={<DashboardHome />} />
              <Route path="leads" element={<LeadsPage scope="mine" />} />
              <Route path="all-leads" element={<LeadsPage scope="all" />} />
              <Route path="followups" element={<Followups />} />
              <Route path="lead-assignment" element={<LeadAssignment />} />
              <Route path="all-team-leads" element={<TeamLeads scope="all" />} />
              <Route path="team-leads/:memberId" element={<TeamLeads scope="member" />} />
              <Route path="team" element={<TeamContacts />} />
              <Route path="team-performance" element={<TeamPerformance />} />
              <Route path="approvals" element={<Approvals />} />
              <Route path="admin" element={<AdminPanel />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route
              path="/lead/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<LeadDetail />} />
            </Route>

            {/* Legacy paths from the original information architecture. */}
            <Route path="/leads" element={<Navigate to="/dashboard/leads" replace />} />
            <Route path="/all-leads" element={<Navigate to="/dashboard/all-leads" replace />} />
            <Route path="/followups" element={<Navigate to="/dashboard/followups" replace />} />
            <Route path="/lead-assignment" element={<Navigate to="/dashboard/lead-assignment" replace />} />
            <Route path="/all-team-leads" element={<Navigate to="/dashboard/all-team-leads" replace />} />
            <Route path="/team" element={<Navigate to="/dashboard/team" replace />} />
            <Route path="/team-performance" element={<Navigate to="/dashboard/team-performance" replace />} />
            <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
            <Route path="/admin" element={<Navigate to="/dashboard/admin" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>

          <InstallPrompt />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
