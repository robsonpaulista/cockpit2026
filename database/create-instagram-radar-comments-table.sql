-- Comentários do Instagram Radar (Apify) — contas que engajaram nos posts monitorados.
-- Separado de `instagram_comments` (Graph API por usuário da app).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS instagram_radar_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politico_id UUID NOT NULL REFERENCES political_actors(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  commenter_username TEXT NOT NULL,
  commenter_id TEXT,
  comment_text TEXT,
  comment_like_count INTEGER NOT NULL DEFAULT 0,
  commented_at TIMESTAMPTZ,
  post_url TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (politico_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_instagram_radar_comments_politico
  ON instagram_radar_comments (politico_id);

CREATE INDEX IF NOT EXISTS idx_instagram_radar_comments_post
  ON instagram_radar_comments (politico_id, post_id);

CREATE INDEX IF NOT EXISTS idx_instagram_radar_comments_commenter
  ON instagram_radar_comments (politico_id, commenter_username);

CREATE INDEX IF NOT EXISTS idx_instagram_radar_comments_commented_at
  ON instagram_radar_comments (commented_at DESC);

CREATE OR REPLACE FUNCTION update_instagram_radar_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_instagram_radar_comments_updated_at ON instagram_radar_comments;
CREATE TRIGGER update_instagram_radar_comments_updated_at
  BEFORE UPDATE ON instagram_radar_comments
  FOR EACH ROW EXECUTE FUNCTION update_instagram_radar_comments_updated_at();

ALTER TABLE instagram_radar_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read instagram_radar_comments" ON instagram_radar_comments;
DROP POLICY IF EXISTS "Authenticated write instagram_radar_comments" ON instagram_radar_comments;

CREATE POLICY "Authenticated read instagram_radar_comments"
  ON instagram_radar_comments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write instagram_radar_comments"
  ON instagram_radar_comments FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE instagram_radar_comments IS
  'Comentários scrapados via Apify (instagram-scraper resultsType=comments) para contas únicas no Radar Competitivo';
