import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Clock, Eye } from "lucide-react";

interface KbVideo {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  category_id: string | null;
  tags: string[];
  views: number;
  duration_seconds: number | null;
  created_at: string;
}

interface Props {
  video: KbVideo;
  categoryName?: string;
  onClick: () => void;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function KbVideoCard({ video, categoryName, onClick }: Props) {
  const ytId = extractYouTubeId(video.video_url);
  const thumb = video.thumbnail_url || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null);

  return (
    <Card
      className="glass-card cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-primary/20 group"
      onClick={onClick}
    >
      <div className="relative aspect-video bg-muted">
        {thumb ? (
          <img src={thumb} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/5">
            <Play className="h-10 w-10 text-primary/40" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="h-12 w-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
            <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
          </div>
        </div>
        {video.duration_seconds && (
          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
            {formatDuration(video.duration_seconds)}
          </span>
        )}
      </div>
      <CardContent className="p-3 md:p-4">
        <h3 className="font-heading font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {video.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{video.description}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {categoryName && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{categoryName}</Badge>
          )}
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
            <Eye className="h-3 w-3" />{video.views}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
