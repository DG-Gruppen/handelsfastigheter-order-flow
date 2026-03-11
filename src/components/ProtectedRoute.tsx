import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNavSettings, isRouteDisabled } from "@/hooks/useNavSettings";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { navSettings, loading: navLoading } = useNavSettings();
  const location = useLocation();

  if (loading || navLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laddar...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (isRouteDisabled(navSettings, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
