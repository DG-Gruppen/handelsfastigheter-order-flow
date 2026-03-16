import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, PlayCircle, Settings2, GraduationCap } from "lucide-react";
import KbArticleCard from "@/components/kb/KbArticleCard";
import KbVideoCard from "@/components/kb/KbVideoCard";
import KbArticleViewer from "@/components/kb/KbArticleViewer";
import KbVideoPlayer from "@/components/kb/KbVideoPlayer";
import KbAdminPanel from "@/components/kb/KbAdminPanel";

interface KbCategory { id: string; name: string; slug: string; icon: string; sort_order: number; is_active: boolean; }
interface KbArticle { id: string; title: string; slug: string; content: string; excerpt: string; category_id: string | null; tags: string[]; is_published: boolean; views: number; created_at: string; updated_at: string; author_id: string; }
interface KbVideo { id: string; title: string; description: string; video_url: string; thumbnail_url: string | null; category_id: string | null; tags: string[]; is_published: boolean; views: number; duration_seconds: number | null; created_at: string; author_id: string; }
interface Profile { user_id: string; full_name: string; }

export default function KnowledgeBase() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [videos, setVideos] = useState<KbVideo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"wiki" | "courses">("wiki");
  const [search, setSearch] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);

  const [viewArticle, setViewArticle] = useState<KbArticle | null>(null);
  const [viewVideo, setViewVideo] = useState<KbVideo | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    const [catRes, artRes, vidRes, profRes] = await Promise.all([
      supabase.from("kb_categories").select("*").order("sort_order"),
      supabase.from("kb_articles").select("*").order("created_at", { ascending: false }),
      supabase.from("kb_videos").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    setCategories((catRes.data as KbCategory[]) ?? []);
    setArticles((artRes.data as KbArticle[]) ?? []);
    setVideos((vidRes.data as KbVideo[]) ?? []);
    setProfiles((profRes.data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const debouncedRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(), 500);
    };

    const channel = supabase
      .channel("kb-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "kb_articles" }, debouncedRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "kb_videos" }, debouncedRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "kb_categories" }, debouncedRefetch)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchData]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach(p => { map[p.user_id] = p.full_name; });
    return map;
  }, [profiles]);

  const filteredArticles = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      a.tags?.some(t => t.toLowerCase().includes(q)) ||
      (a.category_id && categoryMap[a.category_id]?.toLowerCase().includes(q))
    );
  }, [articles, search, categoryMap]);

  const filteredVideos = useMemo(() => {
    if (!search.trim()) return videos;
    const q = search.toLowerCase();
    return videos.filter(v =>
      v.title.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      v.tags?.some(t => t.toLowerCase().includes(q)) ||
      (v.category_id && categoryMap[v.category_id]?.toLowerCase().includes(q))
    );
  }, [videos, search, categoryMap]);

  const openArticle = async (article: KbArticle) => {
    setViewArticle(article);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Kunskapsbanken</h1>
          <p className="text-muted-foreground mt-1 text-sm">Lär, väx och dela kunskap</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant={showAdmin ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAdmin(!showAdmin)}
            >
              <Settings2 className="h-4 w-4 mr-1.5" />
              {showAdmin ? "Stäng admin" : "Hantera"}
            </Button>
          )}
        </div>
      </div>

      {/* Admin panel */}
      {showAdmin && isAdmin && (
        <KbAdminPanel onDataChange={fetchData} />
      )}

      {/* Tabs – styled like the mockup */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("wiki")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "wiki" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:bg-card/50"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Wiki
        </button>
        <button
          onClick={() => setTab("courses")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "courses" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:bg-card/50"
          }`}
        >
          <PlayCircle className="w-4 h-4" /> Utbildningar
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === "wiki" ? "Sök i wiki-artiklar..." : "Sök utbildningar..."}
          className="pl-10 h-11"
        />
      </div>

      {/* Content */}
      {tab === "wiki" ? (
        <div className="space-y-3">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "Inga artiklar matchar din sökning" : "Inga artiklar publicerade ännu"}</p>
            </div>
          ) : (
            filteredArticles.map(article => (
              <KbArticleCard
                key={article.id}
                article={article}
                categoryName={article.category_id ? categoryMap[article.category_id] : undefined}
                authorName={profileMap[article.author_id]}
                onClick={() => openArticle(article)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <PlayCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "Inga utbildningar matchar din sökning" : "Inga utbildningar publicerade ännu"}</p>
            </div>
          ) : (
            filteredVideos.map(video => (
              <KbVideoCard
                key={video.id}
                video={video}
                categoryName={video.category_id ? categoryMap[video.category_id] : undefined}
                onClick={() => openVideo(video)}
              />
            ))
          )}
        </div>
      )}

      {/* Viewers */}
      <KbArticleViewer article={viewArticle} open={!!viewArticle} onClose={() => setViewArticle(null)} />
      <KbVideoPlayer video={viewVideo} open={!!viewVideo} onClose={() => setViewVideo(null)} />
    </div>
  );
}
