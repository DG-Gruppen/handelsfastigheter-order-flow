import { createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface NavSettingsContextType {
  settings: Record<string, string>;
  loading: boolean;
  refresh: () => void;
}

const NavSettingsContext = createContext<NavSettingsContextType>({ settings: {}, loading: true, refresh: () => {} });

// Map routes to their setting keys
const routeSettingMap: Record<string, string> = {
  "/dashboard": "nav_dashboard",
  "/orders/new": "nav_new_order",
  "/approvals": "nav_approvals",
  "/history": "nav_history",
  "/org": "nav_org",
  "/admin": "nav_admin",
};

async function fetchNavSettings(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("org_chart_settings")
    .select("setting_key, setting_value");
  const map: Record<string, string> = {};
  for (const s of (data as any[]) ?? []) map[s.setting_key] = s.setting_value;
  return map;
}

export function NavSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["nav-settings"],
    queryFn: fetchNavSettings,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["nav-settings"] });
  };

  return (
    <NavSettingsContext.Provider value={{ settings, loading: !user ? false : isLoading, refresh }}>
      {children}
    </NavSettingsContext.Provider>
  );
}

export function useNavSettings() {
  const { settings, loading, refresh } = useContext(NavSettingsContext);
  return { navSettings: settings, settings, loading, refresh };
}

export function isRouteDisabled(settings: Record<string, string>, pathname: string): boolean {
  const settingKey = routeSettingMap[pathname];
  if (!settingKey) return false;
  return settings[settingKey] === "false";
}

export { routeSettingMap };
