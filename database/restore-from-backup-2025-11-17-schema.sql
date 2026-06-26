-- =============================================================================
-- Restauração de schema — backup Supabase 17/11/2025
-- Arquivo origem: scripts/db_cluster-17-11-2025@02-49-17.backup.gz
--
-- App: sincronização de fotos do Google Drive + reconhecimento facial
-- Tabelas: users, photos, photo_tags, face_descriptors, persons, sync_events
--
-- ATENÇÃO: `public.users` NÃO é auth.users — guarda OAuth Google do app de fotos.
-- O schema principal do Cockpit 2026 está em database/schema.sql e migrações.
--
-- Como aplicar (novo projeto Supabase):
--   1. SQL Editor → colar e executar este arquivo
--   2. Para dados: ver database/README-restore-from-backup.md
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Funções
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_person_photo_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.person_id IS NOT NULL THEN
      UPDATE public.persons
      SET photo_count = (
        SELECT COUNT(DISTINCT photo_id)
        FROM public.face_descriptors
        WHERE person_id = NEW.person_id
      )
      WHERE id = NEW.person_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.person_id IS NOT NULL THEN
      UPDATE public.persons
      SET photo_count = (
        SELECT COUNT(DISTINCT photo_id)
        FROM public.face_descriptors
        WHERE person_id = OLD.person_id
      )
      WHERE id = OLD.person_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_photo_stats(p_user_id text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'with_faces', COUNT(*) FILTER (WHERE faces_detected > 0),
    'analyzed', COUNT(*) FILTER (WHERE analyzed = true),
    'with_location', COUNT(*) FILTER (WHERE gps_lat IS NOT NULL AND gps_lng IS NOT NULL),
    'by_year', (
      SELECT json_object_agg(event_year, count)
      FROM (
        SELECT event_year, COUNT(*) AS count
        FROM public.photos
        WHERE user_id = p_user_id AND event_year IS NOT NULL
        GROUP BY event_year
        ORDER BY event_year DESC
      ) years
    ),
    'by_city', (
      SELECT json_object_agg(event_city, count)
      FROM (
        SELECT event_city, COUNT(*) AS count
        FROM public.photos
        WHERE user_id = p_user_id AND event_city IS NOT NULL
        GROUP BY event_city
        ORDER BY count DESC
        LIMIT 10
      ) cities
    ),
    'by_type', (
      SELECT json_object_agg(event_type, count)
      FROM (
        SELECT event_type, COUNT(*) AS count
        FROM public.photos
        WHERE user_id = p_user_id AND event_type IS NOT NULL
        GROUP BY event_type
        ORDER BY count DESC
      ) types
    )
  ) INTO result
  FROM public.photos
  WHERE user_id = p_user_id;

  RETURN result;
END;
$$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id text NOT NULL UNIQUE,
  email text NOT NULL,
  name text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.users IS 'Usuários OAuth Google do app de fotos (não confundir com auth.users)';

CREATE TABLE IF NOT EXISTS public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id text NOT NULL UNIQUE,
  name text NOT NULL,
  mime_type text NOT NULL,
  width integer,
  height integer,
  size_bytes bigint,
  created_at timestamptz,
  modified_at timestamptz,
  gps_lat double precision,
  gps_lng double precision,
  location_name text,
  person_tag text,
  joy_likelihood text,
  sorrow_likelihood text,
  anger_likelihood text,
  surprise_likelihood text,
  faces_detected integer DEFAULT 0,
  storage_url text,
  thumbnail_url text,
  analyzed boolean DEFAULT false,
  user_id text NOT NULL,
  indexed_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  event_year integer,
  event_month integer,
  event_city text,
  event_type text,
  folder_path text,
  role_tag text
);

COMMENT ON TABLE public.photos IS 'Metadados e análises das fotos do Google Drive';

CREATE TABLE IF NOT EXISTS public.photo_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid REFERENCES public.photos(id) ON DELETE CASCADE,
  tag text NOT NULL,
  tag_type text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.photo_tags IS 'Tags personalizadas associadas às fotos';

CREATE TABLE IF NOT EXISTS public.persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.persons IS 'Pessoas identificadas no sistema';

CREATE TABLE IF NOT EXISTS public.face_descriptors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid REFERENCES public.photos(id) ON DELETE CASCADE,
  face_vector double precision[],
  bounding_box jsonb,
  person_id uuid REFERENCES public.persons(id) ON DELETE SET NULL,
  confidence double precision DEFAULT 0.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.face_descriptors IS 'Vetores faciais para reconhecimento (Face-API.js, 128 dims)';

CREATE TABLE IF NOT EXISTS public.sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  status text NOT NULL,
  photos_processed integer DEFAULT 0,
  photos_added integer DEFAULT 0,
  photos_updated integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

COMMENT ON TABLE public.sync_events IS 'Histórico de sincronizações com o Google Drive';

-- -----------------------------------------------------------------------------
-- View
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.photos_with_tags AS
SELECT
  p.id,
  p.drive_id,
  p.name,
  p.mime_type,
  p.width,
  p.height,
  p.size_bytes,
  p.created_at,
  p.modified_at,
  p.gps_lat,
  p.gps_lng,
  p.location_name,
  p.person_tag,
  p.joy_likelihood,
  p.sorrow_likelihood,
  p.anger_likelihood,
  p.surprise_likelihood,
  p.faces_detected,
  p.storage_url,
  p.thumbnail_url,
  p.analyzed,
  p.user_id,
  p.indexed_at,
  p.updated_at,
  array_agg(DISTINCT pt.tag) FILTER (WHERE pt.tag IS NOT NULL) AS tags
FROM public.photos p
LEFT JOIN public.photo_tags pt ON p.id = pt.photo_id
GROUP BY p.id;

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_face_descriptors_person_id ON public.face_descriptors (person_id);
CREATE INDEX IF NOT EXISTS idx_face_descriptors_photo_id ON public.face_descriptors (photo_id);
CREATE INDEX IF NOT EXISTS idx_persons_name ON public.persons (name);
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo_id ON public.photo_tags (photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_tag ON public.photo_tags (tag);
CREATE INDEX IF NOT EXISTS idx_photos_analyzed ON public.photos (analyzed);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON public.photos (created_at);
CREATE INDEX IF NOT EXISTS idx_photos_drive_id ON public.photos (drive_id);
CREATE INDEX IF NOT EXISTS idx_photos_event_city ON public.photos (event_city);
CREATE INDEX IF NOT EXISTS idx_photos_event_month ON public.photos (event_month);
CREATE INDEX IF NOT EXISTS idx_photos_event_type ON public.photos (event_type);
CREATE INDEX IF NOT EXISTS idx_photos_event_year ON public.photos (event_year);
CREATE INDEX IF NOT EXISTS idx_photos_joy_likelihood ON public.photos (joy_likelihood);
CREATE INDEX IF NOT EXISTS idx_photos_location ON public.photos (gps_lat, gps_lng);
CREATE INDEX IF NOT EXISTS idx_photos_person_tag ON public.photos (person_tag);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON public.photos (user_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_status ON public.sync_events (status);
CREATE INDEX IF NOT EXISTS idx_sync_events_user_id ON public.sync_events (user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users (google_id);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS update_face_descriptors_updated_at ON public.face_descriptors;
CREATE TRIGGER update_face_descriptors_updated_at
  BEFORE UPDATE ON public.face_descriptors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_person_photo_count_trigger ON public.face_descriptors;
CREATE TRIGGER update_person_photo_count_trigger
  AFTER INSERT OR DELETE OR UPDATE ON public.face_descriptors
  FOR EACH ROW EXECUTE FUNCTION public.update_person_photo_count();

DROP TRIGGER IF EXISTS update_persons_updated_at ON public.persons;
CREATE TRIGGER update_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_photos_updated_at ON public.photos;
CREATE TRIGGER update_photos_updated_at
  BEFORE UPDATE ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
