import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Mandators from './pages/Mandators';
import MandatorDetails from './pages/MandatorDetails';
import { ROUTES } from './lib/constants';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<Login />} />
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MANDATORS}
          element={
            <ProtectedRoute>
              <Mandators />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mandators/:id"
          element={
            <ProtectedRoute>
              <MandatorDetails />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
