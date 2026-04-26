-- Se o bucket referencias já existir com MIME restrito, alargar tipos aceitos (HEIC/JPEG variantes).
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
WHERE id = 'referencias';
