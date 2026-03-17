import { useMemo } from "react";
import { useModules } from "@/hooks/useModules";
import { useAuth } from "@/hooks/useAuth";

/**
 * Check if the current user has specific module-level permissions by module slug.
 * Admin role always grants all permissions (superuser override).
 */
export function useModulePermission(slug: string) {
  const { modules, allPermissions, userGroupIds } = useModules();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");

  return useMemo(() => {
    if (isAdmin) {
      return { canView: true, canEdit: true, canDelete: true, isOwner: true };
    }

    const mod = modules.find((m) => m.slug === slug);
    if (!mod || !user) {
      return { canView: false, canEdit: false, canDelete: false, isOwner: false };
    }

    let canView = false;
    let canEdit = false;
    let canDelete = false;
    let isOwner = false;

    for (const p of allPermissions) {
      if (p.module_id !== mod.id) continue;
      const matches =
        (p.grantee_type === "user" && p.grantee_id === user.id) ||
        (p.grantee_type === "group" && userGroupIds.includes(p.grantee_id));
      if (!matches) continue;

      if (p.can_view) canView = true;
      if (p.can_edit) canEdit = true;
      if (p.can_delete) canDelete = true;
      if (p.is_owner) isOwner = true;
    }

    // Owner implies all
    if (isOwner) {
      canView = true;
      canEdit = true;
      canDelete = true;
    }

    return { canView, canEdit, canDelete, isOwner };
  }, [modules, allPermissions, userGroupIds, user?.id, isAdmin, slug]);
}
