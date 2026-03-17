import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useModulePermission } from "@/hooks/useModulePermission";

import OrderTypesManager from "@/components/OrderTypesManager";
import CategoriesManager from "@/components/CategoriesManager";
import SystemsManager from "@/components/SystemsManager";

import KbAdminPanel from "@/components/kb/KbAdminPanel";
import AdminDashboard from "@/components/admin/AdminDashboard";
import GroupsManager from "@/components/admin/GroupsManager";
import ModulePermissionsManager from "@/components/admin/ModulePermissionsManager";
import UsersContent from "@/components/admin/UsersContent";
import SettingsContent from "@/components/admin/SettingsContent";
import ITContent from "@/components/admin/ITContent";
import ToolsManager from "@/components/admin/ToolsManager";
import {
  Shield, Users, ChevronLeft,
  Settings, Monitor,
  Wrench, BookOpen, ShoppingCart, Cog, Activity, FolderOpen, Package, Link2,
} from "lucide-react";

type AdminSection = "menu" | "categories" | "equipment" | "systems" | "users" | "settings" | "it" | "knowledge" | "groups" | "permissions" | "tools";

interface AdminGroup {
  label: string;
  icon: React.ElementType;
  color: string;
  items: AdminItem[];
}

interface AdminItem {
  id: AdminSection;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  roles?: string[];
}

const adminGroups: AdminGroup[] = [
  {
    label: "Beställningar",
    icon: ShoppingCart,
    color: "text-accent",
    items: [
      { id: "categories", label: "Kategorier", description: "Skapa och hantera beställningskategorier", icon: FolderOpen, color: "from-primary to-primary-glow", borderColor: "border-t-primary/40", bgColor: "bg-primary/10", textColor: "text-primary" },
      { id: "equipment", label: "Utrustning", description: "Hantera beställningsbar utrustning", icon: Package, color: "from-accent to-accent", borderColor: "border-t-accent/40", bgColor: "bg-accent/10", textColor: "text-accent" },
      { id: "systems", label: "System & Licenser", description: "Hantera system för on-/offboarding", icon: Monitor, color: "from-accent to-accent", borderColor: "border-t-accent/40", bgColor: "bg-accent/10", textColor: "text-accent" },
    ],
  },
  {
    label: "Innehåll",
    icon: BookOpen,
    color: "text-primary",
    items: [
      { id: "knowledge", label: "Kunskapsbanken", description: "Artiklar, videor och kategorier", icon: BookOpen, color: "from-primary to-primary-glow", borderColor: "border-t-primary/40", bgColor: "bg-primary/10", textColor: "text-primary" },
      { id: "tools", label: "Verktyg", description: "Hantera snabblänkar på verktygssidan", icon: Link2, color: "from-accent to-accent", borderColor: "border-t-accent/40", bgColor: "bg-accent/10", textColor: "text-accent" },
    ],
  },
  {
    label: "Organisation",
    icon: Users,
    color: "text-warning",
    items: [
      { id: "users", label: "Användare & Roller", description: "Tilldela roller till användare", icon: Users, color: "from-warning to-warning", borderColor: "border-t-warning/40", bgColor: "bg-warning/10", textColor: "text-warning" },
      { id: "groups", label: "Grupper", description: "Skapa och hantera grupper", icon: Users, color: "from-primary to-primary-glow", borderColor: "border-t-primary/40", bgColor: "bg-primary/10", textColor: "text-primary" },
    ],
  },
  {
    label: "Systeminställningar",
    icon: Cog,
    color: "text-muted-foreground",
    items: [
      { id: "permissions", label: "Modulrättigheter", description: "Hantera moduler, åtkomst och rättigheter", icon: Shield, color: "from-accent to-accent", borderColor: "border-t-accent/40", bgColor: "bg-accent/10", textColor: "text-accent" },
      { id: "settings", label: "Inställningar", description: "Attestering och andra inställningar", icon: Settings, color: "from-muted-foreground to-muted-foreground", borderColor: "border-t-muted-foreground/30", bgColor: "bg-muted-foreground/10", textColor: "text-muted-foreground" },
      { id: "it", label: "IT", description: "Navigationslänkar och utseende", icon: Wrench, color: "from-primary to-primary-glow", borderColor: "border-t-primary/40", bgColor: "bg-primary/10", textColor: "text-primary", roles: ["it", "admin"] },
    ],
  },
];

export default function Admin() {
  const { roles } = useAuth();
  const { canView: canViewAdmin } = useModulePermission("admin");
  const [activeSection, setActiveSection] = useState<AdminSection>("menu");

  // Responsive: detect compact mode
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setCompact(mql.matches);
    mql.addEventListener("change", onChange);
    setCompact(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (!canViewAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground mt-4">Du har inte behörighet att se denna sida</p>
      </div>
    );
  }

  const visibleGroups = adminGroups
    .map(g => ({ ...g, items: g.items }))
    .filter(g => g.items.length > 0);
    .filter(g => g.items.length > 0);

  const renderSection = (sectionId: AdminSection) => {
    switch (sectionId) {
      case "categories": return <CategoriesManager />;
      case "equipment": return <OrderTypesManager />;
      case "systems": return <SystemsManager />;
      case "users": return <UsersContent />;
      case "settings": return <SettingsContent />;
      case "it": return <ITContent />;
      case "knowledge": return <KbAdminPanel onDataChange={() => {}} />;
      case "groups": return <GroupsManager />;
      case "permissions": return <ModulePermissionsManager />;
      case "tools": return <ToolsManager />;
      default: return null;
    }
  };




  if (compact) {
    return (
      <div className="space-y-5">
        {activeSection === "menu" ? (
          <>
            <div>
              <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Administration</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Centralt administrationsgränssnitt</p>
            </div>
            <div className="hidden lg:block">
              <AdminDashboard onNavigate={(s) => setActiveSection(s as AdminSection)} />
            </div>
            <div className="space-y-6 md:mt-6">
              {visibleGroups.map((group) => (
                <div key={group.label} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <group.icon className={`h-4 w-4 ${group.color}`} />
                    <h2 className={`text-xs font-semibold uppercase tracking-wider ${group.color}`}>{group.label}</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.items.map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className="glass-card rounded-2xl p-4 flex items-center gap-4 text-left active:scale-[0.98] transition-transform animate-fade-up"
                        style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
                      >
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-lg`}>
                          <s.icon className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-heading font-semibold text-sm text-foreground">{s.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveSection("menu")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -mb-2 min-h-[44px] active:scale-[0.95]"
            >
              <ChevronLeft className="h-4 w-4" />
              Tillbaka
            </button>
            {renderSection(activeSection)}
          </>
        )}
      </div>
    );
  }

  // Desktop: sidebar + content
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Administration</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Centralt administrationsgränssnitt för hela systemet</p>
      </div>

      <div className="flex gap-6 items-start min-h-[600px]">
        {/* Content area */}
        <div className="flex-1 min-w-0 overflow-visible">
          {activeSection === "menu" ? (
            <AdminDashboard onNavigate={(s) => setActiveSection(s as AdminSection)} />
          ) : (
            renderSection(activeSection)
          )}
        </div>

        {/* Sidebar navigation – sticky so it stays visible when content scrolls */}
        <nav className="w-56 shrink-0 space-y-5 sticky top-8 self-start max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-hide">
          <button
            onClick={() => setActiveSection("menu")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left ${
              activeSection === "menu"
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Activity className="h-4 w-4 shrink-0" />
            Dashboard
          </button>
          {visibleGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-1.5 select-none pointer-events-none rounded-lg bg-secondary/60 mb-1">
                <group.icon className="h-3.5 w-3.5 text-warning" />
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-warning">{group.label}</span>
              </div>
              {group.items.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left ${
                      isActive
                        ? `${item.bgColor} ${item.textColor} shadow-sm`
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
