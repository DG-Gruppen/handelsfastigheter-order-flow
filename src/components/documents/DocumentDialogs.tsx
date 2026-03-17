import { useState } from "react";
import { FolderOpen } from "lucide-react";
import type { DocFolder } from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ALL_ROLES } from "./documentHelpers";

const FOLDER_ICON_OPTIONS = [
  { value: "folder", label: "Mapp" },
  { value: "shield", label: "Säkerhet" },
  { value: "book-open", label: "Bok" },
  { value: "target", label: "Mål" },
  { value: "users", label: "Personal" },
  { value: "building", label: "Byggnad" },
  { value: "settings", label: "Inställningar" },
  { value: "heart", label: "Hjärta" },
  { value: "monitor", label: "Skärm" },
  { value: "leaf", label: "Löv" },
  { value: "calculator", label: "Kalkylator" },
  { value: "palette", label: "Palett" },
  { value: "bar-chart-3", label: "Statistik" },
  { value: "kanban", label: "Kanban" },
  { value: "newspaper", label: "Nyheter" },
  { value: "headphones", label: "Support" },
];

export function NewFolderDialog({ open, parentId, onClose, onCreate }: {
  open: boolean; parentId: string | null; onClose: () => void;
  onCreate: (name: string, parentId: string | null, icon?: string) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("folder");
  const isRoot = parentId === null;
  const handleSubmit = () => {
    if (name.trim()) {
      onCreate(name.trim(), parentId, isRoot ? icon : undefined);
      setName("");
      setIcon("folder");
      onClose();
    }
  };
  return (
    <Dialog open={open} onOpenChange={() => { setName(""); setIcon("folder"); onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Skapa ny mapp</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mappnamn</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="T.ex. Personalhandbok"
              onKeyDown={e => e.key === "Enter" && handleSubmit()} autoFocus />
          </div>
          {isRoot && (
            <div className="space-y-2">
              <Label>Ikon</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {FOLDER_ICON_OPTIONS.map(opt => {
                  const Icon = getModuleIcon(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.label}
                      onClick={() => setIcon(opt.value)}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                        icon === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setName(""); setIcon("folder"); onClose(); }}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>Skapa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RenameDialog({ open, item, onClose, onRename }: {
  open: boolean; item: { type: "folder" | "file"; id: string; name: string } | null;
  onClose: () => void; onRename: (id: string, name: string, type: "folder" | "file") => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const handleSubmit = () => { if (item && name.trim()) { onRename(item.id, name.trim(), item.type); onClose(); } };
  if (item && name !== item.name && name === "") setName(item.name);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Byt namn</DialogTitle></DialogHeader>
        <Input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>Spara</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MoveDialog({ open, item, folders, onClose, onMove }: {
  open: boolean; item: { type: "folder" | "file"; id: string; name: string } | null;
  folders: DocFolder[]; onClose: () => void;
  onMove: (id: string, targetFolderId: string | null, type: "folder" | "file") => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  if (!item) return null;
  const availableFolders = item.type === "folder" ? folders.filter(f => f.id !== item.id) : folders;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Flytta "{item.name}"</DialogTitle></DialogHeader>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {item.type === "folder" && (
            <button onClick={() => setTarget(null)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left ${target === null ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
              <FolderOpen className="w-4 h-4" /> Rotnivå
            </button>
          )}
          {availableFolders.map(f => (
            <button key={f.id} onClick={() => setTarget(f.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left ${target === f.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
              <FolderOpen className="w-4 h-4" /> {f.name}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button onClick={() => { onMove(item.id, target, item.type); onClose(); }}
            disabled={item.type === "file" && !target}>Flytta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccessDialog({ open, folder, onClose, onSave }: {
  open: boolean; folder: DocFolder | null; onClose: () => void;
  onSave: (id: string, accessRoles: string[] | null, writeRoles: string[] | null) => void;
}) {
  const [readRoles, setReadRoles] = useState<string[]>(folder?.access_roles ?? []);
  const [writeRoles, setWriteRoles] = useState<string[]>(folder?.write_roles ?? []);
  const [allRead, setAllRead] = useState(!folder?.access_roles);

  if (!folder) return null;

  const toggleRead = (role: string) => {
    setReadRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };
  const toggleWrite = (role: string) => {
    setWriteRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Behörighet: {folder.name}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Läsbehörighet</p>
            <div className="flex items-center gap-2">
              <Checkbox checked={allRead} onCheckedChange={(c) => setAllRead(!!c)} id="all-read" />
              <Label htmlFor="all-read">Alla roller kan läsa</Label>
            </div>
            {!allRead && (
              <div className="space-y-2 pl-6">
                {ALL_ROLES.map(role => (
                  <div key={role.value} className="flex items-center gap-2">
                    <Checkbox checked={readRoles.includes(role.value)} onCheckedChange={() => toggleRead(role.value)} id={`read-${role.value}`} />
                    <Label htmlFor={`read-${role.value}`}>{role.label}</Label>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Skrivbehörighet</p>
            <p className="text-xs text-muted-foreground">Administratörer har alltid skrivrättighet</p>
            <div className="space-y-2">
              {ALL_ROLES.filter(r => r.value !== "admin").map(role => (
                <div key={role.value} className="flex items-center gap-2">
                  <Checkbox checked={writeRoles.includes(role.value)} onCheckedChange={() => toggleWrite(role.value)} id={`write-${role.value}`} />
                  <Label htmlFor={`write-${role.value}`}>{role.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button onClick={() => {
            onSave(folder.id, allRead ? null : readRoles, writeRoles.length > 0 ? writeRoles : null);
            onClose();
          }}>Spara</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteConfirmDialog({ open, item, onClose, onConfirm }: {
  open: boolean; item: { type: "folder" | "file"; id: string; name: string } | null;
  onClose: () => void; onConfirm: (id: string, type: "folder" | "file") => void;
}) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ta bort {item.type === "folder" ? "mapp" : "fil"}</DialogTitle>
          <DialogDescription>
            Är du säker på att du vill ta bort "{item.name}"?
            {item.type === "folder" && " Alla filer och undermappar kommer att tas bort."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button variant="destructive" onClick={() => { onConfirm(item.id, item.type); onClose(); }}>Ta bort</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
