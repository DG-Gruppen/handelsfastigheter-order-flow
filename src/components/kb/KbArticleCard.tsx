import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Eye, FileText } from "lucide-react";

interface KbArticle {
  id: string;
  title: string;
  excerpt: string;
  category_id: string | null;
  tags: string[];
  views: number;
  created_at: string;
  updated_at: string;
}

interface Props {
  article: KbArticle;
  categoryName?: string;
  onClick: () => void;
}

export default function KbArticleCard({ article, categoryName, onClick }: Props) {
  const date = new Date(article.updated_at).toLocaleDateString("sv-SE");

  return (
    <Card
      className="glass-card cursor-pointer transition-all hover:shadow-md hover:border-primary/20 group"
      onClick={onClick}
    >
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-semibold text-sm md:text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {article.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.excerpt}</p>
            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
              {categoryName && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {categoryName}
                </Badge>
              )}
              {article.tags?.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                <Clock className="h-3 w-3" />
                {date}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Eye className="h-3 w-3" />
                {article.views}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
