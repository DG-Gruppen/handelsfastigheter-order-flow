import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Kanban } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Board {
  id: string;
  name: string;
  description: string;
  is_archived: boolean;
}

interface Props {
  boards: Board[];
  activeBoardId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, description: string) => void;
}

export default function BoardSelector({ boards, activeBoardId, onSelect, onCreate }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), desc.trim());
    setName("");
    setDesc("");
    setDialogOpen(false);
  };

  const activeBoards = boards.filter(b => !b.is_archived);

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
      {activeBoards.map(b => (
        <button
          key={b.id}
          onClick={() => onSelect(b.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
            b.id === activeBoardId
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
          )}
        >
          <Kanban className="h-3.5 w-3.5" />
          {b.name}
        </button>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setDialogOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Ny board
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ny board</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Namn" autoFocus />
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Beskrivning (valfritt)" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
              <Button onClick={handleCreate} disabled={!name.trim()}>Skapa</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
