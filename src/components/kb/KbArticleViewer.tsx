import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, Eye, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Article {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  tags: string[];
  views: number;
  created_at: string;
  updated_at: string;
}

interface Props {
  article: Article | null;
  open: boolean;
  onClose: () => void;
}

export default function KbArticleViewer({ article, open, onClose }: Props) {
  if (!article) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <DialogTitle className="font-heading text-lg md:text-xl">{article.title}</DialogTitle>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {article.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
            ))}
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <Clock className="h-3 w-3" />
              {new Date(article.updated_at).toLocaleDateString("sv-SE")}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />{article.views}
            </span>
          </div>
        </DialogHeader>
        <div
          className="prose prose-sm max-w-none mt-4 text-foreground
            prose-headings:font-heading prose-headings:text-foreground
            prose-p:text-muted-foreground prose-li:text-muted-foreground
            prose-strong:text-foreground prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </DialogContent>
    </Dialog>
  );
}
