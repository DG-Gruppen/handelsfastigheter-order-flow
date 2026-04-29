import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string;
  phone: string;
  manager_id: string | null;
  theme_preference: string | null;
  is_external: boolean;
}

interface UserRoleRow {
  role: string;
}

interface GroupMemberRow {
  groups: { role_equivalent: string | null };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  realRoles: string[];
  roleOverride: string[] | null;
  setRoleOverride: (roles: string[] | null) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  realRoles: [],
  roleOverride: null,
  setRoleOverride: () => {},
  loading: true,
  signOut: async () => {},
});

const ROLE_OVERRIDE_KEY = "shf_dev_role_override";

function readRoleOverride(): string[] | null {
  try {
    const raw = localStorage.getItem(ROLE_OVERRIDE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((x) => typeof x === "string") ? parsed : null;
  } catch {
    return null;
  }
}

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [roleOverride, setRoleOverrideState] = useState<string[] | null>(() => readRoleOverride());
  const [loading, setLoading] = useState(true);
  const fetchIdRef = useRef(0);

  const setRoleOverride = (next: string[] | null) => {
    if (next && next.length > 0) {
      localStorage.setItem(ROLE_OVERRIDE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(ROLE_OVERRIDE_KEY);
    }
    setRoleOverrideState(next && next.length > 0 ? next : null);
  };

  const effectiveRoles = roleOverride ?? roles;

  const fetchUserData = useCallback(async (userId: string) => {
    const fetchId = ++fetchIdRef.current;

    const [profileResult, rolesResult, groupRolesResult] = await Promise.all([
      supabase.from("profiles").select("id,user_id,full_name,email,department,phone,manager_id,theme_preference,is_external").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("group_members")
        .select("group_id, groups!inner(role_equivalent)")
        .eq("user_id", userId),
    ]);

    if (fetchId !== fetchIdRef.current) return;

    const nextProfile = profileResult.data as Profile | null;
    setProfile(nextProfile);
    const directRoles = (rolesResult.data as UserRoleRow[] | null)?.map((r) => r.role) ?? [];
    const groupDerivedRoles = ((groupRolesResult.data as GroupMemberRow[] | null) ?? [])
      .map((g) => g.groups?.role_equivalent)
      .filter((r): r is string => !!r);
    const baseRoles = nextProfile?.is_external === true ? [] : ["employee"];
    const mergedRoles = [...new Set([...baseRoles, ...directRoles, ...groupDerivedRoles])];
    setRoles(mergedRoles);
    setLoading(false);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setLoading(true);
          setTimeout(() => {
            void fetchUserData(session.user.id);
          }, 0);
        } else {
          fetchIdRef.current++;
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        void fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      fetchIdRef.current++;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, roles: effectiveRoles, realRoles: roles, roleOverride, setRoleOverride, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
