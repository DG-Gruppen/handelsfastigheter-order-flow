import { useState, useMemo, useRef, useCallback } from "react";
import {
  FolderOpen, FileText, Search, Upload, FolderPlus, FolderUp, X, Trash2,
  FolderInput, Download,
} from "lucide-react";
import { useDocuments, type DocFolder, type DocFile } from "@/hooks/useDocuments";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import FolderTreeItem from "@/components/documents/FolderTreeItem";
import FileRow from "@/components/documents/FileRow";
import { TextPreview, formatFileSize, canPreview, isOfficeMime } from "@/components/documents/documentHelpers";
import {
  NewFolderDialog, RenameDialog, MoveDialog, AccessDialog, DeleteConfirmDialog,
} from "@/components/documents/DocumentDialogs";

export default function Documents() {
  const {
    folders, files, loading, isAdmin,
    createFolder, renameFolder, deleteFolder, moveFolder, updateFolderAccess,
    uploadFile, deleteFile, moveFile, renameFile, downloadFile, canWriteFolder,
    refresh,
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
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [bulkMoveDialog, setBulkMoveDialog] = useState(false);
  const [previewFile, setPreviewFile] = useState<DocFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; done: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ── Tree structure ──
  const rootFolders = useMemo(() => folders.filter(f => !f.parent_id).sort((a, b) => a.name.localeCompare(b.name, "sv-SE")), [folders]);
  const childrenOf = useCallback((parentId: string) => folders.filter(f => f.parent_id === parentId).sort((a, b) => a.name.localeCompare(b.name, "sv-SE")), [folders]);

  const currentFiles = useMemo(() => {
    if (!selectedFolderId) return [];
    return files.filter(f => f.folder_id === selectedFolderId);
  }, [files, selectedFolderId]);

  const searchResults = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    return {
      files: files.filter(f => f.name.toLowerCase().includes(q)),
      folders: folders.filter(f => f.name.toLowerCase().includes(q)),
    };
  }, [search, files, folders]);

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const canCreateFolderInCurrentContext = isAdmin || (selectedFolderId ? canWriteFolder(selectedFolderId) : false);

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

  const toggleExpand = useCallback((id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectFolder = useCallback((id: string) => {
    setSelectedFolderId(id);
    setSearch("");
    setSelectedFiles(new Set());
    let current = folders.find(f => f.id === id);
    const toExpand = new Set(expandedFolders);
    while (current?.parent_id) {
      toExpand.add(current.parent_id);
      current = folders.find(f => f.id === current!.parent_id);
    }
    toExpand.add(id);
    setExpandedFolders(toExpand);
  }, [folders, expandedFolders]);

  // Auto-select first folder
  if (!selectedFolderId && rootFolders.length > 0 && !loading) {
    selectFolder(rootFolders[0].id);
  }

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
    if (!selectedFolderId || !e.target.files) return;
    handleBatchUpload(e.target.files, selectedFolderId);
    e.target.value = "";
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedFolderId || !e.target.files) return;
    handleBatchUpload(e.target.files, selectedFolderId);
    e.target.value = "";
  };

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
            <FolderOpen className="h-7 w-7 text-primary" /> Dokument
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Policys, mallar och riktlinjer</p>
        </div>
        {(isAdmin || (selectedFolderId && canWriteFolder(selectedFolderId))) && (
          <div className="flex gap-2">
            {canCreateFolderInCurrentContext && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewFolderDialog({ parentId: isAdmin ? null : selectedFolderId })}
                disabled={!isAdmin && !selectedFolderId}
              >
                <FolderPlus className="w-4 h-4 mr-2" /> Ny mapp
              </Button>
            )}
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={!selectedFolderId || !!uploadProgress}>
              <Upload className="w-4 h-4 mr-2" /> Filer
            </Button>
            <Button size="sm" variant="outline" onClick={() => folderInputRef.current?.click()} disabled={!selectedFolderId || !!uploadProgress}>
              <FolderUp className="w-4 h-4 mr-2" /> Mapp
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
            <input ref={folderInputRef} type="file" className="hidden" onChange={handleFolderUpload}
              {...({ webkitdirectory: "", directory: "", mozdirectory: "" } as any)} />
            {uploadProgress && (
              <span className="text-xs text-muted-foreground self-center">
                {uploadProgress.done}/{uploadProgress.total} filer…
              </span>
            )}
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

      {/* Search results or main layout */}
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
              {searchResults.files.map(f => (
                <FileRow
                  key={f.id}
                  file={f}
                  isSelected={selectedFiles.has(f.id)}
                  canWrite={isAdmin || canWriteFolder(f.folder_id)}
                  onToggleSelect={toggleFileSelection}
                  onPreview={openPreview}
                  onDownload={downloadFile}
                  onRename={(id, name) => setRenameDialog({ type: "file", id, name })}
                  onMove={(id, name) => setMoveDialog({ type: "file", id, name })}
                  onDelete={(id, name) => setDeleteConfirm({ type: "file", id, name })}
                />
              ))}
            </div>
          )}
          {searchResults.folders.length === 0 && searchResults.files.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Inga resultat hittades.</p>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-[280px_1fr] gap-4 min-h-[500px]">
          {/* Folder tree */}
          <div className="bg-card rounded-lg border border-border p-3 overflow-y-auto max-h-[70vh]">
            <div
              className={`flex items-center gap-1.5 px-2 py-2 md:py-1.5 rounded-md text-sm cursor-pointer transition-colors min-h-[44px] md:min-h-0 font-semibold ${
                selectedFolderId === null && !search ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-foreground"
              }`}
              onClick={() => { setSelectedFolderId(null); setSearch(""); }}
            >
              <FolderOpen className="w-4 h-4 shrink-0" /> <span>Hem</span>
            </div>
            {rootFolders.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">Inga mappar ännu.</p>
            ) : (
              <div className="ml-2 border-l border-border pl-1 mt-0.5 space-y-0.5">
                {rootFolders.map(f => (
                  <FolderTreeItem
                    key={f.id}
                    folder={f}
                    childrenOf={childrenOf}
                    expandedFolders={expandedFolders}
                    selectedFolderId={selectedFolderId}
                    isAdmin={isAdmin}
                    canWriteFolder={canWriteFolder}
                    onSelect={selectFolder}
                    onToggleExpand={toggleExpand}
                    onNewFolder={(parentId) => setNewFolderDialog({ parentId })}
                    onRename={(id, name) => setRenameDialog({ type: "folder", id, name })}
                    onMove={(id, name) => setMoveDialog({ type: "folder", id, name })}
                    onAccess={(folder) => setAccessDialog(folder)}
                    onDelete={(id, name) => setDeleteConfirm({ type: "folder", id, name })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* File list */}
          <div className="bg-card rounded-lg border border-border p-4">
            {selectedFolder ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {(isAdmin || canWriteFolder(selectedFolder.id)) && currentFiles.length > 0 && (
                      <Checkbox
                        checked={selectedFiles.size === currentFiles.length && currentFiles.length > 0}
                        onCheckedChange={toggleSelectAll}
                        title="Markera alla"
                      />
                    )}
                    <h2 className="font-heading font-semibold text-lg">{selectedFolder.name}</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {currentFiles.length} {currentFiles.length === 1 ? "fil" : "filer"}
                  </span>
                </div>

                {selectedFiles.size > 0 && (
                  <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-primary/10 border border-primary/20">
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

                {currentFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <FileText className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">Inga filer i denna mapp</p>
                    {(isAdmin || (selectedFolderId && canWriteFolder(selectedFolderId))) && (
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="w-4 h-4 mr-2" /> Ladda upp filer
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}>
                          <FolderUp className="w-4 h-4 mr-2" /> Ladda upp mapp
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {currentFiles.map(f => (
                      <FileRow
                        key={f.id}
                        file={f}
                        isSelected={selectedFiles.has(f.id)}
                        canWrite={isAdmin || canWriteFolder(f.folder_id)}
                        onToggleSelect={toggleFileSelection}
                        onPreview={openPreview}
                        onDownload={downloadFile}
                        onRename={(id, name) => setRenameDialog({ type: "file", id, name })}
                        onMove={(id, name) => setMoveDialog({ type: "file", id, name })}
                        onDelete={(id, name) => setDeleteConfirm({ type: "file", id, name })}
                      />
                    ))}
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
                {previewFile.mime_type === "application/pdf" && (
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
