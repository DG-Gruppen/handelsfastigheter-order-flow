
-- Document folders (hierarchical)
CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  icon text NOT NULL DEFAULT 'folder',
  access_roles text[] DEFAULT NULL,
  created_by uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Document files
CREATE TABLE public.document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Security definer function for folder access
CREATE OR REPLACE FUNCTION public.has_folder_access(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _roles text[];
BEGIN
  SELECT access_roles INTO _roles FROM public.document_folders WHERE id = _folder_id;
  IF _roles IS NULL THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role::text = ANY(_roles)
  );
END;
$$;

-- RLS: document_folders
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible folders" ON public.document_folders
  FOR SELECT TO authenticated
  USING (access_roles IS NULL OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = ANY(access_roles)) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert folders" ON public.document_folders
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update folders" ON public.document_folders
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete folders" ON public.document_folders
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- RLS: document_files
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files in accessible folders" ON public.document_files
  FOR SELECT TO authenticated USING (public.has_folder_access(auth.uid(), folder_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert files" ON public.document_files
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update files" ON public.document_files
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete files" ON public.document_files
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Storage RLS
CREATE POLICY "Authenticated users can read documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documents');

CREATE POLICY "Admins can upload documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update documents" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_document_folders_parent ON public.document_folders(parent_id);
CREATE INDEX idx_document_files_folder ON public.document_files(folder_id);

-- Triggers
CREATE TRIGGER update_document_folders_updated_at BEFORE UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_files_updated_at BEFORE UPDATE ON public.document_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
