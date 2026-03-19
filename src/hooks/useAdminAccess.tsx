import { useMemo } from "react";
import { useModules } from "@/hooks/useModules";
import { useAuth } from "@/hooks/useAuth";

/**
 * Map each admin section to the module slug(s) that grant edit access.
 * Sections without a slug mapping are admin-only.
 */
const SECTION_SLUG_MAP: Record<string, string | null> = {
  categories: null,     // admin-only (order config)
  equipment: null,      // admin-only (order config)
  systems: null,        // admin-only (order config)
  knowledge: "kunskapsbanken",
  news: "nyheter",
  tools: "tools",
  users: null,          // admin-only
  groups: null,         // admin-only
  permissions: null,    // admin-only
  settings: null,       // admin-only
  it: "it-support",
  backup: null,         // admin-only
  workwear: "workwear",
};

/**
 * Returns which admin sections the current user may access,
 * plus a boolean `hasAnyEditAccess` for sidebar visibility.
 *
 * Rule: a user sees an admin section if they have `can_edit` on the
 * mapped module slug, OR if they are admin (admin sees everything).
 */
export function useAdminAccess() {
  const { modules, allPermissions, userGroupIds } = useModules();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isIT = roles.includes("it");

  return useMemo(() => {
    // Admin and IT roles get full access to all admin sections
    if (isAdmin || isIT) {
      return {
        hasAnyEditAccess: true,
        canAccessSection: (_sectionId: string) => true,
      };
    }

    if (!user) {
      return {
        hasAnyEditAccess: false,
        canAccessSection: (_sectionId: string) => false,
      };
    }

    // Build a set of module slugs where user has can_edit
    const editableSlugs = new Set<string>();
    for (const p of allPermissions) {
      if (!p.can_edit && !p.is_owner) continue;
      const matches =
        (p.grantee_type === "user" && p.grantee_id === user.id) ||
        (p.grantee_type === "group" && userGroupIds.includes(p.grantee_id));
      if (!matches) continue;
      const mod = modules.find((m) => m.id === p.module_id);
      if (mod) editableSlugs.add(mod.slug);
    }

    const canAccessSection = (sectionId: string): boolean => {
      const slug = SECTION_SLUG_MAP[sectionId];
      // null means admin-only → non-admins can't see it
      if (slug === null || slug === undefined) return false;
      return editableSlugs.has(slug);
    };

    const hasAnyEditAccess = Object.values(SECTION_SLUG_MAP).some(
      (slug) => slug !== null && editableSlugs.has(slug)
    );

    return { hasAnyEditAccess, canAccessSection };
  }, [modules, allPermissions, userGroupIds, user?.id, isAdmin, isIT]);
}
