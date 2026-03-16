import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
}

interface Props {
  video: Video | null;
  open: boolean;
  onClose: () => void;
}

function getEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  return null;
}

export default function KbVideoPlayer({ video, open, onClose }: Props) {
  if (!video) return null;
  const embedUrl = getEmbedUrl(video.video_url);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="font-heading text-base md:text-lg">{video.title}</DialogTitle>
          {video.description && (
            <p className="text-xs text-muted-foreground mt-1">{video.description}</p>
          )}
        </DialogHeader>
        <div className="aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={video.title}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-sm">
              <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="underline">
                Öppna video i nytt fönster
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
