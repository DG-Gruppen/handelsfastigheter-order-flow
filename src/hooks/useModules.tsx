import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Module {
  id: string;
  name: string;
  slug: string;
  route: string;
  icon: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

interface ModuleAccess {
  module_id: string;
  role: string;
  has_access: boolean;
}

interface ModulesContextType {
  modules: Module[];
  accessibleModules: Module[];
  allAccess: ModuleAccess[];
  loading: boolean;
  refresh: () => void;
}

const ModulesContext = createContext<ModulesContextType>({
  modules: [],
  accessibleModules: [],
  allAccess: [],
  loading: true,
  refresh: () => {},
});

export function ModulesProvider({ children }: { children: ReactNode }) {
  const { user, roles } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [allAccess, setAllAccess] = useState<ModuleAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModules = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const [modulesRes, accessRes] = await Promise.all([
      supabase.from("modules").select("*").order("sort_order"),
      supabase.from("module_role_access").select("module_id, role, has_access"),
    ]);

    setModules((modulesRes.data as Module[]) ?? []);
    setAllAccess((accessRes.data as ModuleAccess[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchModules();
  }, [user, roles.length]);

  // Memoize accessible modules to prevent unnecessary re-renders downstream
  const accessibleModules = useMemo(() => {
    return modules.filter((m) => {
      if (!m.is_active) return false;
      const moduleRules = allAccess.filter((a) => a.module_id === m.id);
      if (moduleRules.length === 0) return true;
      return roles.some((role) => {
        const rule = moduleRules.find((a) => a.role === role);
        return rule ? rule.has_access : false;
      });
    });
  }, [modules, allAccess, roles]);

  return (
    <ModulesContext.Provider value={{ modules, accessibleModules, allAccess, loading, refresh: fetchModules }}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  return useContext(ModulesContext);
}

export function useModuleAccess(route: string): boolean {
  const { accessibleModules, modules, loading } = useModules();
  if (loading) return true;
  const isRegisteredModule = modules.some((m) => m.route === route);
  if (!isRegisteredModule) return true;
  return accessibleModules.some((m) => m.route === route);
}
