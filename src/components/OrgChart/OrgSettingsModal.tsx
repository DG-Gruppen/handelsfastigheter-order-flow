import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Plus, Trash2 } from "lucide-react";

const AVAILABLE_COLORS = [
  { key: "primary", label: "Cyan", preview: "hsl(192, 91%, 36%)" },
  { key: "accent", label: "Violet", preview: "hsl(271, 91%, 65%)" },
  { key: "blue", label: "Blå", preview: "hsl(230, 75%, 55%)" },
  { key: "green", label: "Grön", preview: "hsl(165, 55%, 42%)" },
  { key: "amber", label: "Amber", preview: "hsl(38, 92%, 50%)" },
  { key: "muted", label: "Grå", preview: "hsl(230, 22%, 16%)" },
  { key: "rose", label: "Rosa", preview: "hsl(350, 75%, 55%)" },
  { key: "teal", label: "Teal", preview: "hsl(180, 55%, 42%)" },
];

interface OrgSettingsModalProps {
  onClose: () => void;
  onUpdated: () => void;
}

export default function OrgSettingsModal({ onClose, onUpdated }: OrgSettingsModalProps) {
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [newDept, setNewDept] = useState("");
  const [colorSettings, setColorSettings] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"departments" | "colors">("departments");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [deptRes, settingsRes] = await Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("org_chart_settings").select("setting_key, setting_value"),
    ]);
    setDepartments((deptRes.data as any[]) ?? []);
    const cs: Record<string, string> = {};
    for (const s of (settingsRes.data as any[]) ?? []) {
      cs[s.setting_key] = s.setting_value;
    }
    setColorSettings(cs);
  };

  const addDepartment = async () => {
    if (!newDept.trim()) return;
    const { error } = await supabase.from("departments").insert({ name: newDept.trim() } as any);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Avdelningen finns redan" : "Kunde inte lägga till");
    } else {
      toast.success("Avdelning tillagd");
      setNewDept("");
      fetchData();
    }
  };

  const removeDepartment = async (id: string) => {
    await supabase.from("departments").delete().eq("id", id);
    toast.success("Avdelning borttagen");
    fetchData();
  };

  const updateColor = async (key: string, value: string) => {
    await supabase
      .from("org_chart_settings")
      .upsert({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() } as any, { onConflict: "setting_key" });
    setColorSettings(prev => ({ ...prev, [key]: value }));
    onUpdated();
    toast.success("Färg uppdaterad");
  };

  const roles = [
    { key: "color_root", label: "VD / Root" },
    { key: "color_staff", label: "Stab" },
    { key: "color_manager", label: "Chefer" },
    { key: "color_employee", label: "Anställda" },
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <h2 className="text-base font-bold text-foreground">Org-schema inställningar</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/40">
          {(["departments", "colors"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "departments" ? "Avdelningar" : "Färger"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {activeTab === "departments" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={newDept}
                  onChange={e => setNewDept(e.target.value)}
                  placeholder="Ny avdelning..."
                  className="flex-1 rounded-lg bg-secondary/60 border border-border/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={e => e.key === "Enter" && addDepartment()}
                />
                <button
                  onClick={addDepartment}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {departments.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                  <span className="text-sm text-foreground">{d.name}</span>
                  <button
                    onClick={() => removeDepartment(d.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {departments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Inga avdelningar ännu</p>
              )}
            </div>
          )}

          {activeTab === "colors" && (
            <div className="space-y-5">
              {roles.map(role => {
                const currentValue = colorSettings[role.key] || "muted";
                const isMulti = role.key === "color_manager";
                const currentColors = currentValue.split(",");

                return (
                  <div key={role.key}>
                    <p className="text-xs font-semibold text-foreground mb-2">{role.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_COLORS.map(c => {
                        const isSelected = isMulti
                          ? currentColors.includes(c.key)
                          : currentValue === c.key;
                        return (
                          <button
                            key={c.key}
                            onClick={() => {
                              if (isMulti) {
                                const next = isSelected
                                  ? currentColors.filter(x => x !== c.key)
                                  : [...currentColors, c.key];
                                if (next.length > 0) updateColor(role.key, next.join(","));
                              } else {
                                updateColor(role.key, c.key);
                              }
                            }}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                              isSelected
                                ? "ring-2 ring-primary bg-secondary/80 text-foreground"
                                : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                            }`}
                          >
                            <span
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: c.preview }}
                            />
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                    {isMulti && (
                      <p className="text-[10px] text-muted-foreground mt-1">Välj flera — färger roterar mellan chefer</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
