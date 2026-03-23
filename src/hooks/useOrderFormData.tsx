import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CategoryOption {
  id: string;
  name: string;
  icon: string;
}

export interface OrderTypeOption {
  id: string;
  name: string;
  category_id: string | null;
  description: string;
  icon: string;
}

export interface ProfileOption {
  id: string;
  user_id: string;
  full_name: string;
  manager_id?: string | null;
}

export interface SystemOption {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface MyProfileData {
  id: string;
  is_staff: boolean | null;
  manager_id: string | null;
  department: string | null;
}

export interface OrderFormData {
  categories: CategoryOption[];
  orderTypes: OrderTypeOption[];
  allProfiles: ProfileOption[];
  managers: ProfileOption[];
  systems: SystemOption[];
  departmentsList: DepartmentOption[];
  approvalSettings: Record<string, string>;
  myProfile: MyProfileData | null;
  ceoProfile: ProfileOption | null;
  myManagerProfile: ProfileOption | null;
}

async function fetchOrderFormData(userId: string, userRoles: string[]): Promise<OrderFormData> {
  const [catsRes, typesRes, profilesRes, allProfilesRes, rolesRes, myProfileRes, catDeptsRes, otDeptsRes, approvalRes, deptRows, systemsRes] = await Promise.all([
    supabase.from("categories").select("id, name, icon").eq("is_active", true).order("sort_order"),
    supabase.from("order_types").select("id, name, category_id, description, icon").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id, user_id, full_name").neq("user_id", userId),
    supabase.from("profiles").select("id, user_id, full_name, manager_id").order("full_name"),
    supabase.rpc("get_all_user_roles"),
    supabase.from("profiles").select("id, department, is_staff, manager_id, user_id").eq("user_id", userId).single(),
    supabase.from("category_departments").select("category_id, department_id"),
    supabase.from("order_type_departments").select("order_type_id, department_id"),
    supabase.from("org_chart_settings").select("setting_key, setting_value").in("setting_key", ["approval_managers_to_ceo", "approval_staff_to_ceo"]),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("systems").select("id, name, description, icon").eq("is_active", true).order("sort_order"),
  ]);

  const allCats = (catsRes.data as CategoryOption[]) ?? [];
  const allTypes = (typesRes.data as OrderTypeOption[]) ?? [];
  const fetchedAllProfiles = (allProfilesRes.data as ProfileOption[]) ?? [];
  const departments = (deptRows.data as DepartmentOption[]) ?? [];

  const mp = myProfileRes.data as any;
  const myProfile: MyProfileData | null = mp
    ? { id: mp.id, is_staff: mp.is_staff, manager_id: mp.manager_id, department: mp.department }
    : null;

  const aMap: Record<string, string> = {};
  for (const s of (approvalRes.data as any[]) ?? []) aMap[s.setting_key] = s.setting_value;

  // Build department filter maps
  const catDeptMap: Record<string, string[]> = {};
  for (const row of (catDeptsRes.data as any[]) ?? []) {
    if (!catDeptMap[row.category_id]) catDeptMap[row.category_id] = [];
    catDeptMap[row.category_id].push(row.department_id);
  }
  const otDeptMap: Record<string, string[]> = {};
  for (const row of (otDeptsRes.data as any[]) ?? []) {
    if (!otDeptMap[row.order_type_id]) otDeptMap[row.order_type_id] = [];
    otDeptMap[row.order_type_id].push(row.department_id);
  }

  const userDept = mp?.department ?? "";
  const userDeptId = departments.find((d) => d.name === userDept)?.id;

  const isAdmin = userRoles.includes("admin");
  const filteredCats = isAdmin ? allCats : allCats.filter((c) => {
    const restricted = catDeptMap[c.id];
    if (!restricted || restricted.length === 0) return true;
    return userDeptId ? restricted.includes(userDeptId) : true;
  });
  const filteredTypes = isAdmin ? allTypes : allTypes.filter((ot) => {
    const restricted = otDeptMap[ot.id];
    if (!restricted || restricted.length === 0) return true;
    return userDeptId ? restricted.includes(userDeptId) : true;
  });

  // Resolve managers, CEO, my manager
  const rolesData = (rolesRes.data ?? []) as Array<{ user_id: string; role: string }>;
  const managerUserIds = new Set(
    rolesData.filter((r) => r.role === "manager" || r.role === "admin").map((r) => r.user_id)
  );
  const adminUserIds = new Set(
    rolesData.filter((r) => r.role === "admin").map((r) => r.user_id)
  );

  const filteredManagers = ((profilesRes.data as ProfileOption[]) ?? []).filter(
    (p) => managerUserIds.has(p.user_id)
  );

  const ceo = fetchedAllProfiles.find((p) => !p.manager_id && adminUserIds.has(p.user_id));
  const ceoProfile: ProfileOption | null = ceo
    ? { id: ceo.id, user_id: ceo.user_id, full_name: ceo.full_name }
    : null;

  let myManagerProfile: ProfileOption | null = null;
  if (mp?.manager_id) {
    const mgrProfile = fetchedAllProfiles.find((p) => p.id === mp.manager_id);
    if (mgrProfile) myManagerProfile = { id: mgrProfile.id, user_id: mgrProfile.user_id, full_name: mgrProfile.full_name };
  }

  return {
    categories: filteredCats,
    orderTypes: filteredTypes,
    allProfiles: fetchedAllProfiles,
    managers: filteredManagers,
    systems: (systemsRes.data as SystemOption[]) ?? [],
    departmentsList: departments,
    approvalSettings: aMap,
    myProfile,
    ceoProfile,
    myManagerProfile,
  };
}

export function useOrderFormData() {
  const { user, roles } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["order-form-data", user?.id],
    queryFn: () => fetchOrderFormData(user!.id, roles),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data ?? null,
    isLoading,
  };
}

/** Centralised approval routing logic – single source of truth */
export function resolveApprovalRouting(params: {
  isCeo: boolean;
  isManagerOrAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  isIT: boolean;
  reportsDirectlyToCeo: boolean;
  approvalSettings: Record<string, string>;
  ceoProfileId: string | null;
  myManagerProfile: ProfileOption | null;
  currentUserId: string;
}) {
  const {
    isCeo, isManagerOrAdmin, isManager, isStaff, isIT,
    reportsDirectlyToCeo, approvalSettings,
    ceoProfileId, myManagerProfile, currentUserId,
  } = params;

  if (isCeo) {
    return { autoApprove: true, needsCeoApproval: false, needsManagerApproval: false, resolvedApproverId: currentUserId };
  }

  if ((isIT || isStaff) && !myManagerProfile) {
    return { autoApprove: true, needsCeoApproval: false, needsManagerApproval: false, resolvedApproverId: currentUserId };
  }

  const needsCeoApproval =
    isManagerOrAdmin &&
    reportsDirectlyToCeo &&
    (
      (isManager && approvalSettings["approval_managers_to_ceo"] === "true") ||
      (isStaff && approvalSettings["approval_staff_to_ceo"] === "true")
    );

  const needsManagerApproval =
    isManagerOrAdmin && !reportsDirectlyToCeo && myManagerProfile != null;

  const autoApprove = isManagerOrAdmin && !needsCeoApproval && !needsManagerApproval;

  const resolvedApproverId = needsCeoApproval && ceoProfileId
    ? ceoProfileId
    : needsManagerApproval && myManagerProfile
      ? myManagerProfile.user_id
      : autoApprove
        ? currentUserId
        : (myManagerProfile?.user_id ?? null);

  return { autoApprove, needsCeoApproval, needsManagerApproval, resolvedApproverId };
}
