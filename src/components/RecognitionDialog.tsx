import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
  const [toUserId, setToUserId] = useState("");
  const [icon, setIcon] = useState("⭐");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .neq("user_id", user?.id ?? "")
      .order("full_name")
      .then(({ data }) => setProfiles((data as Profile[]) ?? []));
  }, [open, user]);

  const handleSubmit = async () => {
    if (!user || !toUserId || !message.trim()) {
      toast.error("Välj en person och skriv ett meddelande");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("recognitions").insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      icon,
      message: message.trim(),
    } as any);

    if (error) {
      toast.error("Kunde inte skapa erkännandet");
      console.error(error);
    } else {
      toast.success("Erkännande skickat! 🎉");
      setOpen(false);
      setToUserId("");
      setIcon("⭐");
      setMessage("");
      onCreated();
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
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

          {/* Recipient */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Vem vill du uppmärksamma? *</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj kollega..." />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name || p.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Meddelande *</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Beskriv varför personen förtjänar erkännandet..."
              rows={3}
              maxLength={300}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/300</p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !toUserId || !message.trim()}
            className="w-full gap-2 gradient-primary hover:opacity-90"
          >
            {submitting ? "Skickar..." : "Skicka erkännande"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
