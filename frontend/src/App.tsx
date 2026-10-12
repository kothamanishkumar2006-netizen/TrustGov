import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import OfficerManagement from './pages/OfficerManagement';
import ReportManagement from './pages/ReportManagement';
import IvrSimulator from './pages/IvrSimulator';
import OfficerDashboard from './pages/OfficerDashboard';
import CitizenDashboard from './pages/CitizenDashboard';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Gateways */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Secure Admin Portal */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <DashboardLayout>
                  <AdminDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/officers"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <DashboardLayout>
                  <OfficerManagement />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <DashboardLayout>
                  <ReportManagement />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Interactive IVR Voice Accessibility Simulator */}
          <Route
            path="/admin/ivr-simulator"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'CITIZEN', 'OFFICER']}>
                <DashboardLayout>
                  <IvrSimulator />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ivr"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'CITIZEN', 'OFFICER']}>
                <DashboardLayout>
                  <IvrSimulator />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ivr-simulator"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'CITIZEN', 'OFFICER']}>
                <DashboardLayout>
                  <IvrSimulator />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Secure Officer Portal */}
          <Route
            path="/officer"
            element={
              <ProtectedRoute allowedRoles={['OFFICER']}>
                <DashboardLayout>
                  <OfficerDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Secure Citizen Protection Hub */}
          <Route
            path="/citizen"
            element={
              <ProtectedRoute allowedRoles={['CITIZEN']}>
                <DashboardLayout>
                  <CitizenDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Fallback route handles redirection based on state */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
