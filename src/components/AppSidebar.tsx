import { Link, useLocation, useNavigate } from "react-router-dom";
import { useModules } from "@/hooks/useModules";
import { useAuth } from "@/hooks/useAuth";
import { getModuleIcon } from "@/lib/moduleIcons";
import { ChevronLeft, ChevronRight, ChevronDown, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Sun, Moon, LogOut, User, Shield } from "lucide-react";
import shfLogo from "@/assets/shf-logo.png";
import NotificationBell from "@/components/NotificationBell";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

const GROUP_CONFIG: { label: string; slugs: string[] }[] = [
  { label: "Information", slugs: ["home", "news", "strategy", "knowledge", "documents"] },
  { label: "Beställningar", slugs: ["new-order", "onboarding", "history"] },
  { label: "Organisation", slugs: ["org", "personnel", "culture", "pulse"] },
  { label: "Fastigheter", slugs: ["properties"] },
  { label: "IT & Verktyg", slugs: ["it-support", "it-portal", "tools"] },
  { label: "Personligt", slugs: ["my-shf"] },
  // "admin" removed – accessed via profile menu
];

// Override display names for specific slugs
const SLUG_NAME_OVERRIDES: Record<string, string> = {
  home: "Min dashboard",
};

export default function AppSidebar() {
  const { accessibleModules } = useModules();
  const { profile, roles, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  // Collapsible groups state – persisted in localStorage
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("shf-sidebar-collapsed");
    return saved ? JSON.parse(saved) : {};
  });

  // Group order state – persisted in localStorage
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("shf-sidebar-order");
    if (saved) return JSON.parse(saved);
    return GROUP_CONFIG.map((g) => g.label || "__home__");
  });

  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("shf-sidebar-collapsed", JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  useEffect(() => {
    localStorage.setItem("shf-sidebar-order", JSON.stringify(groupOrder));
  }, [groupOrder]);

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, label: string) => {
    setDraggedGroup(label);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, target: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedGroup && draggedGroup !== target) setDragOverGroup(target);
  };
  const handleDragLeave = () => setDragOverGroup(null);
  const handleDrop = (e: React.DragEvent, target: string) => {
    e.preventDefault();
    setDragOverGroup(null);
    if (!draggedGroup || draggedGroup === target) { setDraggedGroup(null); return; }
    setGroupOrder((prev) => {
      const n = [...prev];
      const from = n.indexOf(draggedGroup);
      const to = n.indexOf(target);
      n.splice(from, 1);
      n.splice(to, 0, draggedGroup);
      return n;
    });
    setDraggedGroup(null);
  };
  const handleDragEnd = () => { setDraggedGroup(null); setDragOverGroup(null); };

  // Build groups from modules
  const groups = GROUP_CONFIG.map((g) => ({
    key: g.label || "__home__",
    label: g.label,
    modules: g.slugs
      .map((slug) => accessibleModules.find((m) => m.slug === slug))
      .filter(Boolean) as typeof accessibleModules,
  })).filter((g) => g.modules.length > 0);

  // Sync new groups into order
  useEffect(() => {
    const keys = groups.map((g) => g.key);
    const hasNew = keys.some((k) => !groupOrder.includes(k));
    if (hasNew) {
      const merged = [
        ...groupOrder.filter((k) => keys.includes(k)),
        ...keys.filter((k) => !groupOrder.includes(k)),
      ];
      setGroupOrder(merged);
    }
  }, [groups.length]);

  const sortedGroups = [...groups].sort((a, b) => {
    const ai = groupOrder.indexOf(a.key);
    const bi = groupOrder.indexOf(b.key);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // Close "Mer" sheet on route change
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  // Mobile: "Information" group in bottom nav, rest in Meny modal
  const infoSlugs = GROUP_CONFIG.find((g) => g.label === "Information")?.slugs || [];
  const mobileBarModules = infoSlugs
    .map((slug) => accessibleModules.find((m) => m.slug === slug))
    .filter(Boolean) as typeof accessibleModules;
  const mobileOverflowModules = accessibleModules.filter(
    (m) => !infoSlugs.includes(m.slug)
  );
  const isOverflowActive = mobileOverflowModules.some((m) => location.pathname === m.route);

  const handleMobileNav = (path: string) => {
    navigate(path);
    setMoreOpen(false);
  };

  // Mobile overflow grouped — same categories & order as sidebar, excluding Information
  const mobileOverflowGroups = GROUP_CONFIG
    .filter((g) => g.label !== "Information")
    .map((g) => ({
      label: g.label,
      modules: g.slugs
        .map((slug) => mobileOverflowModules.find((m) => m.slug === slug))
        .filter(Boolean) as typeof accessibleModules,
    }))
    .filter((g) => g.modules.length > 0);

  return (
    <>
      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen bg-sidebar sticky top-0 transition-all duration-200 shrink-0",
          collapsed ? "w-14" : "w-52"
        )}
      >
        {/* Logo */}
        <div className="p-4 pb-2 flex justify-center">
          <Link to="/dashboard">
            <img
              src={shfLogo}
              alt="SHF"
              className={cn("h-18 w-auto invert shrink-0", collapsed && "h-10")}
            />
          </Link>
        </div>

        <div className="h-px bg-sidebar-border mx-3 mb-1" />

        {/* Scrollable nav with hidden scrollbar */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto scrollbar-hide py-1">
          {sortedGroups.map((group, gi) => {
            const isOpen = !collapsedGroups[group.key];

            return (
              <div key={group.key}>
                

                {/* Drag drop indicator */}
                {dragOverGroup === group.key && draggedGroup !== group.key && (
                  <div className="h-0.5 bg-primary mx-2 rounded-full animate-pulse" />
                )}

                <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.key)}>
                  {!collapsed && group.label && (
                    <CollapsibleTrigger asChild>
                      <button
                        draggable
                        onDragStart={(e) => handleDragStart(e, group.key)}
                        onDragOver={(e) => handleDragOver(e, group.key)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, group.key)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/40 hover:bg-sidebar-accent/30 rounded-md transition-all duration-200 cursor-move select-none",
                          draggedGroup === group.key && "opacity-50 cursor-grabbing"
                        )}
                      >
                        <span>{group.label}</span>
                        <ChevronDown
                          onMouseDown={(e) => e.stopPropagation()}
                          className={cn(
                            "h-3 w-3 transition-transform duration-200 cursor-pointer",
                            isOpen && "rotate-180"
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                  )}

                  <CollapsibleContent>
                    {group.modules.map((mod) => {
                      const Icon = getModuleIcon(mod.icon);
                      const isActive = location.pathname === mod.route;
                      const displayName = SLUG_NAME_OVERRIDES[mod.slug] || mod.name;
                      return (
                        <Link
                          key={mod.id}
                          to={mod.route}
                          title={collapsed ? displayName : undefined}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                            collapsed && "justify-center px-2"
                          )}
                        >
                          <Icon className="w-[18px] h-[18px] shrink-0" />
                          {!collapsed && <span className="truncate">{displayName}</span>}
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </nav>

        <div className="h-px bg-sidebar-border mx-3" />

        {/* User profile with popover menu */}
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
            <PopoverContent side="top" align="start" className="w-56 p-2">
              <div className="space-y-1">
                <button
                  onClick={() => { setProfileOpen(false); navigate("/profile"); }}
                  className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <User className="w-4 h-4" />
                  Min profil
                </button>
                {roles.includes("admin") && (
                  <button
                    onClick={() => { setProfileOpen(false); navigate("/admin"); }}
                    className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </button>
                )}
                <Separator className="my-1" />
                <button
                  onClick={() => { setProfileOpen(false); signOut(); }}
                  className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logga ut
                </button>
              </div>
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

      {/* ─── MOBILE TOP HEADER ─── */}
      <header className="sticky top-0 z-50 border-b glass-nav md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center">
            <img src={shfLogo} alt="SHF" className="h-10 w-auto dark:invert" />
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* ─── MOBILE BOTTOM NAV ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t glass-nav pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex items-center justify-evenly h-[4.5rem] px-2 max-w-lg">
          {mobileBarModules.map((mod) => {
            const active = location.pathname === mod.route;
            const Icon = getModuleIcon(mod.icon);
            return (
              <button
                key={mod.id}
                onClick={() => handleMobileNav(mod.route)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 min-h-[48px] min-w-[48px] gap-1 transition-colors active:scale-[0.92]",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <motion.span className="relative" whileTap={{ scale: 0.85 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                </motion.span>
                <span className="text-[10px] font-medium">
                  {(() => { const n = SLUG_NAME_OVERRIDES[mod.slug] || mod.name; return n.length > 8 ? n.substring(0, 7) + "…" : n; })()}
                </span>
                <AnimatePresence>
                  {active && (
                    <motion.div
                      className="h-0.5 w-2 rounded-full bg-primary"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      exit={{ scaleX: 0 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </AnimatePresence>
              </button>
            );
          })}

          {/* More / Menu button */}
          {mobileOverflowModules.length > 0 && (
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 min-h-[48px] min-w-[48px] gap-1 transition-colors active:scale-[0.92]",
                    moreOpen || isOverflowActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <motion.span className="relative" whileTap={{ scale: 0.85 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                    <Menu className={cn("h-5 w-5", isOverflowActive && "text-primary")} />
                  </motion.span>
                  <span className="text-[10px] font-medium">Meny</span>
                  <AnimatePresence>
                    {isOverflowActive && (
                      <motion.div className="h-0.5 w-2 rounded-full bg-primary" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }} transition={{ duration: 0.2 }} />
                    )}
                  </AnimatePresence>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl flex flex-col">
                <SheetHeader className="pb-3 flex-shrink-0">
                  <SheetTitle className="text-center text-base">Meny</SheetTitle>
                </SheetHeader>
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                  <div className="space-y-6 pb-8 px-2">
                    {/* Profile card */}
                    <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/50">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/10">
                        <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || "Användare"}</p>
                        <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                      </div>
                    </div>

                    {/* Grouped overflow nav items */}
                    {mobileOverflowGroups.map((group) => (
                      <div key={group.label || "more"}>
                        {group.label && (
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
                            {group.label}
                          </h3>
                        )}
                        <div className="grid grid-cols-3 gap-3">
                          {group.modules.map((mod) => {
                            const active = location.pathname === mod.route;
                            const Icon = getModuleIcon(mod.icon);
                            return (
                              <button
                                key={mod.id}
                                onClick={() => handleMobileNav(mod.route)}
                                className={cn(
                                  "flex flex-col items-center justify-center gap-2 p-3 rounded-lg transition-colors active:scale-[0.92] min-h-[44px]",
                                  active
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                              >
                                <Icon className="h-5 w-5" />
                                <span className="text-[10px] font-medium text-center leading-tight">{SLUG_NAME_OVERRIDES[mod.slug] || mod.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Settings row */}
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">Inställningar</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          onClick={() => {
                            setTheme(theme === "dark" ? "light" : "dark");
                            setMoreOpen(false);
                          }}
                          className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-[0.92] min-h-[44px]"
                        >
                          <Sun className="h-5 w-5 dark:hidden" />
                          <Moon className="h-5 w-5 hidden dark:block" />
                          <span className="text-[10px] font-medium text-center leading-tight">
                            {theme === "dark" ? "Ljust läge" : "Mörkt läge"}
                          </span>
                        </button>
                        <button
                          onClick={() => { setMoreOpen(false); signOut(); }}
                          className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-muted/50 text-destructive hover:bg-destructive/10 transition-colors active:scale-[0.92] min-h-[44px]"
                        >
                          <LogOut className="h-5 w-5" />
                          <span className="text-[10px] font-medium text-center leading-tight">Logga ut</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </nav>
    </>
  );
}
