import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface DocFolder {
  id: string;
  name: string;
  parent_id: string | null;
  icon: string;
  access_roles: string[] | null;
  write_roles: string[] | null;
  sort_order: number;
  created_at: string;
}

export interface DocFile {
  id: string;
  folder_id: string;
  name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  created_by: string;
  created_at: string;
}

async function fetchDocumentsData() {
  const [foldersRes, filesRes] = await Promise.all([
    supabase.from("document_folders").select("*").order("name"),
    supabase.from("document_files").select("*").order("name"),
  ]);
  return {
    folders: (foldersRes.data as DocFolder[]) ?? [],
    files: (filesRes.data as DocFile[]) ?? [],
  };
}

async function fetchModuleEditPermission(userId: string) {
  const { data: mod } = await supabase
    .from("modules")
    .select("id")
    .eq("slug", "documents")
    .maybeSingle();
  if (!mod) return false;

  const { data: userPerm } = await supabase
    .from("module_permissions")
    .select("can_edit, is_owner")
    .eq("module_id", mod.id)
    .eq("grantee_type", "user")
    .eq("grantee_id", userId);

  if (userPerm?.some((p: any) => p.can_edit || p.is_owner)) return true;

  const { data: groups } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);
  if (!groups?.length) return false;

  const groupIds = groups.map((g: any) => g.group_id);
  const { data: groupPerm } = await supabase
    .from("module_permissions")
    .select("can_edit, is_owner")
    .eq("module_id", mod.id)
    .eq("grantee_type", "group")
    .in("grantee_id", groupIds);

  return groupPerm?.some((p: any) => p.can_edit || p.is_owner) ?? false;
}

export function useDocuments() {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = roles.includes("admin");

  const { data: docsData, isLoading: loading } = useQuery({
    queryKey: ["documents-data"],
    queryFn: fetchDocumentsData,
    staleTime: 5 * 60 * 1000,
  });

  const folders = docsData?.folders ?? [];
  const files = docsData?.files ?? [];

  const { data: hasModuleEdit = false } = useQuery({
    queryKey: ["documents-module-edit", user?.id],
    queryFn: () => fetchModuleEditPermission(user!.id),
    enabled: !!user && !isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["documents-data"] });
  }, [queryClient]);

  // ── Folder CRUD ──
  const createFolder = async (name: string, parentId: string | null, icon?: string) => {
    if (!user) return;
    const maxSort = folders.filter(f => f.parent_id === parentId).reduce((m, f) => Math.max(m, f.sort_order), -1);
    const { error } = await supabase.from("document_folders").insert({
      name,
      parent_id: parentId,
      created_by: user.id,
      sort_order: maxSort + 1,
      ...(icon ? { icon } : {}),
    } as any);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mapp skapad" });
    refresh();
  };

  const renameFolder = async (id: string, name: string) => {
    const { error } = await supabase.from("document_folders").update({ name } as any).eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    refresh();
  };

  const deleteFolder = async (id: string) => {
    const { error } = await supabase.from("document_folders").delete().eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mapp borttagen" });
    refresh();
  };

  const moveFolder = async (id: string, newParentId: string | null) => {
    const { error } = await supabase.from("document_folders").update({ parent_id: newParentId } as any).eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mapp flyttad" });
    refresh();
  };

  const updateFolderAccess = async (id: string, accessRoles: string[] | null, writeRoles: string[] | null) => {
    const { error } = await supabase.from("document_folders").update({ access_roles: accessRoles, write_roles: writeRoles } as any).eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Behörighet uppdaterad" });
    refresh();
  };

  const updateFolderIcon = async (id: string, icon: string) => {
    const { error } = await supabase.from("document_folders").update({ icon } as any).eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Ikon uppdaterad" });
    refresh();
  };

  const canWriteFolder = (folderId: string): boolean => {
    if (isAdmin) return true;
    if (hasModuleEdit) return true;
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return false;
    if (!folder.write_roles) return false;
    return roles.some(r => folder.write_roles!.includes(r));
  };

  // ── File operations ──
  const sanitizeFileName = (name: string) =>
    name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");

  const uploadFile = async (folderId: string, file: File) => {
    if (!user) return;
    const safeName = sanitizeFileName(file.name);
    const path = `${folderId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) { toast({ title: "Uppladdningsfel", description: uploadError.message, variant: "destructive" }); return; }
    const { error } = await supabase.from("document_files").insert({
      folder_id: folderId,
      name: file.name,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      created_by: user.id,
    } as any);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Fil uppladdad", description: file.name });
    refresh();
  };

  const deleteFile = async (file: DocFile) => {
    await supabase.storage.from("documents").remove([file.storage_path]);
    const { error } = await supabase.from("document_files").delete().eq("id", file.id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Fil borttagen" });
    refresh();
  };

  const moveFile = async (fileId: string, newFolderId: string) => {
    const { error } = await supabase.from("document_files").update({ folder_id: newFolderId } as any).eq("id", fileId);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Fil flyttad" });
    refresh();
  };

  const renameFile = async (id: string, name: string) => {
    const { error } = await supabase.from("document_files").update({ name } as any).eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    refresh();
  };

  const downloadFile = async (file: DocFile) => {
    const { data, error } = await supabase.storage.from("documents").download(file.storage_path);
    if (error || !data) { toast({ title: "Fel", description: "Kunde inte ladda ner filen", variant: "destructive" }); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    folders, files, loading, isAdmin, roles,
    createFolder, renameFolder, deleteFolder, moveFolder, updateFolderAccess, updateFolderIcon,
    uploadFile, deleteFile, moveFile, renameFile, downloadFile,
    canWriteFolder, refresh,
  };
}
