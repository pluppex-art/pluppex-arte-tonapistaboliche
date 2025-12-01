import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext'; // Import Provider
import Layout from './components/Layout';
import Login from './pages/Login';
import PublicBooking from './pages/PublicBooking';
import Checkout from './pages/Checkout';
import Agenda from './pages/Agenda';
import CRM from './pages/CRM';
import Settings from './pages/Settings';
import Financeiro from './pages/Financeiro';
import ClientDashboard from './pages/ClientDashboard';
import { UserRole, User } from './types';
import { supabase } from './services/supabaseClient';
import { db } from './services/mockBackend';

// Protected Route Wrapper (Refactored to use Context)
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: keyof User; 
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requiredPermission }) => {
  const { user, loading } = useApp();
  
  if (loading) return <div className="min-h-screen bg-slate-950"></div>; // Wait for context

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 1. Check Roles first (optional)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/agenda" replace />; 
  }

  // 2. Check Specific Permission
  if (requiredPermission && user.role !== UserRole.ADMIN) {
     const hasPermission = user[requiredPermission];
     if (hasPermission !== true) {
         return <Navigate to="/agenda" replace />; 
     }
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AppProvider>
        <Router>
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/agendamento" element={<PublicBooking />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/" element={<Navigate to="/agendamento" />} />

                {/* Client Routes */}
                <Route path="/minha-conta" element={<ClientDashboard />} />

                {/* Protected Staff Routes */}
                <Route path="/agenda" element={
                    <ProtectedRoute requiredPermission="perm_view_agenda">
                        <Layout><Agenda /></Layout>
                    </ProtectedRoute>
                } />
                
                <Route path="/financeiro" element={
                    <ProtectedRoute requiredPermission="perm_view_financial">
                        <Layout><Financeiro /></Layout>
                    </ProtectedRoute>
                } />
                
                <Route path="/clientes" element={
                    <ProtectedRoute requiredPermission="perm_view_crm">
                        <Layout><CRM /></Layout>
                    </ProtectedRoute>
                } />
                
                <Route path="/configuracoes" element={
                    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                        <Layout><Settings /></Layout>
                    </ProtectedRoute>
                } />
                
                <Route path="/dashboard" element={<Navigate to="/agenda" />} />
                <Route path="/crm" element={<Navigate to="/clientes" />} />
                <Route path="/funil" element={<Navigate to="/clientes" />} />
            </Routes>
        </Router>
    </AppProvider>
  );
};

export default App;