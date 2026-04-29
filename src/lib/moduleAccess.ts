export interface ModuleAccessRule {
  module_id: string;
  role: string;
  has_access: boolean;
}

export interface ModulePermissionRow {
  module_id: string;
  grantee_type: string;
  grantee_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  is_owner: boolean;
}

interface ResolveModuleAccessParams {
  allAccess: ModuleAccessRule[];
  isAdmin: boolean;
  isExternal: boolean;
  moduleId: string;
  permissions: ModulePermissionRow[];
  roles: string[];
  userGroupIds: string[];
  userId: string;
}

export interface ModuleAccessSummary {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isOwner: boolean;
  hasRoleAccess: boolean;
  hasExplicitViewAccess: boolean;
  moduleHasExplicitAssignments: boolean;
}

function permissionGrantsAnyAccess(permission: ModulePermissionRow) {
  return permission.can_view || permission.can_edit || permission.can_delete || permission.is_owner;
}

function permissionMatchesUser(permission: ModulePermissionRow, userId: string, userGroupIds: string[]) {
  return (
    (permission.grantee_type === "user" && permission.grantee_id === userId) ||
    (permission.grantee_type === "group" && userGroupIds.includes(permission.grantee_id))
  );
}

export function resolveModuleAccess({
  allAccess,
  isAdmin,
  isExternal,
  moduleId,
  permissions,
  roles,
  userGroupIds,
  userId,
}: ResolveModuleAccessParams): ModuleAccessSummary {
  if (isAdmin) {
    return {
      canView: true,
      canEdit: true,
      canDelete: true,
      isOwner: true,
      hasRoleAccess: true,
      hasExplicitViewAccess: true,
      moduleHasExplicitAssignments: true,
    };
  }

  const modulePermissions = permissions.filter((permission) => permission.module_id === moduleId);
  const matchingPermissions = modulePermissions.filter((permission) =>
    permissionMatchesUser(permission, userId, userGroupIds)
  );

  const isOwner = matchingPermissions.some((permission) => permission.is_owner);
  const canEdit = isOwner || matchingPermissions.some((permission) => permission.can_edit);
  const canDelete = isOwner || matchingPermissions.some((permission) => permission.can_delete);
  const hasExplicitViewAccess = matchingPermissions.some((permission) => permissionGrantsAnyAccess(permission));
  const moduleHasExplicitAssignments = modulePermissions.some((permission) => permissionGrantsAnyAccess(permission));

  let hasRoleAccess = false;
  let canView = hasExplicitViewAccess;

  if (!canView) {
    if (isExternal) {
      canView = false;
    } else {
      const moduleRules = allAccess.filter((accessRule) => accessRule.module_id === moduleId);

      if (moduleRules.length === 0) {
        hasRoleAccess = true;
        canView = true;
      } else if (roles.length === 0) {
        hasRoleAccess = moduleRules.every((accessRule) => accessRule.has_access);
        canView = hasRoleAccess;
      } else {
        hasRoleAccess = roles.some((role) => {
          const rule = moduleRules.find((accessRule) => accessRule.role === role);
          return rule ? rule.has_access : false;
        });
        canView = hasRoleAccess;
      }
    }
  }

  if (isOwner) {
    canView = true;
  }

  return {
    canView,
    canEdit,
    canDelete,
    isOwner,
    hasRoleAccess,
    hasExplicitViewAccess,
    moduleHasExplicitAssignments,
  };
}