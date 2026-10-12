import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import PokerTracker from '@/pages/PokerTracker';
import HandHistory from '@/pages/HandHistory';
import VariantSetup from '@/pages/VariantSetup';
import TVView from '@/pages/TVView';
import Spectator from '@/pages/Spectator';

const AuthenticatedApp = () => {
  const auth = useAuth() as {
    isLoadingAuth?: boolean;
    isLoadingPublicSettings?: boolean;
    authError?: { type?: string; message?: string } | null;
    navigateToLogin: () => void;
  };
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = auth;

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#121417]">
        <div className="w-8 h-8 border-4 border-[#2a2f37] border-t-emerald-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/spectator" element={<Spectator />} />
      <Route path="/" element={<PokerTracker />} />
      <Route path="/history" element={<HandHistory />} />
      <Route path="/variant" element={<VariantSetup />} />
      <Route path="/tv" element={<TVView />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}
