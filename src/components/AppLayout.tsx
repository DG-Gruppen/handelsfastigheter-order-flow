import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Monitor, Plus, ClipboardList, CheckSquare, LogOut, Settings } from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Mina beställningar", icon: ClipboardList },
  { to: "/orders/new", label: "Ny beställning", icon: Plus },
  { to: "/approvals", label: "Att attestera", icon: CheckSquare, roles: ["manager", "admin"] },
  { to: "/admin", label: "Admin", icon: Settings, roles: ["admin"] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, signOut } = useAuth();
  const location = useLocation();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Monitor className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="font-heading text-lg font-bold text-foreground">IT-Beställning</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems
              .filter((item) => !item.roles || item.roles.some((r) => roles.includes(r)))
              .map((item) => (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={location.pathname === item.to ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium text-foreground">
                  {profile?.full_name || "Användare"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="md:hidden" asChild>
                {navItems
                  .filter((item) => !item.roles || item.roles.some((r) => roles.includes(r)))
                  .map((item) => (
                    <Link key={item.to} to={item.to} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut} className="text-destructive gap-2">
                <LogOut className="h-4 w-4" />
                Logga ut
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
