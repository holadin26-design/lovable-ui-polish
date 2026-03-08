import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ActiveFollowups from "@/pages/ActiveFollowups";
import Templates from "@/pages/Templates";
import Campaigns from "@/pages/Campaigns";
import LeadImport from "@/pages/LeadImport";
import SettingsPage from "@/pages/SettingsPage";
import WarmupPage from "@/pages/WarmupPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><AppLayout><Dashboard /></AppLayout></PrivateRoute>} />
      <Route path="/followups" element={<PrivateRoute><AppLayout><ActiveFollowups /></AppLayout></PrivateRoute>} />
      <Route path="/templates" element={<PrivateRoute><AppLayout><Templates /></AppLayout></PrivateRoute>} />
      <Route path="/campaigns" element={<PrivateRoute><AppLayout><Campaigns /></AppLayout></PrivateRoute>} />
      <Route path="/leads" element={<PrivateRoute><AppLayout><LeadImport /></AppLayout></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><AppLayout><SettingsPage /></AppLayout></PrivateRoute>} />
      <Route path="/warmup" element={<PrivateRoute><AppLayout><WarmupPage /></AppLayout></PrivateRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
