import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, ClipboardList, LogOut, Settings, Sun, Moon, Building2, History, ExternalLink, UserPlus, Headphones, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import shfLogo from "@/assets/shf-logo.png";
import { useTheme } from "next-themes";
import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavSettings } from "@/hooks/useNavSettings";
import { cn } from "@/lib/utils";

// Keys that go into the "More" sheet on mobile
const mobileOverflowKeys = ["nav_org", "nav_admin"];

const navItems = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "Hem", icon: ClipboardList, settingKey: "nav_dashboard" },
  { to: "/orders/new", label: "Ny beställning", shortLabel: "Beställ", icon: Plus, settingKey: "nav_new_order" },
  { to: "/onboarding", label: "On-/Offboarding", shortLabel: "On/Off", icon: UserPlus, roles: ["manager", "admin"] as string[], settingKey: "nav_onboarding" },
  
  { to: "/history", label: "Historik", shortLabel: "Historik", icon: History, settingKey: "nav_history" },
  { to: "/it-info", label: "IT-support", shortLabel: "IT", icon: Headphones, settingKey: "nav_it_info" },
  { to: "/org", label: "Organisation", shortLabel: "Org", icon: Building2, roles: ["admin"] as string[], settingKey: "nav_org" },
  { to: "/admin", label: "Admin", shortLabel: "Admin", icon: Settings, roles: ["admin"] as string[], settingKey: "nav_admin" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  const themeLoaded = useRef(false);
  const { navSettings, settings } = useNavSettings();

  useEffect(() => {
    if (!themeLoaded.current) {
      const savedTheme = profile?.theme_preference;
      const defaultTheme = settings["it_default_theme"] || "light";
      if (savedTheme) {
        themeLoaded.current = true;
        setTheme(savedTheme);
      } else if (Object.keys(settings).length > 0) {
        themeLoaded.current = true;
        setTheme(defaultTheme);
      }
    }
  }, [profile?.theme_preference, settings, setTheme]);

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
    (item) =>
      (!item.roles || item.roles.some((r) => roles.includes(r))) &&
      navSettings[item.settingKey] !== "false"
  );

  const mobileBarItems = visibleNavItems.filter(
    (item) => !mobileOverflowKeys.includes(item.settingKey)
  );
  const mobileOverflowItems = visibleNavItems.filter(
    (item) => mobileOverflowKeys.includes(item.settingKey)
  );

  const isOverflowActive = mobileOverflowItems.some(
    (item) => location.pathname === item.to
  );

  const handleNavigation = (path: string) => {
    navigate(path);
    setMoreOpen(false);
  };

  // Close sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen gradient-bg pb-20 md:pb-0">
      {/* Top header */}
      <header className="sticky top-0 z-50 border-b glass-nav">
        <div className="mx-auto flex h-14 md:h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img
              src={shfLogo}
              alt="Svenska Handelsfastigheter"
              className="h-10 md:h-14 w-auto dark:invert"
            />
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
                    className={`gap-2 transition-all ${isActive ? "bg-secondary/80 shadow-sm" : "hover:bg-secondary/60 hover:text-foreground"}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* User menu (desktop) */}
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
              <DropdownMenuItem onClick={handleToggleTheme} className="gap-2 min-h-[44px]">
                <Sun className="h-4 w-4 dark:hidden" />
                <Moon className="h-4 w-4 hidden dark:block" />
                {theme === "dark" ? "Ljust tema" : "Mörkt tema"}
              </DropdownMenuItem>
              {settings["it_remote_help_visible"] !== "false" && (
                <DropdownMenuItem asChild className="gap-2 min-h-[44px]">
                  <a
                    href={settings["it_remote_help_url"] || "https://my.splashtop.eu/sos/packages/download/37PXZW4LPWXTEU"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {settings["it_remote_help_label"] || "Fjärrhjälp (Splashtop)"}
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t glass-nav">
        <div className="mx-auto flex items-center justify-evenly h-16 px-2 pb-[env(safe-area-inset-bottom,0px)] max-w-lg">
          {mobileBarItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <button
                key={item.to}
                onClick={() => handleNavigation(item.to)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 min-h-[48px] min-w-[48px] gap-1 transition-colors active:scale-[0.92]",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <motion.span
                  className="relative"
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <item.icon className={cn("h-5 w-5", active && "text-primary")} />
                </motion.span>
                <span className="text-[10px] font-medium">{item.shortLabel}</span>
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
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 min-h-[48px] min-w-[48px] gap-1 transition-colors active:scale-[0.92]",
                  moreOpen || isOverflowActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <motion.span
                  className="relative"
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Menu className={cn("h-5 w-5", isOverflowActive && "text-primary")} />
                </motion.span>
                <span className="text-[10px] font-medium">Meny</span>
                <AnimatePresence>
                  {isOverflowActive && (
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
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-2xl flex flex-col">
              <SheetHeader className="pb-3 flex-shrink-0">
                <SheetTitle className="text-center text-base">Meny</SheetTitle>
              </SheetHeader>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-6 pb-8 px-2">
                  {/* Profile card */}
                  <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/50">
                    <Avatar className="h-10 w-10 ring-2 ring-primary/10">
                      <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || "Användare"}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                    </div>
                  </div>

                  {/* Overflow nav items as grid */}
                  {mobileOverflowItems.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
                        Sidor
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        {mobileOverflowItems.map((item) => {
                          const active = location.pathname === item.to;
                          return (
                            <button
                              key={item.to}
                              onClick={() => handleNavigation(item.to)}
                              className={cn(
                                "flex flex-col items-center justify-center gap-2 p-3 rounded-lg transition-colors active:scale-[0.92] min-h-[44px]",
                                active
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              <item.icon className="h-5 w-5" />
                              <span className="text-[10px] font-medium text-center leading-tight">
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Settings grid */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
                      Inställningar
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => {
                          handleToggleTheme();
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

                      {settings["it_remote_help_visible"] !== "false" && (
                        <a
                          href={settings["it_remote_help_url"] || "https://my.splashtop.eu/sos/packages/download/37PXZW4LPWXTEU"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-[0.92] min-h-[44px]"
                        >
                          <ExternalLink className="h-5 w-5" />
                          <span className="text-[10px] font-medium text-center leading-tight">
                            Fjärrhjälp
                          </span>
                        </a>
                      )}

                      <button
                        onClick={() => {
                          setMoreOpen(false);
                          signOut();
                        }}
                        className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-muted/50 text-destructive hover:bg-destructive/10 transition-colors active:scale-[0.92] min-h-[44px]"
                      >
                        <LogOut className="h-5 w-5" />
                        <span className="text-[10px] font-medium text-center leading-tight">
                          Logga ut
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
