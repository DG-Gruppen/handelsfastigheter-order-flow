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
  // Microsoft Stream (new share links)
  const streamMatch = url.match(/microsoft\.com\/video\/([a-f0-9-]+)/i);
  if (streamMatch) return `https://web.microsoftstream.com/embed/video/${streamMatch[1]}?autoplay=true`;
  // Microsoft Stream / SharePoint embedded video
  if (/sharepoint\.com.*\/:v:\//.test(url)) {
    const spUrl = new URL(url);
    return `${spUrl.origin}${spUrl.pathname}?embed=1`;
  }
  // Google Drive
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  return null;
}

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

export default function KbVideoPlayer({ video, open, onClose }: Props) {
  if (!video) return null;
  const embedUrl = getEmbedUrl(video.video_url);
  const isDirect = !embedUrl && isDirectVideoUrl(video.video_url);
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
          ) : isDirect ? (
            <video
              src={video.video_url}
              className="w-full h-full"
              controls
              autoPlay
              title={video.title}
            />
          ) : (
            <iframe
              src={video.video_url}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={video.title}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
