import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Pencil, Trash2, Crown, Search, RefreshCw, Users, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { supabase } from "@/integrations/supabase/client";
import { resolveModuleAccess } from "@/lib/moduleAccess";

interface GroupInfo { id: string; name: string; color: string | null }

export default function MyEffectivePermissions() {
  const { user, roles, profile } = useAuth();
  const { modules, allAccess, allPermissions, userGroupIds, loading, refresh } = useModules();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [filter, setFilter] = useState("");

  const isAdmin = roles.includes("admin");
  const isExternal = profile?.is_external === true;

  useEffect(() => {
    if (userGroupIds.length === 0) { setGroups([]); return; }
    supabase.from("groups").select("id, name, color").in("id", userGroupIds)
      .then(({ data }) => setGroups((data as GroupInfo[]) ?? []));
  }, [userGroupIds.join(",")]);

  const rows = useMemo(() => {
    if (!user) return [];
    return modules
      .filter(m => m.is_active)
      .map(m => {
        const access = resolveModuleAccess({
          allAccess, isAdmin, isExternal, moduleId: m.id,
          permissions: allPermissions, roles, userGroupIds, userId: user.id,
        });
        return { module: m, access };
      })
      .filter(r => !filter || r.module.name.toLowerCase().includes(filter.toLowerCase()) || r.module.slug.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => a.module.name.localeCompare(b.module.name, "sv"));
  }, [modules, allAccess, allPermissions, userGroupIds, roles, isAdmin, isExternal, user?.id, filter]);

  const viewCount = rows.filter(r => r.access.canView).length;

  return (
    <Card className="glass-card">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Mina behörigheter
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Översikt per modul. Använd för att felsöka åtkomst.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} className="gap-2 h-9">
            <RefreshCw className="h-3.5 w-3.5" /> Uppdatera
          </Button>
        </div>

        {/* Roles + groups */}
        <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Crown className="h-3 w-3" /> Roller
            </p>
            <div className="flex flex-wrap gap-1.5">
              {roles.length > 0
                ? roles.map(r => <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>)
                : <span className="text-xs text-muted-foreground italic">Inga roller</span>}
              {isExternal && <Badge variant="outline" className="text-xs">Extern</Badge>}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Grupper ({groups.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {groups.length > 0
                ? groups.map(g => (
                  <Badge key={g.id} variant="outline" className="text-xs"
                    style={g.color ? { borderColor: g.color, color: g.color } : undefined}>
                    {g.name}
                  </Badge>
                ))
                : <span className="text-xs text-muted-foreground italic">Inga grupper</span>}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök modul..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {loading ? "Laddar..." : `${viewCount} av ${rows.length} moduler synliga`}
        </p>

        {/* Module list */}
        <div className="space-y-1.5">
          {rows.map(({ module: m, access }) => {
            const reason = !access.canView
              ? (isExternal ? "Extern användare" : "Saknar grupp/roll-behörighet")
              : access.hasExplicitViewAccess
                ? "Direkt behörighet (grupp/användare)"
                : access.hasRoleAccess
                  ? "Via roll"
                  : "Öppen modul";
            return (
              <div key={m.id}
                className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 ${
                  access.canView ? "border-border/50 bg-secondary/10" : "border-destructive/20 bg-destructive/5 opacity-70"
                }`}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{m.slug} · {reason}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <PermBadge active={access.canView} icon={<Eye className="h-3 w-3" />} label="Visa" />
                  <PermBadge active={access.canEdit} icon={<Pencil className="h-3 w-3" />} label="Redigera" />
                  <PermBadge active={access.canDelete} icon={<Trash2 className="h-3 w-3" />} label="Radera" />
                  <PermBadge active={access.isOwner} icon={<Crown className="h-3 w-3" />} label="Ägare" />
                </div>
              </div>
            );
          })}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Inga moduler matchar.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PermBadge({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span title={label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-[10px] ${
        active
          ? "border-accent/30 bg-accent/15 text-accent"
          : "border-border/40 bg-muted/30 text-muted-foreground/40"
      }`}>
      {icon}
    </span>
  );
}
