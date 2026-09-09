import { lazyWithRetry } from "@/lib/lazyWithRetry";
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
const Login = lazyWithRetry(() => import("./pages/Login"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const NewOrder = lazyWithRetry(() => import("./pages/NewOrder"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const OrgTree = lazyWithRetry(() => import("./pages/OrgTree"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const OnboardingPlan = lazyWithRetry(() => import("./pages/OnboardingPlan"));
const OffboardingPlan = lazyWithRetry(() => import("./pages/OffboardingPlan"));
const BoardingPlan = lazyWithRetry(() => import("./pages/BoardingPlan"));
const Boarding = lazyWithRetry(() => import("./pages/Boarding"));
const BoardingNew = lazyWithRetry(() => import("./pages/BoardingNew"));
const BoardingDetail = lazyWithRetry(() => import("./pages/BoardingDetail"));
const BoardingV2List = lazyWithRetry(() => import("./pages/boardingv2/BoardingV2List"));
const BoardingV2New = lazyWithRetry(() => import("./pages/boardingv2/BoardingV2New"));
const BoardingV2Detail = lazyWithRetry(() => import("./pages/boardingv2/BoardingV2Detail"));
const ITInfo = lazyWithRetry(() => import("./pages/ITInfo"));
const OrderDetail = lazyWithRetry(() => import("./pages/OrderDetail"));
const History = lazyWithRetry(() => import("./pages/History"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const Personnel = lazyWithRetry(() => import("./pages/Personnel"));
const Documents = lazyWithRetry(() => import("./pages/Documents"));
const KnowledgeBase = lazyWithRetry(() => import("./pages/KnowledgeBase"));
const MySHF = lazyWithRetry(() => import("./pages/MySHF"));
const Planner = lazyWithRetry(() => import("./pages/Planner"));
const Tools = lazyWithRetry(() => import("./pages/Tools"));
const Passwords = lazyWithRetry(() => import("./pages/Passwords"));
const Culture = lazyWithRetry(() => import("./pages/Culture"));
const News = lazyWithRetry(() => import("./pages/News"));
const Workwear = lazyWithRetry(() => import("./pages/Workwear"));
const Statistics = lazyWithRetry(() => import("./pages/Statistics"));
const Kpi = lazyWithRetry(() => import("./pages/Kpi"));
const Prompts = lazyWithRetry(() => import("./pages/Prompts"));

const LccCalculator = lazyWithRetry(() => import("./pages/LccCalculator"));
const ExternalDashboard = lazyWithRetry(() => import("./pages/ExternalDashboard"));
const Fastigheter = lazyWithRetry(() => import("./pages/Fastigheter"));

const Unsubscribe = lazyWithRetry(() => import("./pages/Unsubscribe"));
const ExternalLogin = lazyWithRetry(() => import("./pages/ExternalLogin"));
const ExternalInvite = lazyWithRetry(() => import("./pages/ExternalInvite"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

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

const LoginFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
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
                <Routes>
                    <Route path="/login" element={<Suspense fallback={<LoginFallback />}><Login /></Suspense>} />
                    <Route path="/extern" element={<Suspense fallback={<LoginFallback />}><ExternalLogin /></Suspense>} />
                    <Route path="/extern/invite/:token" element={<Suspense fallback={<LoginFallback />}><ExternalInvite /></Suspense>} />
                    <Route path="/unsubscribe" element={<Suspense fallback={<LoginFallback />}><Unsubscribe /></Suspense>} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route element={<ProtectedRoute><LayoutRoute /></ProtectedRoute>}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/orders/new" element={<NewOrder />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/onboarding-plan" element={<OnboardingPlan />} />
                     <Route path="/offboarding-plan" element={<OffboardingPlan />} />
                     <Route path="/boarding-plan" element={<BoardingPlan />} />
                     <Route path="/boarding" element={<Boarding />} />
                     <Route path="/boarding/ny" element={<BoardingNew />} />
                     <Route path="/boarding/:id" element={<BoardingDetail />} />
                     <Route path="/boardingv2" element={<BoardingV2List />} />
                     <Route path="/boardingv2/ny" element={<BoardingV2New />} />
                     <Route path="/boardingv2/:id" element={<BoardingV2Detail />} />
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
                      <Route path="/verktyg" element={<Tools />} />
                      <Route path="/losenord" element={<Passwords />} />
                      <Route path="/kulturen" element={<Culture />} />
                      <Route path="/nyheter" element={<News />} />
                      <Route path="/arbetsklader" element={<Workwear />} />
                      <Route path="/extern/dashboard" element={<ExternalDashboard />} />
                      <Route path="/statistik" element={<Statistics />} />
                      <Route path="/kpi" element={<Kpi />} />
                      <Route path="/prompts" element={<Prompts />} />
                      
                      <Route path="/lcc" element={<LccCalculator />} />
                      <Route path="/fastigheter" element={<Fastigheter />} />
                      
                      <Route path="/profile" element={<Profile />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
              </ModulesProvider>
            </NavSettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
