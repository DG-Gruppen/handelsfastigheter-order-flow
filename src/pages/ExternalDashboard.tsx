import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { Card, CardContent } from "@/components/ui/card";
import { getModuleIcon } from "@/lib/moduleIcons";
import { Building2 } from "lucide-react";

export default function ExternalDashboard() {
  const { profile } = useAuth();
  const { accessibleModules, loading } = useModules();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent/80 shadow-lg shadow-accent/20">
          <Building2 className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Välkommen{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Här hittar du de moduler du har tillgång till
        </p>
      </div>

      {/* Module cards */}
      {accessibleModules.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Du har inte tillgång till några moduler ännu. Kontakta din kontaktperson hos SHF.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accessibleModules
            .filter((m) => m.slug !== "home")
            .map((mod) => {
              const Icon = getModuleIcon(mod.icon);
              return (
                <Link key={mod.id} to={mod.route}>
                  <Card className="group hover:shadow-md transition-all duration-200 hover:border-accent/40 cursor-pointer">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{mod.name}</p>
                        {mod.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{mod.description}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
