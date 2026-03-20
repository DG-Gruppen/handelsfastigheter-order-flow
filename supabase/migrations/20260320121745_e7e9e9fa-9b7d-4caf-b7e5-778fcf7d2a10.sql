
-- Trigger function for news articles
CREATE OR REPLACE FUNCTION public.index_news()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'news' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.is_published = true THEN
    INSERT INTO public.content_index (source_table, source_id, title, content, metadata, updated_at)
    VALUES ('news', NEW.id, NEW.title, NEW.excerpt || E'\n' || NEW.body,
            jsonb_build_object('category', NEW.category, 'emoji', NEW.emoji, 'published_at', NEW.published_at), now())
    ON CONFLICT (source_table, source_id)
    DO UPDATE SET title = excluded.title, content = excluded.content,
                  metadata = excluded.metadata, updated_at = now();
  ELSE
    DELETE FROM public.content_index WHERE source_table = 'news' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_index_news
AFTER INSERT OR UPDATE OR DELETE ON public.news
FOR EACH ROW EXECUTE FUNCTION public.index_news();

-- Trigger function for CEO blog
CREATE OR REPLACE FUNCTION public.index_ceo_blog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'ceo_blog' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.content_index (source_table, source_id, title, content, metadata, updated_at)
  VALUES ('ceo_blog', NEW.id, NEW.title, NEW.excerpt,
          jsonb_build_object('author', NEW.author, 'period', NEW.period), now())
  ON CONFLICT (source_table, source_id)
  DO UPDATE SET title = excluded.title, content = excluded.content,
                metadata = excluded.metadata, updated_at = now();
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_index_ceo_blog
AFTER INSERT OR UPDATE OR DELETE ON public.ceo_blog
FOR EACH ROW EXECUTE FUNCTION public.index_ceo_blog();

-- Trigger function for tools
CREATE OR REPLACE FUNCTION public.index_tools()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'tools' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.is_active = true THEN
    INSERT INTO public.content_index (source_table, source_id, title, content, metadata, updated_at)
    VALUES ('tools', NEW.id, NEW.name, NEW.description,
            jsonb_build_object('url', NEW.url, 'emoji', NEW.emoji), now())
    ON CONFLICT (source_table, source_id)
    DO UPDATE SET title = excluded.title, content = excluded.content,
                  metadata = excluded.metadata, updated_at = now();
  ELSE
    DELETE FROM public.content_index WHERE source_table = 'tools' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_index_tools
AFTER INSERT OR UPDATE OR DELETE ON public.tools
FOR EACH ROW EXECUTE FUNCTION public.index_tools();
