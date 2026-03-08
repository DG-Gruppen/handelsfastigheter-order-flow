import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Monitor, Plus, ClipboardList, CheckSquare, LogOut, Settings, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/dashboard", label: "Beställningar", shortLabel: "Hem", icon: ClipboardList },
  { to: "/orders/new", label: "Ny beställning", shortLabel: "Beställ", icon: Plus },
  { to: "/approvals", label: "Att attestera", shortLabel: "Attestera", icon: CheckSquare, roles: ["manager", "admin"] as string[] },
  
  { to: "/admin", label: "Admin", shortLabel: "Admin", icon: Settings, roles: ["admin"] as string[] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, signOut } = useAuth();
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  // Load saved theme on login
  useEffect(() => {
    if (profile?.theme_preference) {
      setTheme(profile.theme_preference);
    }
  }, [profile?.theme_preference, setTheme]);

  // Save theme when toggled
  const handleToggleTheme = useCallback(async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (profile?.user_id) {
      await supabase
        .from("profiles")
        .update({ theme_preference: newTheme })
        .eq("user_id", profile.user_id);
    }
  }, [theme, setTheme, profile?.user_id]);

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r))
  );

  return (
    <div className="min-h-screen gradient-bg pb-20 md:pb-0">
      {/* Top header */}
      <header className="sticky top-0 z-50 border-b glass-nav">
        <div className="mx-auto flex h-14 md:h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-xl gradient-primary shadow-md shadow-primary/20">
              <Monitor className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
            </div>
            <span className="font-heading text-base md:text-lg font-bold text-foreground">
              IT-Beställning
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={`gap-2 transition-all ${isActive ? "bg-secondary/80 shadow-sm" : "hover:bg-secondary/50"}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-1 hover:bg-secondary/60 transition-colors min-h-[44px] min-w-[44px] justify-center">
                <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                  <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium text-foreground pr-1">
                  {profile?.full_name || "Användare"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass-surface">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground">{profile?.full_name || "Användare"}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleToggleTheme}
                className="gap-2 min-h-[44px]"
              >
                <Sun className="h-4 w-4 dark:hidden" />
                <Moon className="h-4 w-4 hidden dark:block" />
                {theme === "dark" ? "Ljust tema" : "Mörkt tema"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut} className="text-destructive gap-2 min-h-[44px]">
                <LogOut className="h-4 w-4" />
                Logga ut
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className={`mx-auto px-4 py-5 md:py-8 ${location.pathname === "/org" ? "" : "max-w-6xl"}`}>{children}</main>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t glass-nav safe-bottom">
        <div className="flex items-stretch justify-around">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-all ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                }`}
              >
                <div className={`flex items-center justify-center rounded-xl px-3 py-1 transition-all ${isActive ? "bg-primary/10" : ""}`}>
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                </div>
                <span className="text-[10px] font-medium leading-tight">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
