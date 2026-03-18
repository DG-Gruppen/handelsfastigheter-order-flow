import { useState, useEffect, createContext, useContext, ReactNode } from "react";
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
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async (userId: string, userEmail: string) => {
      console.log("[Auth] Fetching profile for user_id:", userId, "email:", userEmail);
      const [profileResult, rolesResult, groupRolesResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        // Derive roles from groups' role_equivalent via group membership
        supabase
          .from("group_members")
          .select("group_id, groups!inner(role_equivalent)")
          .eq("user_id", userId),
      ]);
      console.log("[Auth] Profile result:", profileResult.data ? "found" : "NOT FOUND", profileResult.error?.message ?? "no error");
      console.log("[Auth] Roles result:", rolesResult.data, rolesResult.error?.message ?? "no error");
      console.log("[Auth] Group roles result:", groupRolesResult.data, groupRolesResult.error?.message ?? "no error");

      if (isMounted) {
        setProfile(profileResult.data as Profile | null);
        // Merge roles from user_roles table and group-derived role_equivalents
        const directRoles = rolesResult.data?.map((r: any) => r.role) ?? [];
        const groupDerivedRoles = (groupRolesResult.data ?? [])
          .map((g: any) => (g.groups as any)?.role_equivalent)
          .filter((r: string | null): r is string => !!r);
        const mergedRoles = [...new Set([...directRoles, ...groupDerivedRoles])];
        setRoles(mergedRoles);
        setLoading(false);
      }
    };

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("[Auth] onAuthStateChange event:", _event, "user:", session?.user?.email ?? "none");
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => {
            fetchUserData(session.user.id, session.user.email ?? "");
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[Auth] getSession result:", session?.user?.email ?? "no session");
      if (!session) {
        if (isMounted) setLoading(false);
      }
      // If session exists, onAuthStateChange will handle it
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
