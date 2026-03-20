-- Trigger function for departments
CREATE OR REPLACE FUNCTION public.index_department()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'departments' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.content_index (source_table, source_id, title, content, metadata, updated_at)
  VALUES ('departments', NEW.id, NEW.name,
          'Avdelning: ' || NEW.name,
          jsonb_build_object('color', NEW.color, 'parent_id', NEW.parent_id), now())
  ON CONFLICT (source_table, source_id)
  DO UPDATE SET title = excluded.title, content = excluded.content,
                metadata = excluded.metadata, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_index_departments
AFTER INSERT OR UPDATE OR DELETE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.index_department();

-- Trigger function for document_folders
CREATE OR REPLACE FUNCTION public.index_document_folder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'document_folders' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.content_index (source_table, source_id, title, content, metadata, updated_at)
  VALUES ('document_folders', NEW.id, NEW.name,
          'Dokumentmapp: ' || NEW.name,
          jsonb_build_object('icon', NEW.icon, 'parent_id', NEW.parent_id), now())
  ON CONFLICT (source_table, source_id)
  DO UPDATE SET title = excluded.title, content = excluded.content,
                metadata = excluded.metadata, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_index_document_folders
AFTER INSERT OR UPDATE OR DELETE ON public.document_folders
FOR EACH ROW EXECUTE FUNCTION public.index_document_folder();

-- Trigger function for document_files
CREATE OR REPLACE FUNCTION public.index_document_file()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'document_files' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.content_index (source_table, source_id, title, content, metadata, updated_at)
  VALUES ('document_files', NEW.id, NEW.name,
          'Dokument "' || NEW.name || '" (typ: ' || NEW.mime_type || ')',
          jsonb_build_object('folder_id', NEW.folder_id, 'mime_type', NEW.mime_type), now())
  ON CONFLICT (source_table, source_id)
  DO UPDATE SET title = excluded.title, content = excluded.content,
                metadata = excluded.metadata, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_index_document_files
AFTER INSERT OR UPDATE OR DELETE ON public.document_files
FOR EACH ROW EXECUTE FUNCTION public.index_document_file();