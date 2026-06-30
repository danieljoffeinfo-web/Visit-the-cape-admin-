-- Content library (run in admin Supabase SQL editor)

CREATE TABLE IF NOT EXISTS content_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL UNIQUE,
  media_kind TEXT NOT NULL DEFAULT 'image',
  created_by_user_id UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID REFERENCES content_media(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  platform TEXT NOT NULL,
  placement TEXT NOT NULL DEFAULT 'post',
  caption TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_allocations_date_idx ON content_allocations (scheduled_date);
CREATE INDEX IF NOT EXISTS content_allocations_platform_idx ON content_allocations (platform);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-library',
  'content-library',
  true,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Content library files are publicly readable" ON storage.objects;
CREATE POLICY "Content library files are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'content-library');

DROP POLICY IF EXISTS "Content library files can be uploaded by service role" ON storage.objects;
CREATE POLICY "Content library files can be uploaded by service role"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'content-library');

DROP POLICY IF EXISTS "Content library files can be updated by service role" ON storage.objects;
CREATE POLICY "Content library files can be updated by service role"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'content-library')
WITH CHECK (bucket_id = 'content-library');

DROP POLICY IF EXISTS "Content library files can be deleted by service role" ON storage.objects;
CREATE POLICY "Content library files can be deleted by service role"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'content-library');
