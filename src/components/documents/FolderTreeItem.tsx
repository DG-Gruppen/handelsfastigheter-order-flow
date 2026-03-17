import { memo } from "react";
import { ChevronRight, ChevronDown, MoreHorizontal, Pencil, Trash2, FolderInput, FolderPlus, Shield, Palette } from "lucide-react";
import { getModuleIcon } from "@/lib/moduleIcons";
import type { DocFolder } from "@/hooks/useDocuments";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  folder: DocFolder;
  depth?: number;
  childrenOf: (parentId: string) => DocFolder[];
  expandedFolders: Set<string>;
  selectedFolderId: string | null;
  isAdmin: boolean;
  canWriteFolder: (folderId: string) => boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onNewFolder: (parentId: string) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, name: string) => void;
  onAccess: (folder: DocFolder) => void;
  onChangeIcon: (folder: DocFolder) => void;
  onDelete: (id: string, name: string) => void;
}

function FolderTreeItemBase({
  folder, depth = 0, childrenOf, expandedFolders, selectedFolderId,
  isAdmin, canWriteFolder, onSelect, onToggleExpand,
  onNewFolder, onRename, onMove, onAccess, onChangeIcon, onDelete,
}: Props) {
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
        onClick={() => onSelect(folder.id)}
      >
        <button
          className="shrink-0 w-4 h-4 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleExpand(folder.id); }}
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
              <DropdownMenuItem onClick={() => onNewFolder(folder.id)}>
                <FolderPlus className="w-4 h-4 mr-2" /> Ny undermapp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(folder.id, folder.name)}>
                <Pencil className="w-4 h-4 mr-2" /> Byt namn
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(folder.id, folder.name)}>
                <FolderInput className="w-4 h-4 mr-2" /> Flytta
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => onAccess(folder)}>
                  <Shield className="w-4 h-4 mr-2" /> Behörighet
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(folder.id, folder.name)}>
                <Trash2 className="w-4 h-4 mr-2" /> Ta bort
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {isExpanded && children.length > 0 && (
        <div className="ml-3 border-l border-border pl-1 space-y-0.5">
          {children.map(child => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              childrenOf={childrenOf}
              expandedFolders={expandedFolders}
              selectedFolderId={selectedFolderId}
              isAdmin={isAdmin}
              canWriteFolder={canWriteFolder}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onNewFolder={onNewFolder}
              onRename={onRename}
              onMove={onMove}
              onAccess={onAccess}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const FolderTreeItem = memo(FolderTreeItemBase);
export default FolderTreeItem;
