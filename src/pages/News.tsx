import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useModulePermission } from "@/hooks/useModulePermission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Newspaper, Globe, Pin, Loader2, ExternalLink } from "lucide-react";
import NewsAdminPanel from "@/components/news/NewsAdminPanel";

/* ── Types ── */
interface InternalNews {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  category: string;
  emoji: string;
  is_pinned: boolean;
  published_at: string;
}

interface CisionRelease {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  published_at: string;
  image_url?: string;
}

/* ── Component ── */
export default function News() {
  const { canEdit } = useModulePermission("nyheter");
  const [internalNews, setInternalNews] = useState<InternalNews[]>([]);
  const [cisionReleases, setCisionReleases] = useState<CisionRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [cisionLoading, setCisionLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<InternalNews | null>(null);

  const fetchInternal = useCallback(async () => {
    const { data } = await supabase
      .from("news" as any)
      .select("*")
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false });
    setInternalNews((data as any[]) ?? []);
    setLoading(false);
  }, []);

  const fetchCision = useCallback(async () => {
    setCisionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-cision-feed");
      if (error) throw error;
      setCisionReleases(data?.releases ?? []);
    } catch (e) {
      console.error("Cision feed error:", e);
    } finally {
      setCisionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInternal();
    fetchCision();
  }, [fetchInternal, fetchCision]);

  const filteredInternal = internalNews.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.excerpt.toLowerCase().includes(search.toLowerCase()) ||
      n.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCision = cisionReleases.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.excerpt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Nyheter</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Interna nyheter och pressmeddelanden</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök nyheter..."
            className="pl-9 h-10"
          />
        </div>
      </div>

      <Tabs defaultValue="internal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="internal" className="gap-1.5">
            <Newspaper className="h-4 w-4" />
            Interna nyheter ({filteredInternal.length})
          </TabsTrigger>
          <TabsTrigger value="cision" className="gap-1.5">
            <Globe className="h-4 w-4" />
            Pressmeddelanden ({filteredCision.length})
          </TabsTrigger>
          {canEdit && (
            <TabsTrigger value="admin" className="gap-1.5">Hantera</TabsTrigger>
          )}
        </TabsList>

        {/* ── Internal News ── */}
        <TabsContent value="internal" className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInternal.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Inga publicerade nyheter</p>
          ) : (
            filteredInternal.map((news) => (
              <Card
                key={news.id}
                className={`glass-card cursor-pointer hover:shadow-md transition-all ${news.is_pinned ? "border-l-4 border-l-accent" : ""}`}
                onClick={() => setSelectedArticle(news)}
              >
                <CardContent className="p-4 md:p-5">
                  <div className="flex gap-4">
                    <span className="text-2xl shrink-0">{news.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold">
                          {news.category}
                        </Badge>
                        {news.is_pinned && (
                          <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-bold text-accent">
                            <Pin className="h-3 w-3" /> Pinnad
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(news.published_at).toLocaleDateString("sv-SE")}
                        </span>
                      </div>
                      <h3 className="text-sm md:text-base font-semibold text-foreground">{news.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{news.excerpt}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Cision Releases ── */}
        <TabsContent value="cision" className="space-y-3">
          {cisionLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCision.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Inga pressmeddelanden hittades</p>
          ) : (
            filteredCision.map((release) => (
              <Card key={release.id} className="glass-card hover:shadow-md transition-all">
                <CardContent className="p-4 md:p-5">
                  <div className="flex gap-4">
                    {release.image_url ? (
                      <img
                        src={release.image_url}
                        alt=""
                        className="h-16 w-24 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-24 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Globe className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold text-primary border-primary/30">
                          Cision
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(release.published_at).toLocaleDateString("sv-SE")}
                        </span>
                      </div>
                      <h3 className="text-sm md:text-base font-semibold text-foreground">{release.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{release.excerpt}</p>
                      {release.url && (
                        <a
                          href={release.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Läs på Cision <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Admin Panel ── */}
        {canEdit && (
          <TabsContent value="admin">
            <NewsAdminPanel onDataChange={fetchInternal} />
          </TabsContent>
        )}
      </Tabs>

      {/* ── Article Detail Dialog ── */}
      <Dialog open={!!selectedArticle} onOpenChange={(v) => !v && setSelectedArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{selectedArticle.emoji}</span>
                  <Badge variant="secondary" className="text-[10px]">{selectedArticle.category}</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(selectedArticle.published_at).toLocaleDateString("sv-SE")}
                  </span>
                </div>
                <DialogTitle className="font-heading text-xl">{selectedArticle.title}</DialogTitle>
              </DialogHeader>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: selectedArticle.body }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
