import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, PlayCircle, GraduationCap, Sparkles } from "lucide-react";
import KbArticleCard from "@/components/kb/KbArticleCard";
import KbVideoCard from "@/components/kb/KbVideoCard";
import KbArticleViewer from "@/components/kb/KbArticleViewer";
import KbVideoPlayer from "@/components/kb/KbVideoPlayer";

interface KbCategory { id: string; name: string; slug: string; icon: string; sort_order: number; is_active: boolean; }
interface KbArticle { id: string; title: string; slug: string; content: string; excerpt: string; category_id: string | null; tags: string[]; is_published: boolean; views: number; created_at: string; updated_at: string; author_id: string; }
interface KbVideo { id: string; title: string; description: string; video_url: string; thumbnail_url: string | null; category_id: string | null; tags: string[]; is_published: boolean; views: number; duration_seconds: number | null; created_at: string; author_id: string; }
interface Profile { user_id: string; full_name: string; }

// SHF category color palette mapped by index
const CATEGORY_COLORS = [
  { bg: "bg-primary/10", text: "text-primary", border: "border-l-primary" },
  { bg: "bg-accent/10", text: "text-accent", border: "border-l-accent" },
  { bg: "bg-destructive/10", text: "text-destructive", border: "border-l-destructive" },
  { bg: "bg-[hsl(262,30%,45%)]/10", text: "text-[hsl(262,30%,45%)]", border: "border-l-[hsl(262,30%,45%)]" },
  { bg: "bg-primary/10", text: "text-primary", border: "border-l-primary" },
  { bg: "bg-accent/10", text: "text-accent", border: "border-l-accent" },
];

export default function KnowledgeBase() {
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [videos, setVideos] = useState<KbVideo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"wiki" | "courses">("wiki");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  const categoryColorMap = useMemo(() => {
    const map: Record<string, typeof CATEGORY_COLORS[0]> = {};
    categories.forEach((c, i) => { map[c.id] = CATEGORY_COLORS[i % CATEGORY_COLORS.length]; });
    return map;
  }, [categories]);

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach(p => { map[p.user_id] = p.full_name; });
    return map;
  }, [profiles]);

  const filteredArticles = useMemo(() => {
    let result = articles;
    if (selectedCategory) result = result.filter(a => a.category_id === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.tags?.some(t => t.toLowerCase().includes(q)) ||
        (a.category_id && categoryMap[a.category_id]?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [articles, search, categoryMap, selectedCategory]);

  const filteredVideos = useMemo(() => {
    let result = videos;
    if (selectedCategory) result = result.filter(v => v.category_id === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.tags?.some(t => t.toLowerCase().includes(q)) ||
        (v.category_id && categoryMap[v.category_id]?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [videos, search, categoryMap, selectedCategory]);

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl gradient-primary px-6 py-8 md:px-10 md:py-10">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/20 -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/10 translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-6 w-6 text-primary-foreground/80" />
            <span className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wider">SHF Kunskapsbanken</span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground">
            Lär, väx och dela kunskap
          </h1>
          <p className="text-primary-foreground/70 mt-2 text-sm max-w-lg">
            Utforska wiki-artiklar och utbildningsvideor – samlad kompetens för hela organisationen.
          </p>
        </div>

        {/* Stats row */}
        <div className="relative flex gap-3 md:gap-6 mt-6">
          <div className="flex items-center gap-1.5 md:gap-2">
            <BookOpen className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground/60 shrink-0" />
            <span className="text-primary-foreground/90 text-xs md:text-sm font-medium whitespace-nowrap">{articles.length} artiklar</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <PlayCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground/60 shrink-0" />
            <span className="text-primary-foreground/90 text-xs md:text-sm font-medium whitespace-nowrap">{videos.length} utbildningar</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground/60 shrink-0" />
            <span className="text-primary-foreground/90 text-xs md:text-sm font-medium whitespace-nowrap">{categories.length} kategorier</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("wiki")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "wiki" ? "bg-card shadow-sm text-primary font-semibold" : "text-muted-foreground hover:bg-card/50"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Wiki
        </button>
        <button
          onClick={() => setTab("courses")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "courses" ? "bg-card shadow-sm text-primary font-semibold" : "text-muted-foreground hover:bg-card/50"
          }`}
        >
          <PlayCircle className="w-4 h-4" /> Utbildningar
        </button>
      </div>

      {/* Search + category filter */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "wiki" ? "Sök i wiki-artiklar..." : "Sök utbildningar..."}
            className="pl-10 h-11"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
                !selectedCategory
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              }`}
            >
              Alla
            </button>
            {categories.filter(c => c.is_active).map((cat) => {
              const colors = categoryColorMap[cat.id];
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(isActive ? null : cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
                    isActive
                      ? `${colors.bg} ${colors.text} ring-1 ring-current`
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      {tab === "wiki" ? (
        <div className="space-y-3">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search || selectedCategory ? "Inga artiklar matchar din sökning" : "Inga artiklar publicerade ännu"}</p>
            </div>
          ) : (
            filteredArticles.map(article => (
              <KbArticleCard
                key={article.id}
                article={article}
                categoryName={article.category_id ? categoryMap[article.category_id] : undefined}
                categoryColor={article.category_id ? categoryColorMap[article.category_id] : undefined}
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
              <p className="text-sm">{search || selectedCategory ? "Inga utbildningar matchar din sökning" : "Inga utbildningar publicerade ännu"}</p>
            </div>
          ) : (
            filteredVideos.map(video => (
              <KbVideoCard
                key={video.id}
                video={video}
                categoryName={video.category_id ? categoryMap[video.category_id] : undefined}
                categoryColor={video.category_id ? categoryColorMap[video.category_id] : undefined}
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
