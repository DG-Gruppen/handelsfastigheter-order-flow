import { Clock, ThumbsUp, ThumbsDown } from "lucide-react";

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

interface Props {
  article: KbArticle;
  categoryName?: string;
  authorName?: string;
  onClick: () => void;
}

export default function KbArticleCard({ article, categoryName, authorName, onClick }: Props) {
  const date = new Date(article.updated_at).toLocaleDateString("sv-SE");

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl border border-border p-4 md:p-5 hover:border-primary/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-2">
        {categoryName && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-full">
            {categoryName}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">Uppdaterad {date}</span>
      </div>
      <h3 className="font-heading font-semibold text-base md:text-lg text-foreground">{article.title}</h3>
      {article.excerpt && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.excerpt}</p>
      )}
      {authorName && (
        <p className="text-xs text-muted-foreground mt-1">Skriven av {authorName}</p>
      )}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {article.tags?.slice(0, 3).map((tag) => (
          <span key={tag} className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{tag}</span>
        ))}
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
          <ThumbsUp className="w-3 h-3" /> {article.views}
        </span>
      </div>
    </div>
  );
}
