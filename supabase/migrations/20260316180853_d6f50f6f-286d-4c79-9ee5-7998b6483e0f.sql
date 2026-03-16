
-- Function: notify all authenticated users about new document files
CREATE OR REPLACE FUNCTION public.notify_new_document_file()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _folder_name text;
  _uploader_name text;
  _target_user record;
BEGIN
  SELECT name INTO _folder_name FROM public.document_folders WHERE id = NEW.folder_id;
  SELECT full_name INTO _uploader_name FROM public.profiles WHERE user_id = NEW.created_by LIMIT 1;

  FOR _target_user IN
    SELECT DISTINCT p.user_id FROM public.profiles p
    WHERE p.user_id != NEW.created_by
      AND has_folder_access(p.user_id, NEW.folder_id)
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      _target_user.user_id,
      'Nytt dokument',
      COALESCE(_uploader_name, 'Någon') || ' laddade upp "' || NEW.name || '" i ' || COALESCE(_folder_name, 'dokument'),
      'document_new',
      NEW.folder_id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_document_file
AFTER INSERT ON public.document_files
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_document_file();

-- Function: notify all users when a KB article is published
CREATE OR REPLACE FUNCTION public.notify_kb_article_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _author_name text;
  _target_user record;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.is_published = true) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_published = false THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO _author_name FROM public.profiles WHERE user_id = NEW.author_id LIMIT 1;

  FOR _target_user IN
    SELECT DISTINCT p.user_id FROM public.profiles p
    WHERE p.user_id != NEW.author_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      _target_user.user_id,
      'Ny artikel i kunskapsbanken',
      COALESCE(_author_name, 'Någon') || ' publicerade "' || NEW.title || '"',
      'kb_article',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_kb_article_published
AFTER INSERT OR UPDATE OF is_published ON public.kb_articles
FOR EACH ROW
EXECUTE FUNCTION public.notify_kb_article_published();

-- Function: notify all users when a KB video is published
CREATE OR REPLACE FUNCTION public.notify_kb_video_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _author_name text;
  _target_user record;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.is_published = true) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_published = false THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO _author_name FROM public.profiles WHERE user_id = NEW.author_id LIMIT 1;

  FOR _target_user IN
    SELECT DISTINCT p.user_id FROM public.profiles p
    WHERE p.user_id != NEW.author_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      _target_user.user_id,
      'Ny video i kunskapsbanken',
      COALESCE(_author_name, 'Någon') || ' publicerade "' || NEW.title || '"',
      'kb_video',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_kb_video_published
AFTER INSERT OR UPDATE OF is_published ON public.kb_videos
FOR EACH ROW
EXECUTE FUNCTION public.notify_kb_video_published();
