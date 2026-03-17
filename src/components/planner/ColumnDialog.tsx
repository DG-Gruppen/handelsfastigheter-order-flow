import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlannerColumn } from "./KanbanColumn";

interface Props {
  column: PlannerColumn | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; color: string | null; wip_limit: number | null; id?: string }) => void;
}

const PRESET_COLORS = [
  null, "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4",
];

export default function ColumnDialog({ column, open, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [wipLimit, setWipLimit] = useState("");

  useEffect(() => {
    if (column) {
      setName(column.name);
      setColor(column.color);
      setWipLimit(column.wip_limit?.toString() ?? "");
    } else {
      setName("");
      setColor(null);
      setWipLimit("");
    }
  }, [column, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      color,
      wip_limit: wipLimit ? parseInt(wipLimit) : null,
      ...(column ? { id: column.id } : {}),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{column ? "Redigera kolumn" : "Ny kolumn"}</DialogTitle>
          <DialogDescription className="sr-only">
            {column ? "Ändra kolumnens inställningar" : "Skapa en ny kolumn på boarden"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Namn</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="T.ex. To Do" autoFocus />
          </div>
          <div>
            <Label>Färg</Label>
            <div className="flex gap-2 mt-1.5">
              {PRESET_COLORS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    color === c ? "border-foreground scale-110" : "border-border hover:border-foreground/40"
                  }`}
                  style={{ backgroundColor: c ?? "transparent" }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>WIP-gräns (valfritt)</Label>
            <Input
              type="number" min={1} value={wipLimit}
              onChange={e => setWipLimit(e.target.value)}
              placeholder="Max antal kort"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Avbryt</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {column ? "Spara" : "Skapa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
