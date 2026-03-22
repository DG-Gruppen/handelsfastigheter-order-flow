import { useEffect, useState, useMemo } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Newspaper, Globe, Pin, ExternalLink, Megaphone, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Types ── */
interface NewsArticle {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  category: string;
  emoji: string;
  is_pinned: boolean;
  published_at: string;
  source: string;
  source_url: string | null;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Nyhet: { bg: "bg-primary/10", text: "text-primary" },
  Rapport: { bg: "bg-accent/10", text: "text-accent" },
  Pressmeddelande: { bg: "bg-primary/10", text: "text-primary" },
  Förvärv: { bg: "bg-[hsl(262,30%,45%)]/10", text: "text-[hsl(262,30%,45%)]" },
  Finans: { bg: "bg-green-600/10", text: "text-green-700 dark:text-green-400" },
  Hållbarhet: { bg: "bg-emerald-600/10", text: "text-emerald-700 dark:text-emerald-400" },
  Personal: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" },
  Projekt: { bg: "bg-blue-600/10", text: "text-blue-700 dark:text-blue-400" },
  Event: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400" },
};

const PAGE_SIZE_OPTIONS = [10, 20, 30] as const;

async function fetchNewsArticles(): Promise<NewsArticle[]> {
  const { data } = await supabase
    .from("news" as any)
    .select("*")
    .eq("is_published", true)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });
  return (data as any[]) ?? [];
}

/* ── Component ── */
export default function News() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | "internal" | "press">("all");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const { data: articles = [], isLoading: loading } = useQuery({
    queryKey: ["news-articles"],
    queryFn: fetchNewsArticles,
  });

  // Trigger Cision sync in background, refetch if new items imported
  useEffect(() => {
    supabase.functions.invoke("fetch-cision-feed")
      .then((res) => {
        if (res?.data?.sync?.imported > 0) {
          queryClient.invalidateQueries({ queryKey: ["news-articles"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-latest-news"] });
        }
      })
      .catch(() => {});
  }, [queryClient]);

  /* ── Derived data ── */
  const categories = useMemo(() => {
    const cats = new Set(articles.map((n) => n.category));
    return Array.from(cats).sort();
  }, [articles]);

  const internalCount = useMemo(() => articles.filter((a) => a.source !== "cision").length, [articles]);
  const pressCount = useMemo(() => articles.filter((a) => a.source === "cision").length, [articles]);

  const filtered = useMemo(() => {
    let result = articles;
    if (tab === "internal") result = result.filter((n) => n.source !== "cision");
    if (tab === "press") result = result.filter((n) => n.source === "cision");
    if (selectedCategory) result = result.filter((n) => n.category === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.excerpt.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [articles, tab, search, selectedCategory]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [tab, search, selectedCategory, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-2xl gradient-primary px-6 py-8 md:px-10 md:py-10">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/20 -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/10 translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="h-6 w-6 text-primary-foreground/80" />
            <span className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wider">SHF Nyheter</span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground">
            Nyheter & pressmeddelanden
          </h1>
          <p className="text-primary-foreground/70 mt-2 text-sm max-w-lg">
            Interna nyheter från organisationen och pressmeddelanden via Cision.
          </p>
        </div>

        {/* Stats row */}
        <div className="relative flex gap-3 md:gap-6 mt-6">
          <div className="flex items-center gap-1.5 md:gap-2">
            <Newspaper className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground/60 shrink-0" />
            <span className="text-primary-foreground/90 text-xs md:text-sm font-medium whitespace-nowrap">
              {internalCount} interna
            </span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground/60 shrink-0" />
            <span className="text-primary-foreground/90 text-xs md:text-sm font-medium whitespace-nowrap">
              {pressCount} pressmeddelanden
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("all")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
            tab === "all" ? "bg-card shadow-sm text-primary font-semibold" : "text-muted-foreground hover:bg-card/50"
          }`}
        >
          Alla
        </button>
        <button
          onClick={() => setTab("internal")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
            tab === "internal" ? "bg-card shadow-sm text-primary font-semibold" : "text-muted-foreground hover:bg-card/50"
          }`}
        >
          <Newspaper className="w-4 h-4" /> Internt
        </button>
        <button
          onClick={() => setTab("press")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
            tab === "press" ? "bg-card shadow-sm text-primary font-semibold" : "text-muted-foreground hover:bg-card/50"
          }`}
        >
          <Globe className="w-4 h-4" /> Press
        </button>
      </div>

      {/* ── Search + category filter ── */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "internal" ? "Sök interna nyheter..." : tab === "press" ? "Sök pressmeddelanden..." : "Sök bland nyheter..."}
            className="pl-10 h-12 md:h-11"
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
            {categories.map((cat) => {
              const colors = CATEGORY_COLORS[cat] ?? { bg: "bg-secondary", text: "text-secondary-foreground" };
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(isActive ? null : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
                    isActive
                      ? `${colors.bg} ${colors.text} ring-1 ring-current`
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── News list ── */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search || selectedCategory ? "Inga nyheter matchar din sökning" : "Inga nyheter ännu"}</p>
          </div>
        ) : (
          paginated.map((news) => {
            const colors = CATEGORY_COLORS[news.category] ?? { bg: "bg-secondary", text: "text-secondary-foreground" };
            const isCision = news.source === "cision";
            return (
              <Card
                key={news.id}
                className={`cursor-pointer hover:shadow-md active:scale-[0.99] transition-all border-l-4 ${
                  news.is_pinned ? "border-l-accent" : "border-l-transparent"
                }`}
                onClick={() => setSelectedArticle(news)}
              >
                <CardContent className="p-4 md:p-5">
                  <div className="flex gap-3 md:gap-4">
                    <span className="text-2xl shrink-0 mt-0.5">{news.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[10px] uppercase tracking-wider font-bold ${colors.text} ${colors.bg} px-2 py-0.5 rounded-full`}>
                          {news.category}
                        </span>
                        {isCision && (
                          <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            <Globe className="h-2.5 w-2.5" /> Cision
                          </span>
                        )}
                        {news.is_pinned && (
                          <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                            <Pin className="h-2.5 w-2.5" /> Pinnad
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(news.published_at).toLocaleDateString("sv-SE")}
                        </span>
                      </div>
                      <h3 className="text-sm md:text-base font-semibold text-foreground leading-snug">{news.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{news.excerpt}</p>
                      {isCision && news.source_url && (
                        <a
                          href={news.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 min-h-[36px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Läs på Cision <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Visa</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="w-[70px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">per sida</span>
              <span className="text-xs text-muted-foreground ml-2">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} av {filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("ellipsis");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "ellipsis" ? (
                    <span key={`e${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  )
                )}
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Article Detail Dialog ── */}
      <Dialog open={!!selectedArticle} onOpenChange={(v) => !v && setSelectedArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-2xl">{selectedArticle.emoji}</span>
                  <Badge variant="secondary" className="text-[10px]">{selectedArticle.category}</Badge>
                  {selectedArticle.source === "cision" && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Globe className="h-2.5 w-2.5" /> Cision
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(selectedArticle.published_at).toLocaleDateString("sv-SE")}
                  </span>
                </div>
                <DialogTitle className="font-heading text-xl">{selectedArticle.title}</DialogTitle>
              </DialogHeader>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedArticle.body) }}
              />
              {selectedArticle.source === "cision" && selectedArticle.source_url && (
                <a
                  href={selectedArticle.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
                >
                  Läs hela pressmeddelandet på Cision <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
