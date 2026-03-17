import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/kb/RichTextEditor";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Video, FolderOpen, Eye, EyeOff, Building2, Globe, Loader2 } from "lucide-react";

interface KbCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

interface KbArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category_id: string | null;
  tags: string[];
  is_published: boolean;
  views: number;
  created_at: string;
}

interface KbVideo {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  category_id: string | null;
  tags: string[];
  is_published: boolean;
  views: number;
  duration_seconds: number | null;
}

type DialogMode = "article" | "video" | "category" | null;

export default function KbAdminPanel({ onDataChange }: { onDataChange: () => void }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [videos, setVideos] = useState<KbVideo[]>([]);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [articleForm, setArticleForm] = useState({ title: "", content: "", excerpt: "", category_id: "", tags: "", is_published: false });
  const [videoForm, setVideoForm] = useState({ title: "", description: "", video_url: "", thumbnail_url: "", category_id: "", tags: "", is_published: false, duration_seconds: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", icon: "folder" });

  const fetchAll = async () => {
    const [catRes, artRes, vidRes] = await Promise.all([
      supabase.from("kb_categories").select("*").order("sort_order"),
      supabase.from("kb_articles").select("*").order("created_at", { ascending: false }),
      supabase.from("kb_videos").select("*").order("created_at", { ascending: false }),
    ]);
    setCategories((catRes.data as KbCategory[]) ?? []);
    setArticles((artRes.data as KbArticle[]) ?? []);
    setVideos((vidRes.data as KbVideo[]) ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const slugify = (s: string) => s.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // Category CRUD
  const openCategoryDialog = (cat?: KbCategory) => {
    if (cat) {
      setCategoryForm({ name: cat.name, slug: cat.slug, icon: cat.icon });
      setEditId(cat.id);
    } else {
      setCategoryForm({ name: "", slug: "", icon: "folder" });
      setEditId(null);
    }
    setDialogMode("category");
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) { toast.error("Ange ett namn"); return; }
    setSubmitting(true);
    const slug = categoryForm.slug || slugify(categoryForm.name);
    if (editId) {
      await supabase.from("kb_categories").update({ name: categoryForm.name, slug, icon: categoryForm.icon } as any).eq("id", editId);
      toast.success("Kategori uppdaterad");
    } else {
      await supabase.from("kb_categories").insert({ name: categoryForm.name, slug, icon: categoryForm.icon } as any);
      toast.success("Kategori skapad");
    }
    setDialogMode(null);
    setSubmitting(false);
    fetchAll();
    onDataChange();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("kb_categories").delete().eq("id", id);
    toast.success("Kategori borttagen");
    fetchAll();
    onDataChange();
  };

  // Article CRUD
  const openArticleDialog = (art?: KbArticle) => {
    if (art) {
      setArticleForm({
        title: art.title, content: art.content, excerpt: art.excerpt,
        category_id: art.category_id ?? "", tags: art.tags?.join(", ") ?? "", is_published: art.is_published
      });
      setEditId(art.id);
    } else {
      setArticleForm({ title: "", content: "", excerpt: "", category_id: "", tags: "", is_published: false });
      setEditId(null);
    }
    setDialogMode("article");
  };

  const saveArticle = async () => {
    if (!articleForm.title.trim()) { toast.error("Ange en titel"); return; }
    setSubmitting(true);
    const payload = {
      title: articleForm.title.trim(),
      slug: slugify(articleForm.title),
      content: articleForm.content,
      excerpt: articleForm.excerpt || articleForm.content.replace(/<[^>]*>/g, "").slice(0, 150),
      category_id: articleForm.category_id || null,
      tags: articleForm.tags.split(",").map(t => t.trim()).filter(Boolean),
      is_published: articleForm.is_published,
      author_id: user!.id,
    };
    if (editId) {
      const { author_id, ...updatePayload } = payload;
      await supabase.from("kb_articles").update(updatePayload as any).eq("id", editId);
      toast.success("Artikel uppdaterad");
    } else {
      await supabase.from("kb_articles").insert(payload as any);
      toast.success("Artikel skapad");
    }
    setDialogMode(null);
    setSubmitting(false);
    fetchAll();
    onDataChange();
  };

  const deleteArticle = async (id: string) => {
    await supabase.from("kb_articles").delete().eq("id", id);
    toast.success("Artikel borttagen");
    fetchAll();
    onDataChange();
  };

  const toggleArticlePublish = async (id: string, current: boolean) => {
    await supabase.from("kb_articles").update({ is_published: !current } as any).eq("id", id);
    fetchAll();
    onDataChange();
  };

  // Video CRUD
  const openVideoDialog = (vid?: KbVideo) => {
    if (vid) {
      setVideoForm({
        title: vid.title, description: vid.description, video_url: vid.video_url,
        thumbnail_url: vid.thumbnail_url ?? "", category_id: vid.category_id ?? "",
        tags: vid.tags?.join(", ") ?? "", is_published: vid.is_published,
        duration_seconds: vid.duration_seconds?.toString() ?? "",
      });
      setEditId(vid.id);
    } else {
      setVideoForm({ title: "", description: "", video_url: "", thumbnail_url: "", category_id: "", tags: "", is_published: false, duration_seconds: "" });
      setEditId(null);
    }
    setDialogMode("video");
  };

  const saveVideo = async () => {
    if (!videoForm.title.trim() || !videoForm.video_url.trim()) { toast.error("Ange titel och video-URL"); return; }
    setSubmitting(true);
    const payload = {
      title: videoForm.title.trim(),
      description: videoForm.description,
      video_url: videoForm.video_url.trim(),
      thumbnail_url: videoForm.thumbnail_url || null,
      category_id: videoForm.category_id || null,
      tags: videoForm.tags.split(",").map(t => t.trim()).filter(Boolean),
      is_published: videoForm.is_published,
      duration_seconds: videoForm.duration_seconds ? parseInt(videoForm.duration_seconds) : null,
      author_id: user!.id,
    };
    if (editId) {
      const { author_id, ...updatePayload } = payload;
      await supabase.from("kb_videos").update(updatePayload as any).eq("id", editId);
      toast.success("Video uppdaterad");
    } else {
      await supabase.from("kb_videos").insert(payload as any);
      toast.success("Video skapad");
    }
    setDialogMode(null);
    setSubmitting(false);
    fetchAll();
    onDataChange();
  };

  const deleteVideo = async (id: string) => {
    await supabase.from("kb_videos").delete().eq("id", id);
    toast.success("Video borttagen");
    fetchAll();
    onDataChange();
  };

  const toggleVideoPublish = async (id: string, current: boolean) => {
    await supabase.from("kb_videos").update({ is_published: !current } as any).eq("id", id);
    fetchAll();
    onDataChange();
  };

  // Scraping states
  const [scrapingWebsite, setScrapingWebsite] = useState(false);
  const [scrapingAllabolag, setScrapingAllabolag] = useState(false);

  const scrapeWebsite = async () => {
    setScrapingWebsite(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-website", {
        body: { url: "https://www.handelsfastigheter.se", limit: 50 },
      });
      if (error) throw error;
      toast.success(`Webbplats indexerad: ${data.indexed} sidor`);
    } catch (e: any) {
      toast.error(e.message || "Kunde inte skrapa webbplatsen");
    } finally {
      setScrapingWebsite(false);
    }
  };

  const scrapeAllabolag = async () => {
    setScrapingAllabolag(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-allabolag");
      if (error) throw error;
      toast.success(`Allabolag indexerat: ${data.indexed} bolag`);
      if (data.companies?.length) {
        console.log("Indexed companies:", data.companies);
      }
    } catch (e: any) {
      toast.error(e.message || "Kunde inte skrapa Allabolag");
    } finally {
      setScrapingAllabolag(false);
    }
  };

  return (
    <>
      {/* AI Data Sources Card */}
      <Card className="glass-card border-t-2 border-t-primary/40 mb-4">
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="font-heading text-base md:text-lg text-primary">AI-datakällor</CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6 space-y-3">
          <p className="text-xs text-muted-foreground">Uppdatera AI-assistentens kunskapsbas genom att skrapa externa datakällor.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={scrapeWebsite} disabled={scrapingWebsite}>
              {scrapingWebsite ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
              {scrapingWebsite ? "Skrapar..." : "Skrapa handelsfastigheter.se"}
            </Button>
            <Button size="sm" variant="outline" onClick={scrapeAllabolag} disabled={scrapingAllabolag}>
              {scrapingAllabolag ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5 mr-1.5" />}
              {scrapingAllabolag ? "Skrapar..." : "Skrapa Allabolag (koncernen)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-t-2 border-t-accent/40">
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="font-heading text-base md:text-lg text-accent">Hantera kunskapsbasen</CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <Tabs defaultValue="articles">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="articles" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1.5" />Artiklar ({articles.length})</TabsTrigger>
              <TabsTrigger value="videos" className="text-xs"><Video className="h-3.5 w-3.5 mr-1.5" />Videor ({videos.length})</TabsTrigger>
              <TabsTrigger value="categories" className="text-xs"><FolderOpen className="h-3.5 w-3.5 mr-1.5" />Kategorier ({categories.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="articles" className="space-y-2">
              <Button size="sm" onClick={() => openArticleDialog()} className="mb-2">
                <Plus className="h-3.5 w-3.5 mr-1" />Ny artikel
              </Button>
              {articles.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2.5 bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {categories.find(c => c.id === a.category_id)?.name ?? "Ingen kategori"}
                    </p>
                  </div>
                  <Badge variant={a.is_published ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {a.is_published ? "Publicerad" : "Utkast"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleArticlePublish(a.id, a.is_published)}>
                    {a.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openArticleDialog(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteArticle(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {articles.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Inga artiklar ännu</p>}
            </TabsContent>

            <TabsContent value="videos" className="space-y-2">
              <Button size="sm" onClick={() => openVideoDialog()} className="mb-2">
                <Plus className="h-3.5 w-3.5 mr-1" />Ny video
              </Button>
              {videos.map((v) => (
                <div key={v.id} className="flex items-center gap-2 rounded-lg border p-2.5 bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.video_url}</p>
                  </div>
                  <Badge variant={v.is_published ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {v.is_published ? "Publicerad" : "Utkast"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleVideoPublish(v.id, v.is_published)}>
                    {v.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openVideoDialog(v)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteVideo(v.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {videos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Inga videor ännu</p>}
            </TabsContent>

            <TabsContent value="categories" className="space-y-2">
              <Button size="sm" onClick={() => openCategoryDialog()} className="mb-2">
                <Plus className="h-3.5 w-3.5 mr-1" />Ny kategori
              </Button>
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border p-2.5 bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.name}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCategoryDialog(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCategory(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {categories.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Inga kategorier ännu</p>}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Article Dialog */}
      <Dialog open={dialogMode === "article"} onOpenChange={(v) => !v && setDialogMode(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Redigera artikel" : "Ny artikel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input value={articleForm.title} onChange={e => setArticleForm(f => ({ ...f, title: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Sammanfattning</Label>
              <Input value={articleForm.excerpt} onChange={e => setArticleForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Kort beskrivning..." className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Innehåll</Label>
              <RichTextEditor
                content={articleForm.content}
                onChange={(html) => setArticleForm(f => ({ ...f, content: html }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={articleForm.category_id} onValueChange={v => setArticleForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Välj kategori" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taggar (kommaseparerade)</Label>
                <Input value={articleForm.tags} onChange={e => setArticleForm(f => ({ ...f, tags: e.target.value }))} placeholder="guide, microsoft, teams" className="h-11" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={articleForm.is_published} onCheckedChange={v => setArticleForm(f => ({ ...f, is_published: v }))} />
              <Label className="text-sm">Publicera direkt</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogMode(null)}>Avbryt</Button>
            <Button onClick={saveArticle} disabled={submitting}>{submitting ? "Sparar..." : "Spara"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={dialogMode === "video"} onOpenChange={(v) => !v && setDialogMode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Redigera video" : "Ny video"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input value={videoForm.title} onChange={e => setVideoForm(f => ({ ...f, title: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Video-URL * (YouTube/Vimeo)</Label>
              <Input value={videoForm.video_url} onChange={e => setVideoForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Beskrivning</Label>
              <Textarea value={videoForm.description} onChange={e => setVideoForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={videoForm.category_id} onValueChange={v => setVideoForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Välj kategori" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Längd (sekunder)</Label>
                <Input type="number" value={videoForm.duration_seconds} onChange={e => setVideoForm(f => ({ ...f, duration_seconds: e.target.value }))} className="h-11" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Taggar (kommaseparerade)</Label>
              <Input value={videoForm.tags} onChange={e => setVideoForm(f => ({ ...f, tags: e.target.value }))} className="h-11" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={videoForm.is_published} onCheckedChange={v => setVideoForm(f => ({ ...f, is_published: v }))} />
              <Label className="text-sm">Publicera direkt</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogMode(null)}>Avbryt</Button>
            <Button onClick={saveVideo} disabled={submitting}>{submitting ? "Sparar..." : "Spara"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={dialogMode === "category"} onOpenChange={(v) => !v && setDialogMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editId ? "Redigera kategori" : "Ny kategori"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Namn *</Label>
              <Input value={categoryForm.name} onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Slug (auto-genereras)</Label>
              <Input value={categoryForm.slug} onChange={e => setCategoryForm(f => ({ ...f, slug: e.target.value }))} placeholder="auto" className="h-11" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogMode(null)}>Avbryt</Button>
            <Button onClick={saveCategory} disabled={submitting}>{submitting ? "Sparar..." : "Spara"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
