import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";

interface Preview {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
}

// Match the same regex used in Chat.tsx linkifyText
const URL_REGEX = /(\b(?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;!?)\]}'"])/i;

function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const m = text.match(URL_REGEX);
  if (!m) return null;
  let url = m[1];
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

export function LinkPreview({ content, isOwn }: { content: string; isOwn?: boolean }) {
  const url = extractFirstUrl(content);

  const { data, isLoading } = useQuery({
    queryKey: ["link-preview", url],
    queryFn: async (): Promise<Preview | null> => {
      if (!url) return null;
      const { data, error } = await supabase.functions.invoke("link-preview", {
        body: { url },
      });
      if (error) return null;
      if (!data || data.error) return null;
      return data as Preview;
    },
    enabled: !!url,
    staleTime: 1000 * 60 * 60, // 1h client cache
    retry: false,
  });

  if (!url) return null;
  if (isLoading) {
    return (
      <div className={`mt-1.5 max-w-[320px] rounded-md border border-border bg-card/50 px-2.5 py-2 text-[11px] text-muted-foreground ${isOwn ? "ml-auto" : ""}`}>
        Hämtar förhandsgranskning…
      </div>
    );
  }
  if (!data || (!data.title && !data.description && !data.image_url)) return null;

  let host = data.site_name;
  if (!host) {
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1.5 block max-w-[340px] overflow-hidden rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors ${isOwn ? "ml-auto" : ""}`}
    >
      {data.image_url && (
        <div className="aspect-[1.91/1] w-full overflow-hidden bg-muted">
          <img
            src={data.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
          />
        </div>
      )}
      <div className="px-3 py-2">
        {host && (
          <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">
            <ExternalLink className="h-2.5 w-2.5" />
            <span className="truncate">{host}</span>
          </div>
        )}
        {data.title && (
          <div className="mt-0.5 text-[13px] font-semibold text-foreground line-clamp-2 leading-snug">
            {data.title}
          </div>
        )}
        {data.description && (
          <div className="mt-0.5 text-[12px] text-muted-foreground line-clamp-2 leading-snug">
            {data.description}
          </div>
        )}
      </div>
    </a>
  );
}
