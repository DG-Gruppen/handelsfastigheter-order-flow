import { createContext, useContext, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { resolveModuleAccess, type ModuleAccessRule, type ModulePermissionRow } from "@/lib/moduleAccess";

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

interface ModulesContextType {
  modules: Module[];
  accessibleModules: Module[];
  allAccess: ModuleAccessRule[];
  allPermissions: FullModulePermission[];
  userGroupIds: string[];
  loading: boolean;
  refresh: () => void;
}

const ModulesContext = createContext<ModulesContextType>({
  modules: [],
  accessibleModules: [],
  allAccess: [],
  allPermissions: [],
  userGroupIds: [],
  loading: true,
  refresh: () => {},
});

export interface FullModulePermission extends ModulePermissionRow {}

async function fetchModulesData(userId: string) {
  const [modulesRes, accessRes, permRes, groupRes] = await Promise.all([
    supabase.from("modules").select("*").order("sort_order"),
    supabase.from("module_role_access").select("module_id, role, has_access"),
    supabase.from("module_permissions").select("module_id, grantee_type, grantee_id, can_view, can_edit, can_delete, is_owner"),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
  ]);

  return {
    modules: (modulesRes.data as Module[]) ?? [],
    allAccess: (accessRes.data as ModuleAccessRule[]) ?? [],
    permissions: (permRes.data as ModulePermissionRow[]) ?? [],
    fullPermissions: (permRes.data as FullModulePermission[]) ?? [],
    userGroupIds: (groupRes.data ?? []).map((g: { group_id: string }) => g.group_id),
  };
}

export function ModulesProvider({ children }: { children: ReactNode }) {
  const { user, roles, profile, roleOverride, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["modules-data", user?.id, roleOverride?.join(",") ?? "real"],
    queryFn: () => fetchModulesData(user!.id),
    enabled: !!user && !authLoading,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const modules = data?.modules ?? [];
  const allAccess = data?.allAccess ?? [];
  const permissions = data?.permissions ?? [];
  const fullPermissions = data?.fullPermissions ?? [];
  const userGroupIds = data?.userGroupIds ?? [];
  const loading = authLoading || (!!user && isLoading);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["modules-data", user?.id] });
  };

  // Realtime: refresh on any permission/membership change.
  // We can't filter on the server because group-level permissions use
  // `grantee_id = group_id`, which doesn't match the user's id directly.
  // The query is cheap and only re-runs when something actually changed.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("module-permissions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "module_permissions" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "module_role_access" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        () => refresh()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Memoize accessible modules to prevent unnecessary re-renders downstream
  const isExternal = profile?.is_external === true;

  const accessibleModules = useMemo(() => {
    const isAdmin = roles.includes("admin");

    return modules.filter((m) => {
      if (!m.is_active) return false;
      if (!user?.id) return false;

      return resolveModuleAccess({
        allAccess,
        isAdmin,
        isExternal,
        moduleId: m.id,
        permissions: fullPermissions,
        roles,
        userGroupIds,
        userId: user.id,
      }).canView;
    });
  }, [modules, allAccess, fullPermissions, userGroupIds, roles, user?.id, isExternal]);

  return (
    <ModulesContext.Provider value={{ modules, accessibleModules, allAccess, allPermissions: fullPermissions, userGroupIds, loading, refresh }}>
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
