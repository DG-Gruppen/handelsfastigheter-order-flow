import { useMemo } from "react";
import { useModules } from "@/hooks/useModules";
import { useAuth } from "@/hooks/useAuth";
import { resolveModuleAccess } from "@/lib/moduleAccess";

/**
 * Check if the current user has specific module-level permissions by module slug.
 * Admin role always grants all permissions (superuser override).
 */
export function useModulePermission(slug: string) {
  const { modules, allAccess, allPermissions, userGroupIds, loading: modulesLoading } = useModules();
  const { user, roles, profile, loading: authLoading } = useAuth();
  const isAdmin = roles.includes("admin");
  const isExternal = profile?.is_external === true;

  return useMemo(() => {
    if (authLoading || modulesLoading) {
      return { canView: false, canEdit: false, canDelete: false, isOwner: false, loading: true };
    }

    if (isAdmin) {
      return { canView: true, canEdit: true, canDelete: true, isOwner: true, loading: false };
    }

    const mod = modules.find((m) => m.slug === slug);
    if (!mod || !user) {
      return { canView: false, canEdit: false, canDelete: false, isOwner: false, loading: false };
    }

    const access = resolveModuleAccess({
      allAccess,
      isAdmin,
      isExternal,
      moduleId: mod.id,
      permissions: allPermissions,
      roles,
      userGroupIds,
      userId: user.id,
    });

    return {
      canView: access.canView,
      canEdit: access.canEdit,
      canDelete: access.canDelete,
      isOwner: access.isOwner,
      loading: false,
    };
  }, [modules, allAccess, allPermissions, userGroupIds, user?.id, isAdmin, isExternal, slug, roles, authLoading, modulesLoading]);
}
