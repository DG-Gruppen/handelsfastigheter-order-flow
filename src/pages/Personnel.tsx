import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Search, Phone, Mail, Users, Cake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ORG_COLOR_MAP, getRoleColorKey } from "@/lib/orgColors";

interface PersonnelProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  phone: string | null;
  title_override: string | null;
  birthday: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function formatBirthday(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export default function Personnel() {
  const [profiles, setProfiles] = useState<PersonnelProfile[]>([]);
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [colorSettings, setColorSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Alla");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    const [rolesRes, profilesRes, settingsRes] = await Promise.all([
      supabase.rpc("get_all_user_roles"),
      supabase.from("profiles").select("id, user_id, full_name, email, department, phone, title_override, birthday").order("full_name"),
      supabase.from("org_chart_settings").select("setting_key, setting_value"),
    ]);

    // Build role map
    const rm: Record<string, string> = {};
    const itUserIds = new Set<string>();
    for (const r of ((rolesRes.data as { user_id: string; role: string }[]) ?? [])) {
      const priority: Record<string, number> = { admin: 0, manager: 1, staff: 2, employee: 3 };
      if (!rm[r.user_id] || (priority[r.role] ?? 9) < (priority[rm[r.user_id]] ?? 9)) {
        rm[r.user_id] = r.role;
      }
      if (r.role === "it") itUserIds.add(r.user_id);
    }
    setRoleMap(rm);

    // Build color settings
    const cs: Record<string, string> = {};
    for (const s of ((settingsRes.data as any[]) ?? [])) {
      cs[s.setting_key] = s.setting_value;
    }
    setColorSettings(cs);

    const filtered = (profilesRes.data ?? []).filter(
      (p) => !itUserIds.has(p.user_id) && p.full_name.trim() !== ""
    );

    setProfiles(filtered);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('personnel-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchData(), 500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchData]);

  const departments = useMemo(() => {
    const depts = new Set(profiles.map((p) => p.department).filter(Boolean) as string[]);
    return Array.from(depts).sort();
  }, [profiles]);

  const allDepts = ["Alla", ...departments];

  const filtered = useMemo(() => {
    let result = profiles;
    if (filter !== "Alla") result = result.filter((p) => p.department === filter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          (p.department ?? "").toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.title_override ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [search, filter, profiles]);

  function getRoleStyle(userId: string): React.CSSProperties {
    const role = roleMap[userId] ?? "employee";
    const colorKey = getRoleColorKey(role, {
      color_root: colorSettings.color_root,
      color_staff: colorSettings.color_staff,
      color_manager: colorSettings.color_manager,
      color_employee: colorSettings.color_employee,
    });
    const colors = ORG_COLOR_MAP[colorKey] ?? ORG_COLOR_MAP.muted;
    return { background: `linear-gradient(135deg, ${colors.bg}, ${colors.accent})` };
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" />
          Personal
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {profiles.length} medarbetare på SHF
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Sök namn, avdelning, e-post, titel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 h-12 md:h-10 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {/* Department filter */}
      <div className="flex flex-wrap gap-2">
        {allDepts.map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`px-4 py-2.5 md:px-3 md:py-1.5 rounded-full text-xs font-medium transition-colors min-h-[44px] md:min-h-0 active:scale-[0.95] ${
              filter === d
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">Laddar personal...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((emp) => (
            <div
              key={emp.id}
              className="glass-card rounded-lg border border-border overflow-hidden hover:border-primary/30 transition-colors"
            >
              {/* Avatar header with role-based color */}
              <div className="h-16 relative" style={getRoleStyle(emp.user_id)}>
                <div className="absolute -bottom-6 left-4 w-12 h-12 rounded-full bg-card border-2 border-card flex items-center justify-center text-sm font-bold text-foreground shadow-sm">
                  {getInitials(emp.full_name)}
                </div>
              </div>
              <div className="pt-8 pb-4 px-4">
                <h3 className="font-heading font-semibold text-sm">{emp.full_name}</h3>
                {emp.title_override && (
                  <p className="text-xs text-muted-foreground">{emp.title_override}</p>
                )}
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {emp.department || "Ingen avdelning"}
                </p>

                {/* Contact */}
                <div className="flex items-center gap-1 mt-3">
                  {emp.phone && emp.phone !== "–" && emp.phone.trim() !== "" && (
                    <a
                      href={`tel:${emp.phone.replace(/[- ]/g, "")}`}
                      className="text-primary hover:text-primary/80 p-2 -m-1 rounded-lg hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title={emp.phone}
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  <a
                    href={`mailto:${emp.email}`}
                    className="text-primary hover:text-primary/80 p-2 -m-1 rounded-lg hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title={emp.email}
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          Hittade inga medarbetare. Testa ett annat sökord.
        </p>
      )}
    </div>
  );
}
