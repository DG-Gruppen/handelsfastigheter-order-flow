import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface NavSettingsContextType {
  navSettings: Record<string, string>;
  loading: boolean;
}

const NavSettingsContext = createContext<NavSettingsContextType>({ navSettings: {}, loading: true });

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
  const [navSettings, setNavSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetch = async () => {
      const { data } = await supabase
        .from("org_chart_settings")
        .select("setting_key, setting_value")
        .like("setting_key", "nav_%");
      const map: Record<string, string> = {};
      for (const s of (data as any[]) ?? []) map[s.setting_key] = s.setting_value;
      setNavSettings(map);
      setLoading(false);
    };
    fetch();
  }, [user]);

  return (
    <NavSettingsContext.Provider value={{ navSettings, loading }}>
      {children}
    </NavSettingsContext.Provider>
  );
}

export function useNavSettings() {
  return useContext(NavSettingsContext);
}

export function isRouteDisabled(navSettings: Record<string, string>, pathname: string): boolean {
  const settingKey = routeSettingMap[pathname];
  if (!settingKey) return false;
  return navSettings[settingKey] === "false";
}

export { routeSettingMap };
