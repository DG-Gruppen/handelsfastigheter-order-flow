import { useState, useMemo, useEffect } from "react";
import { Search, Phone, Mail, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PersonnelProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  phone: string | null;
  title_override: string | null;
}

const FALLBACK_GRADIENT = "from-primary/60 to-accent/60";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Personnel() {
  const [profiles, setProfiles] = useState<PersonnelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Alla");

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);

      // Get user_ids with IT role to exclude them
      const { data: itRoles } = await supabase
        .rpc("get_all_user_roles") as { data: { user_id: string; role: string }[] | null };

      const itUserIds = new Set(
        (itRoles ?? []).filter((r) => r.role === "it").map((r) => r.user_id)
      );

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, department, phone, title_override")
        .order("full_name");

      const filtered = (allProfiles ?? []).filter(
        (p) => !itUserIds.has(p.user_id) && p.full_name.trim() !== ""
      );

      setProfiles(filtered);
      setLoading(false);
    };

    fetchProfiles();
  }, []);

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
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {/* Department filter */}
      <div className="flex flex-wrap gap-2">
        {allDepts.map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
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
              {/* Avatar header */}
              <div
                className={`h-16 bg-gradient-to-br ${
                  DEPT_COLORS[emp.department ?? ""] || "from-muted to-muted-foreground/20"
                } relative`}
              >
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
                <div className="flex items-center gap-3 mt-3">
                  {emp.phone && emp.phone !== "–" && emp.phone.trim() !== "" && (
                    <a
                      href={`tel:${emp.phone.replace(/[- ]/g, "")}`}
                      className="text-primary hover:text-primary/80"
                      title={emp.phone}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <a
                    href={`mailto:${emp.email}`}
                    className="text-primary hover:text-primary/80"
                    title={emp.email}
                  >
                    <Mail className="w-3.5 h-3.5" />
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
