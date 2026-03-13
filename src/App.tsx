import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { NavSettingsProvider } from "@/hooks/useNavSettings";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewOrder from "./pages/NewOrder";

import Admin from "./pages/Admin";
import OrgTree from "./pages/OrgTree";
import Onboarding from "./pages/Onboarding";
import ITInfo from "./pages/ITInfo";
import LayoutRoute from "./components/LayoutRoute";

import OrderDetail from "./pages/OrderDetail";
import History from "./pages/History";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <NavSettingsProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<ProtectedRoute><LayoutRoute /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/orders/new" element={<NewOrder />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/approvals" element={<Approvals />} />
                  <Route path="/orders/:id" element={<OrderDetail />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/org" element={<OrgTree />} />
                  <Route path="/it-info" element={<ITInfo />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </NavSettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
