-- Estado da coleta de comentários do Radar (cooldown semanal independente da coleta de posts).
-- Execute no Supabase depois de create-instagram-radar-comments-table.sql

CREATE TABLE IF NOT EXISTS instagram_radar_comments_collect_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_started_at TIMESTAMPTZ NOT NULL,
  last_finished_at TIMESTAMPTZ,
  last_success BOOLEAN NOT NULL DEFAULT FALSE,
  comments_found INT NOT NULL DEFAULT 0,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE instagram_radar_comments_collect_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read instagram_radar_comments_collect_state"
  ON instagram_radar_comments_collect_state;
DROP POLICY IF EXISTS "Authenticated write instagram_radar_comments_collect_state"
  ON instagram_radar_comments_collect_state;

CREATE POLICY "Authenticated read instagram_radar_comments_collect_state"
  ON instagram_radar_comments_collect_state FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write instagram_radar_comments_collect_state"
  ON instagram_radar_comments_collect_state FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE instagram_radar_comments_collect_state IS
  'Uma linha (id=1): última execução de comentários Apify. Bloqueia nova coleta por 7 dias após last_started_at.';
