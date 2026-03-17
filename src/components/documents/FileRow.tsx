import { memo } from "react";
import { Eye, Download, MoreHorizontal, Pencil, Trash2, FolderInput } from "lucide-react";
import type { DocFile } from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatFileSize, getFileIcon, canPreview } from "./documentHelpers";

interface Props {
  file: DocFile;
  isSelected: boolean;
  canWrite: boolean;
  onToggleSelect: (fileId: string) => void;
  onPreview: (file: DocFile) => void;
  onDownload: (file: DocFile) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
}

function FileRowBase({
  file, isSelected, canWrite,
  onToggleSelect, onPreview, onDownload, onRename, onMove, onDelete,
}: Props) {
  const previewable = canPreview(file.mime_type);

  return (
    <div className={`group flex items-center gap-3 px-4 py-3 rounded-md text-sm transition-colors border ${
      isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-secondary/50 border-transparent hover:border-border"
    }`}>
      {canWrite && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(file.id)}
          className="shrink-0"
        />
      )}
      <span className="text-lg shrink-0">{getFileIcon(file.mime_type)}</span>
      <div
        className={`flex-1 min-w-0 ${previewable ? "cursor-pointer" : ""}`}
        onClick={() => previewable && onPreview(file)}
      >
        <p className="truncate font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString("sv-SE")}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {previewable && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPreview(file)} title="Förhandsvisa">
            <Eye className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDownload(file)} title="Ladda ner">
          <Download className="w-4 h-4" />
        </Button>
        {canWrite && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onRename(file.id, file.name)}>
                <Pencil className="w-4 h-4 mr-2" /> Byt namn
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(file.id, file.name)}>
                <FolderInput className="w-4 h-4 mr-2" /> Flytta till mapp
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(file.id, file.name)}>
                <Trash2 className="w-4 h-4 mr-2" /> Ta bort
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

const FileRow = memo(FileRowBase);
export default FileRow;
