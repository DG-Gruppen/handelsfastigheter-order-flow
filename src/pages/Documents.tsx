import { useState, useMemo, useRef, useCallback } from "react";
import {
  FolderOpen, FileText, ChevronRight, ChevronDown, Search, Upload,
  MoreHorizontal, Pencil, Trash2, FolderInput, Download, FolderPlus, Shield,
  FolderUp,
} from "lucide-react";
import { useDocuments, type DocFolder, type DocFile } from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import { getModuleIcon } from "@/lib/moduleIcons";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";


// ── Helpers ──
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "📊";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "📽️";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  return "📎";
}

const ALL_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Chef" },
  { value: "staff", label: "Stab" },
  { value: "employee", label: "Anställd" },
];

export default function Documents() {
  const {
    folders, files, loading, isAdmin,
    createFolder, renameFolder, deleteFolder, moveFolder, updateFolderAccess,
    uploadFile, deleteFile, moveFile, renameFile, downloadFile, canWriteFolder,
  } = useDocuments();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Dialogs
  const [newFolderDialog, setNewFolderDialog] = useState<{ parentId: string | null } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ type: "folder" | "file"; id: string; name: string } | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ type: "folder" | "file"; id: string; name: string } | null>(null);
  const [accessDialog, setAccessDialog] = useState<DocFolder | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "folder" | "file"; id: string; name: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Tree structure (alphabetical) ──
  const rootFolders = useMemo(() => folders.filter(f => !f.parent_id).sort((a, b) => a.name.localeCompare(b.name, "sv-SE")), [folders]);
  const childrenOf = (parentId: string) => folders.filter(f => f.parent_id === parentId).sort((a, b) => a.name.localeCompare(b.name, "sv-SE"));

  const currentFiles = useMemo(() => {
    if (!selectedFolderId) return [];
    return files.filter(f => f.folder_id === selectedFolderId);
  }, [files, selectedFolderId]);

  const searchResults = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    const matchedFiles = files.filter(f => f.name.toLowerCase().includes(q));
    const matchedFolders = folders.filter(f => f.name.toLowerCase().includes(q));
    return { files: matchedFiles, folders: matchedFolders };
  }, [search, files, folders]);

  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  const toggleExpand = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const selectFolder = (id: string) => {
    setSelectedFolderId(id);
    setSearch("");
    // Auto-expand parent chain
    let current = folders.find(f => f.id === id);
    const toExpand = new Set(expandedFolders);
    while (current?.parent_id) {
      toExpand.add(current.parent_id);
      current = folders.find(f => f.id === current!.parent_id);
    }
    toExpand.add(id);
    setExpandedFolders(toExpand);
  };

  // Auto-select first folder
  if (!selectedFolderId && rootFolders.length > 0 && !loading) {
    selectFolder(rootFolders[0].id);
  }

  const [uploadProgress, setUploadProgress] = useState<{ total: number; done: number } | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleBatchUpload = useCallback(async (files: FileList, targetFolderId: string) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploadProgress({ total: fileArray.length, done: 0 });

    // Group files by their relative folder paths for folder uploads
    const fileFolderMap = new Map<string, File[]>();
    for (const file of fileArray) {
      const relativePath = (file as any).webkitRelativePath as string;
      if (relativePath) {
        // e.g. "MyFolder/sub/file.txt" → parts = ["MyFolder", "sub"]
        const parts = relativePath.split("/").slice(0, -1);
        const key = parts.join("/");
        if (!fileFolderMap.has(key)) fileFolderMap.set(key, []);
        fileFolderMap.get(key)!.push(file);
      } else {
        if (!fileFolderMap.has("")) fileFolderMap.set("", []);
        fileFolderMap.get("")!.push(file);
      }
    }

    // If it's a simple multi-file upload (no folder structure)
    if (fileFolderMap.size === 1 && fileFolderMap.has("")) {
      let done = 0;
      for (const file of fileArray) {
        await uploadFile(targetFolderId, file);
        done++;
        setUploadProgress({ total: fileArray.length, done });
      }
    } else {
      // Folder upload: create subfolders as needed
      const createdFolders = new Map<string, string>(); // path → folderId
      let done = 0;

      for (const [folderPath, filesInFolder] of fileFolderMap) {
        let currentParentId = targetFolderId;

        if (folderPath) {
          const parts = folderPath.split("/");
          let builtPath = "";
          for (const part of parts) {
            builtPath = builtPath ? `${builtPath}/${part}` : part;
            if (createdFolders.has(builtPath)) {
              currentParentId = createdFolders.get(builtPath)!;
            } else {
              // Check if folder already exists
              const existing = folders.find(
                f => f.name === part && f.parent_id === currentParentId
              );
              if (existing) {
                createdFolders.set(builtPath, existing.id);
                currentParentId = existing.id;
              } else {
                await createFolder(part, currentParentId);
                // Refresh to get the new folder ID
                await refresh();
                // We need to find the newly created folder - it won't be in current state yet
                // So we'll fetch fresh data and find it
                const { data: newFolders } = await (await import("@/integrations/supabase/client")).supabase
                  .from("document_folders")
                  .select("id")
                  .eq("name", part)
                  .eq("parent_id", currentParentId)
                  .limit(1)
                  .single();
                if (newFolders) {
                  createdFolders.set(builtPath, newFolders.id);
                  currentParentId = newFolders.id;
                }
              }
            }
          }
        }

        for (const file of filesInFolder) {
          await uploadFile(currentParentId, file);
          done++;
          setUploadProgress({ total: fileArray.length, done });
        }
      }
    }

    setUploadProgress(null);
    refresh();
  }, [folders, uploadFile, createFolder, refresh]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedFolderId || !e.target.files) return;
    handleBatchUpload(e.target.files, selectedFolderId);
    e.target.value = "";
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedFolderId || !e.target.files) return;
    handleBatchUpload(e.target.files, selectedFolderId);
    e.target.value = "";
  };

  // ── Render folder tree item ──
  function FolderTreeItem({ folder, depth = 0 }: { folder: DocFolder; depth?: number }) {
    const children = childrenOf(folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const hasChildren = children.length > 0;
    const IconComponent = getModuleIcon(folder.icon);
    const canWrite = canWriteFolder(folder.id);

    return (
      <div>
        <div
          className={`group flex items-center gap-1.5 px-2 py-2 md:py-1.5 rounded-md text-sm cursor-pointer transition-colors min-h-[44px] md:min-h-0 ${
            isSelected
              ? "bg-primary text-primary-foreground"
              : "hover:bg-secondary text-foreground"
          }`}
          style={{ paddingLeft: '8px' }}
          onClick={() => selectFolder(folder.id)}
        >
          <button
            className="shrink-0 w-4 h-4 flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(folder.id); }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            ) : <span className="w-3" />}
          </button>
          <IconComponent className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1">{folder.name}</span>
          {folder.access_roles && (
            <Shield className="w-3 h-3 opacity-50 shrink-0" />
          )}
          {(isAdmin || canWrite) && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded hover:bg-black/10 transition-opacity">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setNewFolderDialog({ parentId: folder.id })}>
                  <FolderPlus className="w-4 h-4 mr-2" /> Ny undermapp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRenameDialog({ type: "folder", id: folder.id, name: folder.name })}>
                  <Pencil className="w-4 h-4 mr-2" /> Byt namn
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMoveDialog({ type: "folder", id: folder.id, name: folder.name })}>
                  <FolderInput className="w-4 h-4 mr-2" /> Flytta
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => setAccessDialog(folder)}>
                    <Shield className="w-4 h-4 mr-2" /> Behörighet
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm({ type: "folder", id: folder.id, name: folder.name })}>
                  <Trash2 className="w-4 h-4 mr-2" /> Ta bort
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {isExpanded && children.length > 0 && (
          <div className="ml-3 border-l border-border pl-1 space-y-0.5">
            {children.map(child => (
              <FolderTreeItem key={child.id} folder={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── File row ──
  function FileRow({ file }: { file: DocFile }) {
    return (
      <div className="group flex items-center gap-3 px-4 py-3 rounded-md text-sm hover:bg-secondary/50 transition-colors border border-transparent hover:border-border">
        <span className="text-lg shrink-0">{getFileIcon(file.mime_type)}</span>
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString("sv-SE")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadFile(file)}>
            <Download className="w-4 h-4" />
          </Button>
          {(isAdmin || canWriteFolder(file.folder_id)) && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setRenameDialog({ type: "file", id: file.id, name: file.name })}>
                  <Pencil className="w-4 h-4 mr-2" /> Byt namn
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMoveDialog({ type: "file", id: file.id, name: file.name })}>
                  <FolderInput className="w-4 h-4 mr-2" /> Flytta till mapp
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm({ type: "file", id: file.id, name: file.name })}>
                  <Trash2 className="w-4 h-4 mr-2" /> Ta bort
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-7 w-7 text-primary" />
            Dokument
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Policys, mallar och riktlinjer</p>
        </div>
        {(isAdmin || (selectedFolderId && canWriteFolder(selectedFolderId))) && (
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setNewFolderDialog({ parentId: null })}>
                <FolderPlus className="w-4 h-4 mr-2" /> Ny mapp
              </Button>
            )}
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={!selectedFolderId}>
              <Upload className="w-4 h-4 mr-2" /> Ladda upp
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Sök filer och mappar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 h-12 md:h-10 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {/* Search results */}
      {searchResults ? (
        <div className="bg-card rounded-lg border border-border p-4 space-y-4">
          <h2 className="font-heading font-semibold text-lg">Sökresultat för "{search}"</h2>
          {searchResults.folders.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Mappar</p>
              {searchResults.folders.map(f => (
                <button key={f.id} onClick={() => selectFolder(f.id)} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-secondary w-full text-left text-sm">
                  <FolderOpen className="w-4 h-4 text-primary" /> {f.name}
                </button>
              ))}
            </div>
          )}
          {searchResults.files.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Filer</p>
              {searchResults.files.map(f => <FileRow key={f.id} file={f} />)}
            </div>
          )}
          {searchResults.folders.length === 0 && searchResults.files.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Inga resultat hittades.</p>
          )}
        </div>
      ) : (
        /* Main two-column layout */
        <div className="grid md:grid-cols-[280px_1fr] gap-4 min-h-[500px]">
          {/* Folder tree */}
          <div className="bg-card rounded-lg border border-border p-3 overflow-y-auto max-h-[70vh]">
            {/* Hem (root) */}
            <div
              className={`flex items-center gap-1.5 px-2 py-2 md:py-1.5 rounded-md text-sm cursor-pointer transition-colors min-h-[44px] md:min-h-0 font-semibold ${
                selectedFolderId === null && !search
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary text-foreground"
              }`}
              onClick={() => { setSelectedFolderId(null); setSearch(""); }}
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span>Hem</span>
            </div>
            {rootFolders.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">Inga mappar ännu.</p>
            ) : (
              <div className="ml-2 border-l border-border pl-1 mt-0.5 space-y-0.5">
                {rootFolders.map(f => <FolderTreeItem key={f.id} folder={f} />)}
              </div>
            )}
          </div>

          {/* File list */}
          <div className="bg-card rounded-lg border border-border p-4">
            {selectedFolder ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading font-semibold text-lg">{selectedFolder.name}</h2>
                  <span className="text-xs text-muted-foreground">
                    {currentFiles.length} {currentFiles.length === 1 ? "fil" : "filer"}
                  </span>
                </div>
                {currentFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <FileText className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">Inga filer i denna mapp</p>
                    {(isAdmin || (selectedFolderId && canWriteFolder(selectedFolderId))) && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" /> Ladda upp filer
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {currentFiles.map(f => <FileRow key={f.id} file={f} />)}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <p className="text-sm">Välj en mapp till vänster</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      <NewFolderDialog
        open={!!newFolderDialog}
        parentId={newFolderDialog?.parentId ?? null}
        onClose={() => setNewFolderDialog(null)}
        onCreate={createFolder}
      />
      <RenameDialog
        open={!!renameDialog}
        item={renameDialog}
        onClose={() => setRenameDialog(null)}
        onRename={(id, name, type) => type === "folder" ? renameFolder(id, name) : renameFile(id, name)}
      />
      <MoveDialog
        open={!!moveDialog}
        item={moveDialog}
        folders={folders}
        onClose={() => setMoveDialog(null)}
        onMove={(id, targetFolderId, type) => type === "folder" ? moveFolder(id, targetFolderId) : moveFile(id, targetFolderId!)}
      />
      <AccessDialog
        open={!!accessDialog}
        folder={accessDialog}
        onClose={() => setAccessDialog(null)}
        onSave={updateFolderAccess}
      />
      <DeleteConfirmDialog
        open={!!deleteConfirm}
        item={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={(id, type) => {
          if (type === "folder") deleteFolder(id);
          else {
            const file = files.find(f => f.id === id);
            if (file) deleteFile(file);
          }
        }}
      />
    </div>
  );
}

// ── Sub-dialogs ──

function NewFolderDialog({ open, parentId, onClose, onCreate }: {
  open: boolean; parentId: string | null; onClose: () => void;
  onCreate: (name: string, parentId: string | null) => void;
}) {
  const [name, setName] = useState("");
  const handleSubmit = () => { if (name.trim()) { onCreate(name.trim(), parentId); setName(""); onClose(); } };
  return (
    <Dialog open={open} onOpenChange={() => { setName(""); onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Skapa ny mapp</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Mappnamn</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="T.ex. Personalhandbok"
            onKeyDown={e => e.key === "Enter" && handleSubmit()} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setName(""); onClose(); }}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>Skapa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ open, item, onClose, onRename }: {
  open: boolean; item: { type: "folder" | "file"; id: string; name: string } | null;
  onClose: () => void; onRename: (id: string, name: string, type: "folder" | "file") => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const handleSubmit = () => { if (item && name.trim()) { onRename(item.id, name.trim(), item.type); onClose(); } };
  // Reset name when item changes
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

function MoveDialog({ open, item, folders, onClose, onMove }: {
  open: boolean; item: { type: "folder" | "file"; id: string; name: string } | null;
  folders: DocFolder[]; onClose: () => void;
  onMove: (id: string, targetFolderId: string | null, type: "folder" | "file") => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  if (!item) return null;
  const availableFolders = item.type === "folder"
    ? folders.filter(f => f.id !== item.id)
    : folders;
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

function AccessDialog({ open, folder, onClose, onSave }: {
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
          {/* Read access */}
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

          {/* Write access */}
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground">Skrivbehörighet</p>
            <p className="text-xs text-muted-foreground">Roller som kan ladda upp, redigera och ta bort filer/undermappar. Admin har alltid skrivåtkomst.</p>
            <div className="space-y-2 pl-2">
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
            onSave(
              folder.id,
              allRead ? null : readRoles,
              writeRoles.length > 0 ? writeRoles : null
            );
            onClose();
          }}>Spara</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({ open, item, onClose, onConfirm }: {
  open: boolean; item: { type: "folder" | "file"; id: string; name: string } | null;
  onClose: () => void; onConfirm: (id: string, type: "folder" | "file") => void;
}) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ta bort {item.type === "folder" ? "mapp" : "fil"}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Är du säker på att du vill ta bort <strong>{item.name}</strong>?
          {item.type === "folder" && " Alla filer och undermappar tas också bort."}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button variant="destructive" onClick={() => { onConfirm(item.id, item.type); onClose(); }}>Ta bort</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
