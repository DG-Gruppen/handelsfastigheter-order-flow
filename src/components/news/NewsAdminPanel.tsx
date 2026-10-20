import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import NewsVideoPlayer from "@/components/news/NewsVideoPlayer";
import { NEWS_VIDEO_BUCKET, uploadNewsVideo, validateNewsVideo } from "@/lib/newsVideo";
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
import { Plus, Pencil, Trash2, Eye, EyeOff, Pin, Search, ChevronLeft, ChevronRight, Video, Upload, X } from "lucide-react";

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
  video_path?: string | null;
}

const EMOJI_OPTIONS = ["📰", "📊", "🏗️", "🌱", "🏆", "👤", "💼", "🎉", "📢", "🔔"];
const CATEGORY_OPTIONS = ["Nyhet", "Rapport", "Förvärv", "Finans", "Hållbarhet", "Personal", "Projekt", "Event"];
const PAGE_SIZES = [10, 20, 30] as const;

export default function NewsAdminPanel({ onDataChange }: { onDataChange: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  useEffect(() => {
    if (!videoFile) { setLocalVideoUrl(null); return; }
    const url = URL.createObjectURL(videoFile);
    setLocalVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);
  const refreshNews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["news-articles"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-latest-news"] }),
    ]);
    await fetchArticles();
    onDataChange();
  };
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
    setVideoFile(null);
    setVideoPath(art?.video_path ?? null);
    setUploadProgress(null);
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
    if (!user) { toast.error("Logga in igen"); return; }
    setSubmitting(true);
    let uploadedPath: string | null = null;
    try {
      if (videoFile) {
        setUploadProgress(0);
        uploadedPath = await uploadNewsVideo(videoFile, user.id, setUploadProgress);
      }
      const savedPath = uploadedPath ?? videoPath;
      const payload = {
        ...form,
        video_path: savedPath,
        excerpt: form.excerpt || form.body.replace(/<[^>]*>/g, "").slice(0, 200),
        author_id: user.id,
        published_at: form.is_published ? new Date().toISOString() : null,
      };
      const { author_id, ...update } = payload;
      const result = editId
        ? await supabase.from("news").update(update).eq("id", editId).select("id").single()
        : await supabase.from("news").insert(payload).select("id").single();
      if (result.error || !result.data?.id) throw result.error ?? new Error("Nyheten kunde inte sparas.");
      const oldPath = articles.find(article => article.id === editId)?.video_path;
      if (oldPath && oldPath !== savedPath) await supabase.storage.from(NEWS_VIDEO_BUCKET).remove([oldPath]);
      toast.success(editId ? "Nyhet uppdaterad" : "Nyhet skapad");
      setDialogOpen(false);
      setVideoFile(null);
      await refreshNews();
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(NEWS_VIDEO_BUCKET).remove([uploadedPath]);
      toast.error(error instanceof Error ? error.message : "Nyheten kunde inte sparas. Försök igen.");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const deleteArticle = async (id: string) => {
    await supabase.from("news" as any).delete().eq("id", id);
    toast.success("Nyhet borttagen");
    fetchArticles();
    onDataChange();
  };

  const togglePublish = async (id: string, current: boolean) => {
    const { data, error } = await supabase.from("news").update({
      is_published: !current,
      published_at: !current ? new Date().toISOString() : null,
    }).eq("id", id).select("id").single();
    if (error || !data) { toast.error("Publiceringen kunde inte ändras."); return; }
    await refreshNews();
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
              {a.video_path && <Video className="h-4 w-4 text-primary shrink-0" aria-label="Video" />}
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

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && !submitting && setDialogOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" onEscapeKeyDown={e => submitting && e.preventDefault()} onInteractOutside={e => submitting && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editId ? "Redigera nyhet" : "Ny nyhet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <fieldset disabled={submitting} className="space-y-4">
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
              <div className="col-span-2 space-y-2">
                <Label>Video (MP4, max 500 MB)</Label>
                <input ref={fileInput} type="file" accept=".mp4,video/mp4" aria-label="Välj MP4-video" className="hidden" onChange={event => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const error = validateNewsVideo(file);
                  if (error) { toast.error(error); return; }
                  setVideoFile(file);
                }} />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4 mr-2" />{videoFile || videoPath ? "Byt video" : "Lägg till video"}</Button>
                  {(videoFile || videoPath) && <Button type="button" variant="ghost" size="icon" className="h-11 w-11" title="Ta bort video" aria-label="Ta bort video" onClick={() => { setVideoFile(null); setVideoPath(null); }}><X className="h-4 w-4" /></Button>}
                  {videoFile && <span className="text-sm text-muted-foreground break-all">{videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</span>}
                </div>
                {localVideoUrl ? <video src={localVideoUrl} controls playsInline preload="metadata" className="w-full aspect-video rounded-md bg-muted object-contain" /> : videoPath ? <NewsVideoPlayer path={videoPath} title={form.title} /> : null}
                {uploadProgress !== null && <div role="status" className="text-sm text-muted-foreground">Laddar upp video… {uploadProgress}%<progress value={uploadProgress} max={100} className="block w-full mt-2" /></div>}
              </div>
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
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={submitting} onClick={() => setDialogOpen(false)}>Avbryt</Button>
            <Button onClick={save} disabled={submitting}>{submitting ? "Sparar..." : "Spara"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
