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

  return { isStaff, isHr, isManagerGroup, profileId: profile?.id ?? null };
}
