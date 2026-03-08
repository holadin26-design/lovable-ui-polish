import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ActiveFollowups from "@/pages/ActiveFollowups";
import Templates from "@/pages/Templates";
import Campaigns from "@/pages/Campaigns";
import LeadImport from "@/pages/LeadImport";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <AppLayout>
                <Dashboard />
              </AppLayout>
            }
          />
          <Route
            path="/followups"
            element={
              <AppLayout>
                <ActiveFollowups />
              </AppLayout>
            }
          />
          <Route
            path="/templates"
            element={
              <AppLayout>
                <Templates />
              </AppLayout>
            }
          />
          <Route
            path="/campaigns"
            element={
              <AppLayout>
                <Campaigns />
              </AppLayout>
            }
          />
          <Route
            path="/leads"
            element={
              <AppLayout>
                <LeadImport />
              </AppLayout>
            }
          />
          <Route
            path="/settings"
            element={
              <AppLayout>
                <SettingsPage />
              </AppLayout>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
