import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RichTextEditor from "@/components/kb/RichTextEditor";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Pin, Search, ChevronLeft, ChevronRight } from "lucide-react";

interface NewsArticle {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  category: string;
  emoji: string;
  is_pinned: boolean;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  source?: string;
}

const EMOJI_OPTIONS = ["📰", "📊", "🏗️", "🌱", "🏆", "👤", "💼", "🎉", "📢", "🔔"];
const CATEGORY_OPTIONS = ["Nyhet", "Rapport", "Förvärv", "Finans", "Hållbarhet", "Personal", "Projekt", "Event"];
const PAGE_SIZES = [10, 20, 30] as const;

export default function NewsAdminPanel({ onDataChange }: { onDataChange: () => void }) {
  const { user } = useAuth();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "", body: "", excerpt: "", category: "Nyhet", emoji: "📰",
    is_pinned: false, is_published: false,
  });

  // Filter & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchArticles = async () => {
    const { data } = await supabase
      .from("news" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setArticles((data as any[]) ?? []);
  };

  useEffect(() => { fetchArticles(); }, []);

  // Filtered articles
  const filtered = useMemo(() => {
    let result = articles;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => a.title.toLowerCase().includes(q) || a.excerpt?.toLowerCase().includes(q));
    }
    if (filterCategory !== "all") {
      result = result.filter(a => a.category === filterCategory);
    }
    if (filterStatus === "published") result = result.filter(a => a.is_published);
    else if (filterStatus === "draft") result = result.filter(a => !a.is_published);
    return result;
  }, [articles, searchQuery, filterCategory, filterStatus]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterCategory, filterStatus, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openDialog = (art?: NewsArticle) => {
    if (art) {
      setForm({
        title: art.title, body: art.body, excerpt: art.excerpt,
        category: art.category, emoji: art.emoji,
        is_pinned: art.is_pinned, is_published: art.is_published,
      });
      setEditId(art.id);
    } else {
      setForm({ title: "", body: "", excerpt: "", category: "Nyhet", emoji: "📰", is_pinned: false, is_published: false });
      setEditId(null);
    }
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Ange en titel"); return; }
    setSubmitting(true);
    const payload = {
      ...form,
      excerpt: form.excerpt || form.body.replace(/<[^>]*>/g, "").slice(0, 200),
      author_id: user!.id,
      published_at: form.is_published ? new Date().toISOString() : null,
    };
    if (editId) {
      const { author_id, ...update } = payload;
      await supabase.from("news" as any).update(update).eq("id", editId);
      toast.success("Nyhet uppdaterad");
    } else {
      await supabase.from("news" as any).insert(payload);
      toast.success("Nyhet skapad");
    }
    setDialogOpen(false);
    setSubmitting(false);
    fetchArticles();
    onDataChange();
  };

  const deleteArticle = async (id: string) => {
    await supabase.from("news" as any).delete().eq("id", id);
    toast.success("Nyhet borttagen");
    fetchArticles();
    onDataChange();
  };

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from("news" as any).update({
      is_published: !current,
      published_at: !current ? new Date().toISOString() : null,
    } as any).eq("id", id);
    fetchArticles();
    onDataChange();
  };

  // Unique categories from data
  const availableCategories = useMemo(() => {
    const cats = new Set(articles.map(a => a.category));
    return Array.from(cats).sort();
  }, [articles]);

  return (
    <>
      <Card className="glass-card border-t-2 border-t-accent/40">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base md:text-lg text-accent">Hantera nyheter</CardTitle>
            <Button size="sm" onClick={() => openDialog()}>
              <Plus className="h-3.5 w-3.5 mr-1" />Ny nyhet
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Sök titel..."
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla kategorier</SelectItem>
                {availableCategories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px] h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla status</SelectItem>
                <SelectItem value="published">Publicerad</SelectItem>
                <SelectItem value="draft">Utkast</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="px-4 md:px-6 space-y-2">
          {paginated.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2.5 bg-card">
              <span className="text-lg shrink-0">{a.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.title}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground">{a.category}</p>
                  {a.source === "cision" && (
                    <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Cision</span>
                  )}
                </div>
              </div>
              {a.is_pinned && <Pin className="h-3 w-3 text-accent shrink-0" />}
              <Badge variant={a.is_published ? "default" : "secondary"} className="text-[10px] shrink-0">
                {a.is_published ? "Publicerad" : "Utkast"}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePublish(a.id, a.is_published)}>
                {a.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(a)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteArticle(a.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchQuery || filterCategory !== "all" || filterStatus !== "all" ? "Inga nyheter matchar filtren" : "Inga nyheter ännu"}
            </p>
          )}

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Visa</span>
                <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[70px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map(s => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  av {filtered.length} nyheter
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Redigera nyhet" : "Ny nyhet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Sammanfattning</Label>
              <Input value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Kort beskrivning..." className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Innehåll</Label>
              <RichTextEditor content={form.body} onChange={(html) => setForm(f => ({ ...f, body: html }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Emoji</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, emoji: e }))}
                      className={`text-lg p-1 rounded ${form.emoji === e ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-secondary"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_published} onCheckedChange={v => setForm(f => ({ ...f, is_published: v }))} />
                <Label>Publicerad</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_pinned} onCheckedChange={v => setForm(f => ({ ...f, is_pinned: v }))} />
                <Label>Pinnad</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
            <Button onClick={save} disabled={submitting}>{submitting ? "Sparar..." : "Spara"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
