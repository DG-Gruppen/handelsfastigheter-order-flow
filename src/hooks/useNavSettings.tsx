import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface NavSettingsContextType {
  settings: Record<string, string>;
  loading: boolean;
  refresh: () => void;
}

const NavSettingsContext = createContext<NavSettingsContextType>({ settings: {}, loading: true });

// Map routes to their setting keys
const routeSettingMap: Record<string, string> = {
  "/dashboard": "nav_dashboard",
  "/orders/new": "nav_new_order",
  "/approvals": "nav_approvals",
  "/history": "nav_history",
  "/org": "nav_org",
  "/admin": "nav_admin",
};

export function NavSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetch = async () => {
      const { data } = await supabase
        .from("org_chart_settings")
        .select("setting_key, setting_value");
      const map: Record<string, string> = {};
      for (const s of (data as any[]) ?? []) map[s.setting_key] = s.setting_value;
      setSettings(map);
      setLoading(false);
    };
    fetch();
  }, [user]);

  return (
    <NavSettingsContext.Provider value={{ settings, loading }}>
      {children}
    </NavSettingsContext.Provider>
  );
}

export function useNavSettings() {
  const { settings, loading } = useContext(NavSettingsContext);
  // Keep backward compat: navSettings is the same as settings
  return { navSettings: settings, settings, loading };
}

export function isRouteDisabled(settings: Record<string, string>, pathname: string): boolean {
  const settingKey = routeSettingMap[pathname];
  if (!settingKey) return false;
  return settings[settingKey] === "false";
}

export { routeSettingMap };
