import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Kanban, MoreVertical, Pencil, Trash2, Archive } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

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
  onUpdate: (id: string, name: string, description: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

export default function BoardSelector({ boards, activeBoardId, onSelect, onCreate, onUpdate, onDelete, onArchive }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState<Board | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Board | null>(null);

  useEffect(() => {
    if (editingBoard) {
      setName(editingBoard.name);
      setDesc(editingBoard.description);
    } else {
      setName("");
      setDesc("");
    }
  }, [editingBoard]);

  const handleSave = () => {
    if (!name.trim()) return;
    if (editingBoard) {
      onUpdate(editingBoard.id, name.trim(), desc.trim());
    } else {
      onCreate(name.trim(), desc.trim());
    }
    setName("");
    setDesc("");
    setEditingBoard(null);
    setDialogOpen(false);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingBoard(null);
    setName("");
    setDesc("");
  };

  const activeBoards = boards.filter(b => !b.is_archived);

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
      {activeBoards.map(b => (
        <div key={b.id} className="flex items-center shrink-0">
          <button
            onClick={() => onSelect(b.id)}
            className={cn(
              "flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              b.id === activeBoardId
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
            )}
          >
            <Kanban className="h-3.5 w-3.5" />
            {b.name}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span
                  role="button"
                  onClick={e => e.stopPropagation()}
                  className={cn(
                    "ml-1 p-0.5 rounded hover:bg-black/10 transition-colors",
                    b.id === activeBoardId ? "hover:bg-white/20" : ""
                  )}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => { setEditingBoard(b); setDialogOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Redigera
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmArchive(b)}>
                  <Archive className="h-3.5 w-3.5 mr-2" /> Arkivera
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmDelete(b)} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Ta bort
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => { setEditingBoard(null); setDialogOpen(true); }}>
        <Plus className="h-3.5 w-3.5" /> Ny board
      </Button>

      {/* Edit / Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && handleClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingBoard ? "Redigera board" : "Ny board"}</DialogTitle>
            <DialogDescription>
              {editingBoard ? "Ändra namn och beskrivning för din board." : "Skapa en ny board för att organisera dina uppgifter."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Namn</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Namn" autoFocus />
            </div>
            <div>
              <Label>Beskrivning</Label>
              <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Beskrivning (valfritt)" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Avbryt</Button>
              <Button onClick={handleSave} disabled={!name.trim()}>
                {editingBoard ? "Spara" : "Skapa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <AlertDialog open={!!confirmArchive} onOpenChange={v => !v && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arkivera board</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill arkivera <span className="font-semibold">"{confirmArchive?.name}"</span>? Boarden och alla dess kort döljs men kan återställas senare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmArchive) onArchive(confirmArchive.id); setConfirmArchive(null); }}
            >
              <Archive className="h-4 w-4 mr-1.5" /> Arkivera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort board</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort <span className="font-semibold">"{confirmDelete?.name}"</span>? Alla kolumner och kort i boarden raderas permanent. Denna åtgärd går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDelete) onDelete(confirmDelete.id); setConfirmDelete(null); }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
