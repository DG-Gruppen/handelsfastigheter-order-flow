import { BookOpen, Eye, User } from "lucide-react";

interface KbArticle {
  id: string;
  title: string;
  excerpt: string;
  category_id: string | null;
  tags: string[];
  views: number;
  created_at: string;
  updated_at: string;
  author_id: string;
}

interface CategoryColor {
  bg: string;
  text: string;
  border: string;
}

interface Props {
  article: KbArticle;
  categoryName?: string;
  categoryColor?: CategoryColor;
  authorName?: string;
  onClick: () => void;
}

export default function KbArticleCard({ article, categoryName, categoryColor, authorName, onClick }: Props) {
  const date = new Date(article.updated_at).toLocaleDateString("sv-SE");
  const borderClass = categoryColor?.border ?? "border-l-primary";

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-xl border border-border border-l-4 ${borderClass} p-4 md:p-5 hover:shadow-md hover:border-border/80 transition-all cursor-pointer group`}
    >
      <div className="flex items-start gap-3">
        <div className={`hidden md:flex items-center justify-center h-10 w-10 rounded-lg ${categoryColor?.bg ?? "bg-primary/10"} shrink-0 mt-0.5`}>
          <BookOpen className={`h-5 w-5 ${categoryColor?.text ?? "text-primary"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {categoryName && (
              <span className={`text-[10px] uppercase tracking-wider font-bold ${categoryColor?.text ?? "text-primary"} ${categoryColor?.bg ?? "bg-primary/10"} px-2 py-0.5 rounded-full`}>
                {categoryName}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">Uppdaterad {date}</span>
          </div>
          <h3 className="font-heading font-semibold text-base md:text-lg text-foreground group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.excerpt}</p>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {article.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{tag}</span>
            ))}
            <div className="flex items-center gap-3 ml-auto text-[10px] text-muted-foreground">
              {authorName && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {authorName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" /> {article.views}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
