import { useState, useMemo, useRef, useCallback } from "react";
import {
  FolderOpen, FileText, Search, Upload, FolderPlus, FolderUp, X, Trash2,
  FolderInput, Download, ChevronRight, Home, Shield, MoreHorizontal, Pencil, Palette,
} from "lucide-react";
import { useDocuments, type DocFolder, type DocFile } from "@/hooks/useDocuments";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import FileRow from "@/components/documents/FileRow";
import { TextPreview, formatFileSize, canPreview, isOfficeMime, getFileIcon } from "@/components/documents/documentHelpers";
import {
  NewFolderDialog, RenameDialog, MoveDialog, AccessDialog, DeleteConfirmDialog, ChangeIconDialog,
} from "@/components/documents/DocumentDialogs";
import { getModuleIcon } from "@/lib/moduleIcons";

export default function Documents() {
  const {
    folders, files, loading, isAdmin,
    createFolder, renameFolder, deleteFolder, moveFolder, updateFolderAccess,
    uploadFile, deleteFile, moveFile, renameFile, downloadFile, canWriteFolder,
    refresh,
  } = useDocuments();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Dialogs
  const [newFolderDialog, setNewFolderDialog] = useState<{ parentId: string | null } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ type: "folder" | "file"; id: string; name: string } | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ type: "folder" | "file"; id: string; name: string } | null>(null);
  const [accessDialog, setAccessDialog] = useState<DocFolder | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "folder" | "file"; id: string; name: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [bulkMoveDialog, setBulkMoveDialog] = useState(false);
  const [previewFile, setPreviewFile] = useState<DocFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; done: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ── Current view data ──
  const currentSubfolders = useMemo(() =>
    folders
      .filter(f => f.parent_id === currentFolderId)
      .sort((a, b) => a.name.localeCompare(b.name, "sv-SE")),
    [folders, currentFolderId]
  );

  const currentFiles = useMemo(() => {
    if (!currentFolderId) return [];
    return files.filter(f => f.folder_id === currentFolderId);
  }, [files, currentFolderId]);

  const breadcrumbPath = useMemo(() => {
    if (!currentFolderId) return [];
    const path: DocFolder[] = [];
    let current = folders.find(f => f.id === currentFolderId);
    while (current) {
      path.unshift(current);
      current = current.parent_id ? folders.find(f => f.id === current!.parent_id) : undefined;
    }
    return path;
  }, [folders, currentFolderId]);

  const currentFolder = folders.find(f => f.id === currentFolderId);

  const searchResults = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    return {
      files: files.filter(f => f.name.toLowerCase().includes(q)),
      folders: folders.filter(f => f.name.toLowerCase().includes(q)),
    };
  }, [search, files, folders]);

  const canWrite = currentFolderId ? (isAdmin || canWriteFolder(currentFolderId)) : isAdmin;
  const canCreateFolder = isAdmin || (currentFolderId ? canWriteFolder(currentFolderId) : false);

  // ── Multi-select ──
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId); else next.add(fileId);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelectedFiles(selectedFiles.size === currentFiles.length ? new Set() : new Set(currentFiles.map(f => f.id)));
  };
  const clearSelection = () => setSelectedFiles(new Set());

  const bulkDelete = async () => {
    const toDelete = files.filter(f => selectedFiles.has(f.id));
    for (const file of toDelete) await deleteFile(file);
    clearSelection();
    toast({ title: `${toDelete.length} filer borttagna` });
  };

  const bulkMove = async (targetFolderId: string) => {
    for (const fileId of selectedFiles) await moveFile(fileId, targetFolderId);
    clearSelection();
    setBulkMoveDialog(false);
    toast({ title: `${selectedFiles.size} filer flyttade` });
  };

  // ── Navigate ──
  const navigateTo = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearch("");
    setSelectedFiles(new Set());
  }, []);

  // ── Preview ──
  const openPreview = async (file: DocFile) => {
    if (file.mime_type === "application/pdf" || isOfficeMime(file.mime_type)) {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(file.storage_path, 3600);
      if (error || !data?.signedUrl) { toast({ title: "Kunde inte öppna filen", variant: "destructive" }); return; }
      if (isOfficeMime(file.mime_type)) {
        const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.signedUrl)}`;
        setPreviewUrl(officeUrl);
      } else {
        setPreviewUrl(data.signedUrl);
      }
      setPreviewFile(file);
      return;
    }
    const { data, error } = await supabase.storage.from("documents").download(file.storage_path);
    if (error || !data) { toast({ title: "Kunde inte öppna filen", variant: "destructive" }); return; }
    setPreviewUrl(URL.createObjectURL(data));
    setPreviewFile(file);
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
  };

  const handleBatchUpload = useCallback(async (fileList: FileList, targetFolderId: string) => {
    const fileArray = Array.from(fileList);
    if (fileArray.length === 0) return;
    setUploadProgress({ total: fileArray.length, done: 0 });

    const fileFolderMap = new Map<string, File[]>();
    for (const file of fileArray) {
      const relativePath = (file as any).webkitRelativePath as string;
      if (relativePath) {
        const parts = relativePath.split("/").slice(0, -1);
        const key = parts.join("/");
        if (!fileFolderMap.has(key)) fileFolderMap.set(key, []);
        fileFolderMap.get(key)!.push(file);
      } else {
        if (!fileFolderMap.has("")) fileFolderMap.set("", []);
        fileFolderMap.get("")!.push(file);
      }
    }

    if (fileFolderMap.size === 1 && fileFolderMap.has("")) {
      let done = 0;
      for (const file of fileArray) {
        await uploadFile(targetFolderId, file);
        done++;
        setUploadProgress({ total: fileArray.length, done });
      }
    } else {
      const createdFolders = new Map<string, string>();
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
              const existing = folders.find(f => f.name === part && f.parent_id === currentParentId);
              if (existing) {
                createdFolders.set(builtPath, existing.id);
                currentParentId = existing.id;
              } else {
                await createFolder(part, currentParentId);
                await refresh();
                const { data: newFolders } = await supabase
                  .from("document_folders").select("id").eq("name", part).eq("parent_id", currentParentId).limit(1).single();
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
    if (!currentFolderId || !e.target.files) return;
    handleBatchUpload(e.target.files, currentFolderId);
    e.target.value = "";
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentFolderId || !e.target.files) return;
    handleBatchUpload(e.target.files, currentFolderId);
    e.target.value = "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isRoot = currentFolderId === null;
  const itemCount = currentSubfolders.length + currentFiles.length;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-7 w-7 text-primary" /> Dokument
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Policys, mallar och riktlinjer</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCreateFolder && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewFolderDialog({ parentId: currentFolderId })}
            >
              <FolderPlus className="w-4 h-4 mr-2" /> Ny mapp
            </Button>
          )}
          {canWrite && currentFolderId && (
            <>
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={!!uploadProgress}>
                <Upload className="w-4 h-4 mr-2" /> Filer
              </Button>
              <Button size="sm" variant="outline" onClick={() => folderInputRef.current?.click()} disabled={!!uploadProgress}>
                <FolderUp className="w-4 h-4 mr-2" /> Mapp
              </Button>
            </>
          )}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          <input ref={folderInputRef} type="file" className="hidden" onChange={handleFolderUpload}
            {...({ webkitdirectory: "", directory: "", mozdirectory: "" } as any)} />
          {uploadProgress && (
            <span className="text-xs text-muted-foreground self-center">
              {uploadProgress.done}/{uploadProgress.total} filer…
            </span>
          )}
        </div>
      </div>

      {/* Breadcrumbs + Search */}
      <div className="bg-card rounded-xl border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-border">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm flex-1 min-w-0 flex-wrap">
            <button
              onClick={() => navigateTo(null)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${isRoot ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Hem</span>
            </button>
            {breadcrumbPath.map((f, i) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                {i === breadcrumbPath.length - 1 ? (
                  <span className="px-2 py-1 rounded-md bg-primary/10 text-primary font-medium truncate max-w-[200px]">{f.name}</span>
                ) : (
                  <button onClick={() => navigateTo(f.id)} className="px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors truncate max-w-[150px]">
                    {f.name}
                  </button>
                )}
              </span>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Sök..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-9 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedFiles.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-border">
            <span className="text-sm font-medium">{selectedFiles.size} markerade</span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setBulkMoveDialog(true)}>
              <FolderInput className="w-4 h-4 mr-1" /> Flytta
            </Button>
            <Button variant="destructive" size="sm" onClick={bulkDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Ta bort
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Content area */}
        <div className="p-4 min-h-[400px]">
          {searchResults ? (
            /* Search results */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Sökresultat för "<span className="font-medium text-foreground">{search}</span>"</p>
              {searchResults.folders.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Mappar</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {searchResults.folders.map(f => (
                      <FolderCard key={f.id} folder={f} onClick={() => navigateTo(f.id)} isAdmin={isAdmin} canWrite={canWriteFolder(f.id)}
                        onNewFolder={() => setNewFolderDialog({ parentId: f.id })}
                        onRename={() => setRenameDialog({ type: "folder", id: f.id, name: f.name })}
                        onMove={() => setMoveDialog({ type: "folder", id: f.id, name: f.name })}
                        onAccess={() => setAccessDialog(f)}
                        onDelete={() => setDeleteConfirm({ type: "folder", id: f.id, name: f.name })}
                      />
                    ))}
                  </div>
                </div>
              )}
              {searchResults.files.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Filer</p>
                  <div className="space-y-1">
                    {searchResults.files.map(f => (
                      <FileRow
                        key={f.id} file={f}
                        isSelected={selectedFiles.has(f.id)}
                        canWrite={isAdmin || canWriteFolder(f.folder_id)}
                        onToggleSelect={toggleFileSelection}
                        onPreview={openPreview} onDownload={downloadFile}
                        onRename={(id, name) => setRenameDialog({ type: "file", id, name })}
                        onMove={(id, name) => setMoveDialog({ type: "file", id, name })}
                        onDelete={(id, name) => setDeleteConfirm({ type: "file", id, name })}
                      />
                    ))}
                  </div>
                </div>
              )}
              {searchResults.folders.length === 0 && searchResults.files.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Inga resultat hittades</p>
                </div>
              )}
            </div>
          ) : (
            /* Folder contents */
            <>
              {/* Select-all row */}
              {canWrite && currentFiles.length > 0 && (
                <div className="flex items-center gap-3 mb-3 pb-2 border-b border-border">
                  <Checkbox
                    checked={selectedFiles.size === currentFiles.length && currentFiles.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">
                    {currentSubfolders.length > 0 && `${currentSubfolders.length} ${currentSubfolders.length === 1 ? "mapp" : "mappar"} · `}
                    {currentFiles.length} {currentFiles.length === 1 ? "fil" : "filer"}
                  </span>
                </div>
              )}

              {/* Subfolders */}
              {currentSubfolders.length > 0 && (
                <div className="mb-4">
                  {currentFiles.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Mappar</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {currentSubfolders.map(sub => (
                      <FolderCard key={sub.id} folder={sub} onClick={() => navigateTo(sub.id)} isAdmin={isAdmin} canWrite={canWriteFolder(sub.id)}
                        onNewFolder={() => setNewFolderDialog({ parentId: sub.id })}
                        onRename={() => setRenameDialog({ type: "folder", id: sub.id, name: sub.name })}
                        onMove={() => setMoveDialog({ type: "folder", id: sub.id, name: sub.name })}
                        onAccess={() => setAccessDialog(sub)}
                        onDelete={() => setDeleteConfirm({ type: "folder", id: sub.id, name: sub.name })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {currentFiles.length > 0 && (
                <div>
                  {currentSubfolders.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Filer</p>
                  )}
                  <div className="space-y-1">
                    {currentFiles.map(f => (
                      <FileRow
                        key={f.id} file={f}
                        isSelected={selectedFiles.has(f.id)}
                        canWrite={isAdmin || canWriteFolder(f.folder_id)}
                        onToggleSelect={toggleFileSelection}
                        onPreview={openPreview} onDownload={downloadFile}
                        onRename={(id, name) => setRenameDialog({ type: "file", id, name })}
                        onMove={(id, name) => setMoveDialog({ type: "file", id, name })}
                        onDelete={(id, name) => setDeleteConfirm({ type: "file", id, name })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {itemCount === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  {isRoot ? (
                    <>
                      <FolderOpen className="w-14 h-14 mb-4 opacity-20" />
                      <p className="text-base font-medium mb-1">Inga mappar ännu</p>
                      <p className="text-sm mb-4">Skapa din första mapp för att komma igång</p>
                      {isAdmin && (
                        <Button variant="outline" onClick={() => setNewFolderDialog({ parentId: null })}>
                          <FolderPlus className="w-4 h-4 mr-2" /> Skapa mapp
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <FileText className="w-12 h-12 mb-3 opacity-20" />
                      <p className="text-sm mb-3">Denna mapp är tom</p>
                      {canWrite && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="w-4 h-4 mr-2" /> Ladda upp filer
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setNewFolderDialog({ parentId: currentFolderId })}>
                            <FolderPlus className="w-4 h-4 mr-2" /> Ny undermapp
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <NewFolderDialog open={!!newFolderDialog} parentId={newFolderDialog?.parentId ?? null} onClose={() => setNewFolderDialog(null)} onCreate={createFolder} />
      <RenameDialog open={!!renameDialog} item={renameDialog} onClose={() => setRenameDialog(null)} onRename={(id, name, type) => type === "folder" ? renameFolder(id, name) : renameFile(id, name)} />
      <MoveDialog open={!!moveDialog} item={moveDialog} folders={folders} onClose={() => setMoveDialog(null)} onMove={(id, targetFolderId, type) => type === "folder" ? moveFolder(id, targetFolderId) : moveFile(id, targetFolderId!)} />
      <AccessDialog open={!!accessDialog} folder={accessDialog} onClose={() => setAccessDialog(null)} onSave={updateFolderAccess} />
      <DeleteConfirmDialog
        open={!!deleteConfirm}
        item={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={(id, type) => {
          if (type === "folder") deleteFolder(id);
          else { const file = files.find(f => f.id === id); if (file) deleteFile(file); }
        }}
      />

      {/* Bulk move dialog */}
      <Dialog open={bulkMoveDialog} onOpenChange={() => setBulkMoveDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flytta {selectedFiles.size} filer</DialogTitle>
            <DialogDescription>Välj målmapp</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {folders.map(f => (
              <button key={f.id} onClick={() => bulkMove(f.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-secondary">
                <FolderOpen className="w-4 h-4" /> {f.name}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveDialog(false)}>Avbryt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File preview dialog */}
      <Dialog open={!!previewFile} onOpenChange={closePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{previewFile?.name}</DialogTitle>
            <DialogDescription>
              {previewFile && `${formatFileSize(previewFile.file_size)} · ${new Date(previewFile.created_at).toLocaleDateString("sv-SE")}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {previewFile && previewUrl && (
              <>
                {previewFile.mime_type.startsWith("image/") && (
                  <img src={previewUrl} alt={previewFile.name} className="max-w-full h-auto mx-auto rounded" />
                )}
                {(previewFile.mime_type === "application/pdf" || isOfficeMime(previewFile.mime_type)) && (
                  <iframe src={previewUrl} className="w-full h-[70vh] rounded border border-border" title={previewFile.name} />
                )}
                {previewFile.mime_type.startsWith("text/") && <TextPreview url={previewUrl} />}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => previewFile && downloadFile(previewFile)}>
              <Download className="w-4 h-4 mr-2" /> Ladda ner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Folder card with context menu ── */
function FolderCard({
  folder, onClick, isAdmin, canWrite,
  onNewFolder, onRename, onMove, onAccess, onDelete,
}: {
  folder: DocFolder;
  onClick: () => void;
  isAdmin: boolean;
  canWrite: boolean;
  onNewFolder: () => void;
  onRename: () => void;
  onMove: () => void;
  onAccess: () => void;
  onDelete: () => void;
}) {
  const IconComponent = getModuleIcon(folder.icon);
  const showMenu = isAdmin || canWrite;

  return (
    <div
      className="group relative flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:border-primary/30 hover:bg-secondary/50 cursor-pointer transition-all min-h-[52px]"
      onClick={onClick}
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <IconComponent className="w-4.5 h-4.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{folder.name}</p>
      </div>
      {folder.access_roles && (
        <Shield className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
      )}
      {showMenu && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 rounded-md hover:bg-background transition-opacity">
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onNewFolder(); }}>
              <FolderPlus className="w-4 h-4 mr-2" /> Ny undermapp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
              <Pencil className="w-4 h-4 mr-2" /> Byt namn
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }}>
              <FolderInput className="w-4 h-4 mr-2" /> Flytta
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAccess(); }}>
                <Shield className="w-4 h-4 mr-2" /> Behörighet
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="w-4 h-4 mr-2" /> Ta bort
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
