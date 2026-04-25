-- ============================================================
-- MonadCert — Supabase Storage Setup
-- Run this in Supabase SQL Editor
-- ============================================================

-- Create the certificates storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificates',
  'certificates',
  true,                    -- Public bucket: URLs accessible without auth
  10485760,                -- 10MB max file size
  ARRAY[
    'application/json',
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/json',
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];


-- ============================================================
-- Storage RLS Policies
-- ============================================================

-- Allow anyone to READ (download) files from the bucket
CREATE POLICY "public_read_certificates_storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates');

-- Allow anon to INSERT (upload) files — institutions upload cert docs
-- Path restriction: only metadata/ and documents/ prefixes allowed
CREATE POLICY "anon_upload_certificates_storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'certificates'
    AND (
      name LIKE 'metadata/%'
      OR name LIKE 'documents/%'
    )
  );

-- Prevent public DELETE or UPDATE (immutability)
-- Only service_role can delete (via admin tools)
