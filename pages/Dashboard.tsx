
// Dashboard.tsx is currently identical to Agenda.tsx logic in this system.
// We can simply export Agenda as Dashboard for now to maintain route compatibility
// or redirect. Since the user asked to rename "Agenda" to "Dashboard" visually,
// we are using pages/Agenda.tsx as the main dashboard implementation.
// This file is kept as a redirect or placeholder if needed, but for this refactor,
// we will just ensure it imports Agenda if used, or remove duplicate logic.

// Actually, let's just make it a redirect component to /agenda to keep things DRY
// as the user merged the concepts.

import React from 'react';
import { Navigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  return <Navigate to="/agenda" replace />;
};

export default Dashboard;
