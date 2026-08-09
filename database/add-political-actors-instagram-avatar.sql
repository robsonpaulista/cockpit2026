-- Foto de perfil Instagram dos candidatos monitorados (Political Actors)
-- URL pública estável no bucket Supabase Storage `instagram-avatars`
-- (CDN do Instagram expira; a coleta baixa e reenvia ao Storage).

ALTER TABLE political_actors
  ADD COLUMN IF NOT EXISTS instagram_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_avatar_path TEXT,
  ADD COLUMN IF NOT EXISTS instagram_avatar_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN political_actors.instagram_avatar_url IS
  'URL pública (Supabase Storage) da foto de perfil do Instagram';
COMMENT ON COLUMN political_actors.instagram_avatar_path IS
  'Path no bucket instagram-avatars (ex.: {slug}.jpg)';
COMMENT ON COLUMN political_actors.instagram_avatar_updated_at IS
  'Última atualização da foto de perfil (Apify details ou Graph API)';
