import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

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

export function useDocuments() {
  const { user, roles } = useAuth();
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasModuleEdit, setHasModuleEdit] = useState(false);
  const isAdmin = roles.includes("admin") || roles.includes("it");

  const fetchData = useCallback(async () => {
    const [foldersRes, filesRes] = await Promise.all([
      supabase.from("document_folders").select("*").order("name"),
      supabase.from("document_files").select("*").order("name"),
    ]);
    setFolders((foldersRes.data as DocFolder[]) ?? []);
    setFiles((filesRes.data as DocFile[]) ?? []);
    setLoading(false);
  }, []);

  // Check if user has module-level edit/owner permission on the documents module
  useEffect(() => {
    if (!user || isAdmin) return;
    (async () => {
      // Get the documents module id
      const { data: mod } = await supabase
        .from("modules")
        .select("id")
        .eq("slug", "documents")
        .maybeSingle();
      if (!mod) return;

      // Check user-level permission
      const { data: userPerm } = await supabase
        .from("module_permissions")
        .select("can_edit, is_owner")
        .eq("module_id", mod.id)
        .eq("grantee_type", "user")
        .eq("grantee_id", user.id);

      if (userPerm?.some((p: any) => p.can_edit || p.is_owner)) {
        setHasModuleEdit(true);
        return;
      }

      // Check group-level permission
      const { data: groups } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);
      if (!groups?.length) return;

      const groupIds = groups.map((g: any) => g.group_id);
      const { data: groupPerm } = await supabase
        .from("module_permissions")
        .select("can_edit, is_owner")
        .eq("module_id", mod.id)
        .eq("grantee_type", "group")
        .in("grantee_id", groupIds);

      if (groupPerm?.some((p: any) => p.can_edit || p.is_owner)) {
        setHasModuleEdit(true);
      }
    })();
  }, [user?.id, isAdmin]);

  useEffect(() => {
    fetchData();

    const debounceRef = { current: null as ReturnType<typeof setTimeout> | null };
    const debouncedRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(), 500);
    };

    const channel = supabase
      .channel("documents-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "document_folders" }, debouncedRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_files" }, debouncedRefetch)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchData]);

  // ── Folder CRUD ──
  const createFolder = async (name: string, parentId: string | null) => {
    if (!user) return;
    const maxSort = folders.filter(f => f.parent_id === parentId).reduce((m, f) => Math.max(m, f.sort_order), -1);
    const { error } = await supabase.from("document_folders").insert({
      name,
      parent_id: parentId,
      created_by: user.id,
      sort_order: maxSort + 1,
    } as any);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mapp skapad" });
    fetchData();
  };

  const renameFolder = async (id: string, name: string) => {
    const { error } = await supabase.from("document_folders").update({ name } as any).eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    fetchData();
  };

  const deleteFolder = async (id: string) => {
    const { error } = await supabase.from("document_folders").delete().eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mapp borttagen" });
    fetchData();
  };

  const moveFolder = async (id: string, newParentId: string | null) => {
    const { error } = await supabase.from("document_folders").update({ parent_id: newParentId } as any).eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mapp flyttad" });
    fetchData();
  };

  const updateFolderAccess = async (id: string, accessRoles: string[] | null, writeRoles: string[] | null) => {
    const { error } = await supabase.from("document_folders").update({ access_roles: accessRoles, write_roles: writeRoles } as any).eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Behörighet uppdaterad" });
    fetchData();
  };

  // Check if current user can write to a specific folder
  const canWriteFolder = (folderId: string): boolean => {
    if (isAdmin) return true;
    // Module-level edit/owner permission grants write access to all folders
    if (hasModuleEdit) return true;
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return false;
    if (!folder.write_roles) return false;
    return roles.some(r => folder.write_roles!.includes(r));
  };

  // ── File operations ──
  const uploadFile = async (folderId: string, file: File) => {
    if (!user) return;
    const path = `${folderId}/${Date.now()}_${file.name}`;
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
    fetchData();
  };

  const deleteFile = async (file: DocFile) => {
    await supabase.storage.from("documents").remove([file.storage_path]);
    const { error } = await supabase.from("document_files").delete().eq("id", file.id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Fil borttagen" });
    fetchData();
  };

  const moveFile = async (fileId: string, newFolderId: string) => {
    const { error } = await supabase.from("document_files").update({ folder_id: newFolderId } as any).eq("id", fileId);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Fil flyttad" });
    fetchData();
  };

  const renameFile = async (id: string, name: string) => {
    const { error } = await supabase.from("document_files").update({ name } as any).eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    fetchData();
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
    createFolder, renameFolder, deleteFolder, moveFolder, updateFolderAccess,
    uploadFile, deleteFile, moveFile, renameFile, downloadFile,
    canWriteFolder, refresh: fetchData,
  };
}
