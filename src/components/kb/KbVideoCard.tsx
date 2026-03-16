import { Play, Clock, Star, Eye } from "lucide-react";

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
  const durationMin = video.duration_seconds ? Math.ceil(video.duration_seconds / 60) : null;

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-colors cursor-pointer group"
    >
      {/* Thumbnail / gradient header */}
      <div className="relative h-36 bg-gradient-to-br from-primary via-primary-glow to-accent/30 flex items-center justify-center overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <Play className="w-12 h-12 text-primary-foreground/60" />
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

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="font-heading font-semibold text-sm line-clamp-2">{video.title}</h3>
        {video.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{video.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {categoryName && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/8 text-primary">
              {categoryName}
            </span>
          )}
          {durationMin && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />{durationMin} min
            </span>
          )}
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
            <Eye className="w-3 h-3" />{video.views}
          </span>
        </div>
        <button className="w-full mt-1 text-xs font-medium bg-primary text-primary-foreground rounded-lg py-2 hover:bg-primary/90 transition-colors">
          Spela video
        </button>
      </div>
    </div>
  );
}
