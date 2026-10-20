import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NEWS_VIDEO_BUCKET } from "@/lib/newsVideo";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

export default function NewsVideoPlayer({ path, title }: { path: string; title: string }) {
  const [playbackError, setPlaybackError] = useState(false);
  const { data: url, isLoading, error, refetch } = useQuery({
    queryKey: ["news-video-url", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(NEWS_VIDEO_BUCKET).createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) throw error ?? new Error("Videon kunde inte öppnas.");
      return data.signedUrl;
    },
    staleTime: 30 * 60 * 1000,
  });
  return (
    <div className="w-full space-y-2" onClick={event => event.stopPropagation()}>
      {isLoading ? (
        <div className="aspect-video flex items-center justify-center bg-muted rounded-md"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Laddar video" /></div>
      ) : error || playbackError ? (
        <div className="aspect-video flex flex-col gap-3 items-center justify-center bg-muted rounded-md text-sm text-muted-foreground">
          <p>Videon kunde inte spelas upp.</p>
          <Button variant="outline" onClick={() => { setPlaybackError(false); refetch(); }}><RefreshCw className="h-4 w-4 mr-2" />Försök igen</Button>
        </div>
      ) : url ? (
        <video key={url} src={url} controls playsInline preload="metadata" aria-label={title} onError={() => setPlaybackError(true)} className="w-full aspect-video rounded-md bg-muted object-contain" />
      ) : null}
    </div>
  );
}