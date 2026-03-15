import { Link, useLocation } from "react-router-dom";
import { useModules } from "@/hooks/useModules";
import { useAuth } from "@/hooks/useAuth";
import { getModuleIcon } from "@/lib/moduleIcons";
import { LogOut, Sun, Moon, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavSettings } from "@/hooks/useNavSettings";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import shfLogo from "@/assets/shf-logo.png";
import NotificationBell from "@/components/NotificationBell";

export default function AppSidebar() {
  const { accessibleModules } = useModules();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { settings } = useNavSettings();
  const [collapsed, setCollapsed] = useState(false);

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const handleToggleTheme = useCallback(async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (profile?.user_id) {
      await supabase.from("profiles").update({ theme_preference: newTheme }).eq("user_id", profile.user_id);
    }
  }, [theme, setTheme, profile?.user_id]);

  // Group modules semantically by slug
  const GROUP_CONFIG: { label: string; slugs: string[] }[] = [
    { label: "", slugs: ["home"] }, // No label, just dashboard
    { label: "Beställningar", slugs: ["new-order", "onboarding", "history"] },
    { label: "Organisation", slugs: ["org", "personnel", "culture", "pulse"] },
    { label: "Information", slugs: ["news", "strategy", "knowledge", "documents"] },
    { label: "Fastigheter", slugs: ["properties"] },
    { label: "IT & Verktyg", slugs: ["it-support", "it-portal", "tools"] },
    { label: "Personligt", slugs: ["my-shf"] },
    { label: "System", slugs: ["admin"] },
  ];

  const groups = GROUP_CONFIG.map((g) => ({
    ...g,
    modules: g.slugs
      .map((slug) => accessibleModules.find((m) => m.slug === slug))
      .filter(Boolean) as typeof accessibleModules,
  })).filter((g) => g.modules.length > 0);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen bg-sidebar sticky top-0 transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-4 pb-2">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <img
            src={shfLogo}
            alt="SHF"
            className={cn("h-10 w-auto dark:invert shrink-0", collapsed && "h-8")}
          />
          {!collapsed && (
            <span className="font-heading text-sm font-semibold text-sidebar-foreground leading-tight truncate">
              SHF Connect
            </span>
          )}
        </Link>
      </div>

      <div className="h-px bg-sidebar-border mx-3 mb-1" />

      {/* Main nav */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto py-1">
        {mainModules.length > 0 && (
          <>
            {!collapsed && (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/40 px-3 py-2 block">
                Arbetsyta
              </span>
            )}
            {mainModules.map((mod) => {
              const Icon = getModuleIcon(mod.icon);
              const isActive = location.pathname === mod.route;
              return (
                <Link
                  key={mod.id}
                  to={mod.route}
                  title={collapsed ? mod.name : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{mod.name}</span>}
                </Link>
              );
            })}
          </>
        )}

        {extraModules.length > 0 && (
          <>
            <div className="h-px bg-sidebar-border mx-1 my-2" />
            {!collapsed && (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/40 px-3 py-2 block">
                Moduler
              </span>
            )}
            {extraModules.map((mod) => {
              const Icon = getModuleIcon(mod.icon);
              const isActive = location.pathname === mod.route;
              return (
                <Link
                  key={mod.id}
                  to={mod.route}
                  title={collapsed ? mod.name : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{mod.name}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="h-px bg-sidebar-border mx-3 my-1" />

      {/* Bottom actions */}
      <div className="px-2 py-2 space-y-0.5">
        <button
          onClick={handleToggleTheme}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors w-full",
            collapsed && "justify-center px-2"
          )}
        >
          <Sun className="w-[18px] h-[18px] dark:hidden" />
          <Moon className="w-[18px] h-[18px] hidden dark:block" />
          {!collapsed && <span>{theme === "dark" ? "Ljust tema" : "Mörkt tema"}</span>}
        </button>

        {settings["it_remote_help_visible"] !== "false" && (
          <a
            href={settings["it_remote_help_url"] || "https://my.splashtop.eu/sos/packages/download/37PXZW4LPWXTEU"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors w-full",
              collapsed && "justify-center px-2"
            )}
          >
            <ExternalLink className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>{settings["it_remote_help_label"] || "Fjärrhjälp"}</span>}
          </a>
        )}
      </div>

      <div className="h-px bg-sidebar-border mx-3" />

      {/* User + collapse */}
      <div className="p-3 flex items-center gap-2">
        <Avatar className="h-8 w-8 ring-2 ring-sidebar-primary/20 shrink-0">
          <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "Användare"}</div>
            <div className="text-[11px] text-sidebar-foreground/50 truncate">{profile?.email}</div>
          </div>
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          {!collapsed && <NotificationBell />}
          <button
            onClick={signOut}
            title="Logga ut"
            className="text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-colors p-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors shadow-sm"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
