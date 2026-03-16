import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, Video, BookOpen, Settings2, Filter } from "lucide-react";
import KbArticleCard from "@/components/kb/KbArticleCard";
import KbVideoCard from "@/components/kb/KbVideoCard";
import KbArticleViewer from "@/components/kb/KbArticleViewer";
import KbVideoPlayer from "@/components/kb/KbVideoPlayer";
import KbAdminPanel from "@/components/kb/KbAdminPanel";

interface KbCategory { id: string; name: string; slug: string; icon: string; sort_order: number; is_active: boolean; }
interface KbArticle { id: string; title: string; slug: string; content: string; excerpt: string; category_id: string | null; tags: string[]; is_published: boolean; views: number; created_at: string; updated_at: string; author_id: string; }
interface KbVideo { id: string; title: string; description: string; video_url: string; thumbnail_url: string | null; category_id: string | null; tags: string[]; is_published: boolean; views: number; duration_seconds: number | null; created_at: string; author_id: string; }

export default function KnowledgeBase() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [videos, setVideos] = useState<KbVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const [viewArticle, setViewArticle] = useState<KbArticle | null>(null);
  const [viewVideo, setViewVideo] = useState<KbVideo | null>(null);

  const fetchData = async () => {
    const [catRes, artRes, vidRes] = await Promise.all([
      supabase.from("kb_categories").select("*").order("sort_order"),
      supabase.from("kb_articles").select("*").order("created_at", { ascending: false }),
      supabase.from("kb_videos").select("*").order("created_at", { ascending: false }),
    ]);
    setCategories((catRes.data as KbCategory[]) ?? []);
    setArticles((artRes.data as KbArticle[]) ?? []);
    setVideos((vidRes.data as KbVideo[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const filteredArticles = useMemo(() => {
    let result = articles;
    if (selectedCategory) result = result.filter(a => a.category_id === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [articles, selectedCategory, search]);

  const filteredVideos = useMemo(() => {
    let result = videos;
    if (selectedCategory) result = result.filter(v => v.category_id === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [videos, selectedCategory, search]);

  const openArticle = async (article: KbArticle) => {
    setViewArticle(article);
    // Increment views
    await supabase.from("kb_articles").update({ views: article.views + 1 } as any).eq("id", article.id);
  };

  const openVideo = async (video: KbVideo) => {
    setViewVideo(video);
    await supabase.from("kb_videos").update({ views: video.views + 1 } as any).eq("id", video.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Laddar kunskapsbasen...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shadow-sm">
            <BookOpen className="h-5.5 w-5.5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Kunskapsbanken</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Artiklar, guider och instruktionsvideor</p>
          </div>
        </div>
        {isAdmin && (
          <Button
            variant={showAdmin ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAdmin(!showAdmin)}
            className="shrink-0"
          >
            <Settings2 className="h-4 w-4 mr-1.5" />
            {showAdmin ? "Stäng admin" : "Hantera"}
          </Button>
        )}
      </div>

      {/* Admin panel */}
      {showAdmin && isAdmin && (
        <KbAdminPanel onDataChange={fetchData} />
      )}

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök artiklar och videor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge
            variant={selectedCategory === null ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            Alla
          </Badge>
          {categories.filter(c => c.is_active).map(c => (
            <Badge
              key={c.id}
              variant={selectedCategory === c.id ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedCategory(selectedCategory === c.id ? null : c.id)}
            >
              {c.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Content tabs */}
      <Tabs defaultValue="articles">
        <TabsList>
          <TabsTrigger value="articles" className="text-xs md:text-sm">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Artiklar ({filteredArticles.length})
          </TabsTrigger>
          <TabsTrigger value="videos" className="text-xs md:text-sm">
            <Video className="h-3.5 w-3.5 mr-1.5" />
            Videor ({filteredVideos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="mt-4">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {search ? "Inga artiklar matchar din sökning" : "Inga artiklar publicerade ännu"}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredArticles.map(article => (
                <KbArticleCard
                  key={article.id}
                  article={article}
                  categoryName={article.category_id ? categoryMap[article.category_id] : undefined}
                  onClick={() => openArticle(article)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="videos" className="mt-4">
          {filteredVideos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {search ? "Inga videor matchar din sökning" : "Inga videor publicerade ännu"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map(video => (
                <KbVideoCard
                  key={video.id}
                  video={video}
                  categoryName={video.category_id ? categoryMap[video.category_id] : undefined}
                  onClick={() => openVideo(video)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Viewers */}
      <KbArticleViewer article={viewArticle} open={!!viewArticle} onClose={() => setViewArticle(null)} />
      <KbVideoPlayer video={viewVideo} open={!!viewVideo} onClose={() => setViewVideo(null)} />
    </div>
  );
}
