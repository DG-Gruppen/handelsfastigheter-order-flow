import { Link, useLocation } from "react-router-dom";
import { useModules } from "@/hooks/useModules";
import { useAuth } from "@/hooks/useAuth";
import { getModuleIcon } from "@/lib/moduleIcons";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import shfLogo from "@/assets/shf-logo.png";
import NotificationBell from "@/components/NotificationBell";
import ProfilePanel from "@/components/ProfilePanel";

export default function AppSidebar() {
  const { accessibleModules } = useModules();
  const { profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

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

      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto py-1">
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="h-px bg-sidebar-border mx-1 my-2" />}
            {!collapsed && group.label && (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/40 px-3 py-2 block">
                {group.label}
              </span>
            )}
            {group.modules.map((mod) => {
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
          </div>
        ))}
      </nav>

      <div className="h-px bg-sidebar-border mx-3" />

      {/* User profile with popover */}
      <div className="p-3 flex items-center gap-2">
        <Popover open={profileOpen} onOpenChange={setProfileOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 flex-1 min-w-0 rounded-md p-1 -m-1 hover:bg-sidebar-accent/50 transition-colors">
              <Avatar className="h-8 w-8 ring-2 ring-sidebar-primary/20 shrink-0">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "Användare"}</div>
                  <div className="text-[11px] text-sidebar-foreground/50 truncate">{profile?.email}</div>
                </div>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-72 p-4">
            <ProfilePanel onClose={() => setProfileOpen(false)} />
          </PopoverContent>
        </Popover>
        {!collapsed && (
          <div className="flex items-center gap-0.5 shrink-0">
            <NotificationBell />
          </div>
        )}
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
