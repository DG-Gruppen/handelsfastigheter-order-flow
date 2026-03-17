-- Create storage bucket for KB article images
INSERT INTO storage.buckets (id, name, public) VALUES ('kb-images', 'kb-images', true);

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload kb images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kb-images');

-- Allow public read access
CREATE POLICY "Public can read kb images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'kb-images');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete kb images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kb-images');
