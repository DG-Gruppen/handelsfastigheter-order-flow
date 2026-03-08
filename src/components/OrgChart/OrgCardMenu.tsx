import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Pencil, Building2, Briefcase } from "lucide-react";

interface OrgCardMenuProps {
  profileId: string;
  currentName: string;
  currentDepartment: string;
  currentTitleOverride: string | null;
  departments: string[];
  screenX: number;
  screenY: number;
  onClose: () => void;
  onUpdated: () => void;
}

type EditMode = null | "name" | "department" | "title";

export default function OrgCardMenu({
  profileId, currentName, currentDepartment, currentTitleOverride,
  departments, screenX, screenY, onClose, onUpdated,
}: OrgCardMenuProps) {
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [name, setName] = useState(currentName);
  const [department, setDepartment] = useState(currentDepartment);
  const [titleOverride, setTitleOverride] = useState(currentTitleOverride || "");

  const save = async (field: string, value: string) => {
    const update: Record<string, string | null> = {};
    if (field === "full_name") update.full_name = value;
    if (field === "department") update.department = value;
    if (field === "title_override") update.title_override = value || null;

    const { error } = await supabase
      .from("profiles")
      .update(update as any)
      .eq("id", profileId);

    if (error) {
      toast.error("Kunde inte spara ändringen");
    } else {
      toast.success("Uppdaterat");
      onUpdated();
    }
    onClose();
  };

  if (editMode) {
    return (
      <div className="fixed inset-0 z-[10000]" onClick={onClose}>
        <div
          className="absolute z-[10001]"
          style={{ left: screenX, top: screenY, transform: "translate(-50%, -50%)" }}
          onClick={e => e.stopPropagation()}
        >
          <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden min-w-[260px]">
            <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">
                {editMode === "name" ? "Ändra namn" : editMode === "department" ? "Ändra avdelning" : "Ändra titel"}
              </p>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              {editMode === "name" && (
                <>
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full rounded-lg bg-secondary/60 border border-border/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Fullständigt namn"
                    onKeyDown={e => e.key === "Enter" && save("full_name", name)}
                  />
                  <button
                    onClick={() => save("full_name", name)}
                    className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Spara
                  </button>
                </>
              )}
              {editMode === "title" && (
                <>
                  <input
                    autoFocus
                    value={titleOverride}
                    onChange={e => setTitleOverride(e.target.value)}
                    className="w-full rounded-lg bg-secondary/60 border border-border/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Lämna tomt för automatisk titel"
                    onKeyDown={e => e.key === "Enter" && save("title_override", titleOverride)}
                  />
                  <p className="text-[10px] text-muted-foreground">Lämna tomt för automatisk titel baserad på roll + avdelning</p>
                  <button
                    onClick={() => save("title_override", titleOverride)}
                    className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Spara
                  </button>
                </>
              )}
              {editMode === "department" && (
                <div className="space-y-1">
                  {departments.map(d => (
                    <button
                      key={d}
                      onClick={() => save("department", d)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        d === department
                          ? "bg-primary/20 text-primary font-medium"
                          : "hover:bg-secondary/80 text-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                  {departments.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      Inga avdelningar konfigurerade. Lägg till via inställningar.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const items = [
    { key: "name" as EditMode, label: "Ändra namn", icon: <Pencil className="h-4 w-4" /> },
    { key: "title" as EditMode, label: "Ändra titel", icon: <Briefcase className="h-4 w-4" /> },
    { key: "department" as EditMode, label: "Ändra avdelning", icon: <Building2 className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-[10000]" onClick={onClose}>
      <div
        className="absolute z-[10001]"
        style={{ left: screenX, top: screenY, transform: "translate(-50%, -50%)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden min-w-[200px]">
          <div className="px-3 py-2 border-b border-border/40">
            <p className="text-xs font-semibold text-foreground">Redigera kort</p>
          </div>
          <div className="p-1">
            {items.map(item => (
              <button
                key={item.key}
                onClick={() => setEditMode(item.key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/80 transition-colors text-left group"
              >
                <span className="text-muted-foreground group-hover:text-primary transition-colors">
                  {item.icon}
                </span>
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
