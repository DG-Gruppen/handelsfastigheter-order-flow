import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_OPTIONS = [
  { value: "⭐", label: "Stjärna" },
  { value: "🚀", label: "Raket" },
  { value: "🌱", label: "Tillväxt" },
  { value: "💡", label: "Idé" },
  { value: "🏆", label: "Trofé" },
  { value: "❤️", label: "Hjärta" },
  { value: "🔥", label: "Eld" },
  { value: "🎯", label: "Träffsäker" },
];

interface Profile {
  user_id: string;
  full_name: string;
}

interface RecognitionDialogProps {
  onCreated: () => void;
}

export default function RecognitionDialog({ onCreated }: RecognitionDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [toUserIds, setToUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [icon, setIcon] = useState("⭐");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .neq("user_id", user?.id ?? "")
      .eq("is_external", false)
      .eq("heartpace_sync_excluded", false)
      .order("full_name")
      .then(({ data }) => setProfiles((data as Profile[]) ?? []));
  }, [open, user]);

  const selectedProfiles = useMemo(
    () => profiles.filter((p) => toUserIds.includes(p.user_id)),
    [profiles, toUserIds]
  );

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => (p.full_name ?? "").toLowerCase().includes(q));
  }, [profiles, search]);

  const toggleUser = (id: string) => {
    setToUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!user || toUserIds.length === 0 || !message.trim()) {
      toast.error("Välj minst en person och skriv ett meddelande");
      return;
    }
    setSubmitting(true);
    const batch_id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
    const rows = toUserIds.map((to_user_id) => ({
      from_user_id: user.id,
      to_user_id,
      icon,
      message: message.trim(),
      batch_id,
    }));
    const { error } = await supabase.from("recognitions").insert(rows as any);

    if (error) {
      toast.error("Kunde inte skapa erkännandet");
      console.error(error);
    } else {
      toast.success(
        toUserIds.length > 1
          ? `Erkännande skickat till ${toUserIds.length} kollegor! 🎉`
          : "Erkännande skickat! 🎉"
      );
      setOpen(false);
      setToUserIds([]);
      setSearch("");
      setIcon("⭐");
      setMessage("");
      onCreated();
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Ge ett erkännande</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Nytt erkännande</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Icon picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Ikon</Label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIcon(opt.value)}
                  className={cn(
                    "w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-all",
                    icon === opt.value
                      ? "border-primary bg-primary/10 scale-110"
                      : "border-border hover:border-primary/50 hover:bg-muted"
                  )}
                  title={opt.label}
                >
                  {opt.value}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients (multi-select) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Vem/vilka vill du uppmärksamma? * {toUserIds.length > 0 && (
                <span className="text-muted-foreground font-normal">({toUserIds.length} valda)</span>
              )}
            </Label>

            {selectedProfiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-border bg-muted/30">
                {selectedProfiles.map((p) => (
                  <Badge key={p.user_id} variant="secondary" className="gap-1 pr-1">
                    {p.full_name || p.user_id}
                    <button
                      type="button"
                      onClick={() => toggleUser(p.user_id)}
                      className="ml-0.5 rounded-full hover:bg-background/60 p-0.5"
                      aria-label="Ta bort"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök kollega..."
            />

            <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {filteredProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Inga träffar</p>
              ) : (
                filteredProfiles.map((p) => {
                  const checked = toUserIds.includes(p.user_id);
                  return (
                    <button
                      key={p.user_id}
                      type="button"
                      onClick={() => toggleUser(p.user_id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted transition-colors",
                        checked && "bg-primary/5"
                      )}
                    >
                      <span>{p.full_name || p.user_id}</span>
                      {checked && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Meddelande *</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Beskriv varför personen/personerna förtjänar erkännandet..."
              rows={3}
              maxLength={300}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/300</p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || toUserIds.length === 0 || !message.trim()}
            className="w-full gap-2 gradient-primary hover:opacity-90"
          >
            {submitting
              ? "Skickar..."
              : toUserIds.length > 1
                ? `Skicka till ${toUserIds.length} kollegor`
                : "Skicka erkännande"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
