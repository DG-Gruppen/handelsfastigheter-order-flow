import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { canRestoreKbTrash } from "@/lib/kbTrash";

export interface KbTrashItem {
  id: string;
  title: string;
  source_table: string;
  expires_at: string;
}

export default function KbTrashPanel({ items, busy, onRestore }: {
  items: KbTrashItem[];
  busy: boolean;
  onRestore: (id: string) => Promise<void>;
}) {
  const visible = items.filter(item => canRestoreKbTrash(item.expires_at));
  return <div className="space-y-2">
    <p className="text-sm text-muted-foreground">Raderat innehåll sparas i 10 dagar. Artiklar och videor återställs som utkast.</p>
    {visible.map(item => <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium break-words">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {item.source_table === "kb_articles" ? "Artikel" : item.source_table === "kb_videos" ? "Video" : "Kategori"}
          {" · Återställ senast "}{new Date(item.expires_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
        </p>
      </div>
      <Button variant="outline" disabled={busy} onClick={() => onRestore(item.id)} className="min-h-11 shrink-0">
        <RotateCcw className="mr-2 h-4 w-4" />Återställ
      </Button>
    </div>)}
    {visible.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Papperskorgen är tom</p>}
  </div>;
}