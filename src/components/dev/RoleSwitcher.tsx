import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TEST_ROLES: { key: string; label: string }[] = [
  { key: "employee", label: "Employee" },
  { key: "manager", label: "Manager" },
  { key: "staff", label: "Staff" },
  { key: "it", label: "IT" },
  { key: "admin", label: "Admin" },
];

/**
 * Dev-only floating widget to override the current user's roles for testing.
 * Visible only when the *real* user is admin or IT (so you can't lock yourself out).
 * Override is stored in localStorage and only affects the frontend
 * (`useAuth().roles` and downstream visibility checks).
 */
export default function RoleSwitcher() {
  const { realRoles, roleOverride, setRoleOverride } = useAuth();
  const [open, setOpen] = useState(false);

  const isPrivileged = realRoles.includes("admin") || realRoles.includes("it");
  const forceShow = typeof window !== "undefined" && window.location.search.includes("devRoles=1");
  if (!isPrivileged && !forceShow) return null;

  const active = roleOverride ?? realRoles;

  const toggleRole = (role: string) => {
    const current = roleOverride ?? [...realRoles];
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    setRoleOverride(next);
  };

  const setSingle = (role: string) => setRoleOverride([role]);
  const reset = () => setRoleOverride(null);

  return (
    <div className="fixed bottom-20 right-4 z-[60] md:bottom-4 md:right-24">
      <Card className={cn(
        "shadow-lg border-warning/40 backdrop-blur-md bg-background/95",
        "transition-all"
      )}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium"
        >
          <FlaskConical className="h-3.5 w-3.5 text-warning" />
          <span>Roller (test)</span>
          {roleOverride && (
            <Badge variant="outline" className="text-[10px] border-warning text-warning">
              OVERRIDE
            </Badge>
          )}
          {open ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronUp className="h-3 w-3 ml-auto" />}
        </button>

        {open && (
          <div className="px-3 pb-3 space-y-2 w-64">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Aktiva: {active.length ? active.join(", ") : "(inga)"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Riktiga: {realRoles.length ? realRoles.join(", ") : "(inga)"}
            </div>

            <div className="space-y-1 pt-1">
              <div className="text-[10px] font-semibold text-muted-foreground">Sätt enskild roll</div>
              <div className="grid grid-cols-2 gap-1">
                {TEST_ROLES.map((r) => {
                  const isOnly = active.length === 1 && active[0] === r.key;
                  return (
                    <Button
                      key={r.key}
                      size="sm"
                      variant={isOnly ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setSingle(r.key)}
                    >
                      {r.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="text-[10px] font-semibold text-muted-foreground">Toggle (kombinera)</div>
              <div className="flex flex-wrap gap-1">
                {TEST_ROLES.map((r) => {
                  const on = active.includes(r.key);
                  return (
                    <Badge
                      key={r.key}
                      variant={on ? "default" : "outline"}
                      className="cursor-pointer text-[10px]"
                      onClick={() => toggleRole(r.key)}
                    >
                      {r.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs gap-1 text-muted-foreground"
              onClick={reset}
              disabled={!roleOverride}
            >
              <X className="h-3 w-3" /> Återställ till riktiga roller
            </Button>

            <p className="text-[10px] text-muted-foreground leading-snug pt-1 border-t">
              Endast frontend. RLS i databasen använder fortfarande dina riktiga roller — vissa data kan saknas.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
