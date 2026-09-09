import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";

/**
 * Vem är användaren i boarding-sammanhang?
 * staff = admin, IT eller medlem i HR-gruppen (speglar boarding_is_staff i databasen).
 * RLS är det som gäller – detta styr bara vad UI:t visar.
 */
export function useBoardingAccess() {
  const { roles, profile } = useAuth();
  const { userGroupIds } = useModules();
  const [hrGroupId, setHrGroupId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("groups")
      .select("id")
      .ilike("name", "HR")
      .maybeSingle()
      .then(({ data }) => setHrGroupId(data?.id ?? null));
  }, []);

  const isHr = !!hrGroupId && userGroupIds.includes(hrGroupId);
  const isStaff = roles.includes("admin") || roles.includes("it") || isHr;
  const isManagerGroup = roles.includes("manager");
  // Stab (role_equivalent "staff") får se personuppgifterna i ärendets huvud, men är inte boarding-staff.
  const isStab = roles.includes("staff");

  return { isStaff, isHr, isManagerGroup, isStab, profileId: profile?.id ?? null };
}
