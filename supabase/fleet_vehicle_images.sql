-- Fleet vehicle images (run in admin Supabase SQL editor)
ALTER TABLE tour_products ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fleet-vehicles',
  'fleet-vehicles',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read access for fleet vehicle photos (required even when bucket is public).
DROP POLICY IF EXISTS "Fleet vehicle images are publicly readable" ON storage.objects;
CREATE POLICY "Fleet vehicle images are publicly readable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'fleet-vehicles');

-- Service role uploads from the admin API.
DROP POLICY IF EXISTS "Fleet vehicle images can be uploaded by service role" ON storage.objects;
CREATE POLICY "Fleet vehicle images can be uploaded by service role"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'fleet-vehicles');

DROP POLICY IF EXISTS "Fleet vehicle images can be updated by service role" ON storage.objects;
CREATE POLICY "Fleet vehicle images can be updated by service role"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'fleet-vehicles')
WITH CHECK (bucket_id = 'fleet-vehicles');
