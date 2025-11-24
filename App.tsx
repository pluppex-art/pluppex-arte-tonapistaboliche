

import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import PublicBooking from './pages/PublicBooking';
import Checkout from './pages/Checkout';
import Agenda from './pages/Agenda';
import CRM from './pages/CRM';
import Settings from './pages/Settings';
import Financeiro from './pages/Financeiro';
import { UserRole, User } from './types';

// Protected Route Wrapper
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: keyof User; // Agora suporta verificação de permissão específica
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requiredPermission }) => {
  const stored = localStorage.getItem('tonapista_auth');
  
  if (!stored) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(stored) as User;

  // 1. Check Roles first (optional)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/agenda" replace />; 
  }

  // 2. Check Specific Permission
  // Se for ADMIN, ignora a checagem (acesso total)
  if (requiredPermission && user.role !== UserRole.ADMIN) {
     const hasPermission = user[requiredPermission];
     // A propriedade existe e é true? (lembrando que no TS é booleano, mas verificamos segurança)
     if (hasPermission !== true) {
         return <Navigate to="/agenda" replace />; // Redireciona se não tiver permissão
     }
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/agendamento" element={<PublicBooking />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/" element={<Navigate to="/agendamento" />} />

        {/* Protected Routes com Permissões Granulares */}
        
        {/* Agenda: Requer perm_view_agenda */}
        <Route path="/agenda" element={
            <ProtectedRoute requiredPermission="perm_view_agenda">
                <Layout><Agenda /></Layout>
            </ProtectedRoute>
        } />
        
        {/* Financeiro: Requer perm_view_financial */}
        <Route path="/financeiro" element={
            <ProtectedRoute requiredPermission="perm_view_financial">
                <Layout><Financeiro /></Layout>
            </ProtectedRoute>
        } />
        
        {/* CRM/Clientes: Requer perm_view_crm */}
        <Route path="/clientes" element={
            <ProtectedRoute requiredPermission="perm_view_crm">
                <Layout><CRM /></Layout>
            </ProtectedRoute>
        } />
        
        {/* Configurações: Apenas Admin */}
        <Route path="/configuracoes" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <Layout><Settings /></Layout>
            </ProtectedRoute>
        } />
        
        {/* Fallbacks */}
        <Route path="/dashboard" element={<Navigate to="/agenda" />} />
        <Route path="/crm" element={<Navigate to="/clientes" />} />
        <Route path="/funil" element={<Navigate to="/clientes" />} />
      </Routes>
    </Router>
  );
};

export default App;