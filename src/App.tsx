import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { NavSettingsProvider } from "@/hooks/useNavSettings";
import { ModulesProvider } from "@/hooks/useModules";
import ProtectedRoute from "@/components/ProtectedRoute";
import LayoutRoute from "./components/LayoutRoute";
import { lazy, Suspense } from "react";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewOrder = lazy(() => import("./pages/NewOrder"));
const Admin = lazy(() => import("./pages/Admin"));
const OrgTree = lazy(() => import("./pages/OrgTree"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ITInfo = lazy(() => import("./pages/ITInfo"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const History = lazy(() => import("./pages/History"));
const Profile = lazy(() => import("./pages/Profile"));
const Personnel = lazy(() => import("./pages/Personnel"));
const Documents = lazy(() => import("./pages/Documents"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const MySHF = lazy(() => import("./pages/MySHF"));
const Planner = lazy(() => import("./pages/Planner"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 min
      gcTime: 10 * 60 * 1000,     // 10 min garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <NavSettingsProvider>
              <ModulesProvider>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route element={<ProtectedRoute><LayoutRoute /></ProtectedRoute>}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/orders/new" element={<NewOrder />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/approvals" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/orders/:id" element={<OrderDetail />} />
                      <Route path="/history" element={<History />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/org" element={<OrgTree />} />
                      <Route path="/it-info" element={<ITInfo />} />
                      <Route path="/personal" element={<Personnel />} />
                      <Route path="/dokument" element={<Documents />} />
                      <Route path="/kunskapsbanken" element={<KnowledgeBase />} />
                      <Route path="/mitt-shf" element={<MySHF />} />
                      <Route path="/planner" element={<Planner />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Routes>
                </Suspense>
              </ModulesProvider>
            </NavSettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
