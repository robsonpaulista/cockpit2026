-- Instagram Radar (Apify): posts públicos por candidato monitorado (political_actors)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE political_actors
  ADD COLUMN IF NOT EXISTS instagram_username TEXT;

CREATE INDEX IF NOT EXISTS idx_political_actors_instagram_username
  ON political_actors (instagram_username)
  WHERE instagram_username IS NOT NULL;

COMMENT ON COLUMN political_actors.instagram_username IS
  'Handle do Instagram sem @ — usado na coleta Apify (Business Discovery alternativa)';

CREATE TABLE IF NOT EXISTS instagram_radar_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politico_id UUID NOT NULL REFERENCES political_actors(id) ON DELETE CASCADE,
  instagram_username TEXT NOT NULL,
  post_id TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  post_type TEXT,
  caption TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  post_url TEXT NOT NULL,
  thumbnail_url TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (politico_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_instagram_radar_posts_politico ON instagram_radar_posts(politico_id);
CREATE INDEX IF NOT EXISTS idx_instagram_radar_posts_posted ON instagram_radar_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_radar_posts_collected ON instagram_radar_posts(collected_at DESC);

CREATE TABLE IF NOT EXISTS instagram_radar_collect_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  actors_count INT NOT NULL DEFAULT 0,
  posts_found INT NOT NULL DEFAULT 0,
  posts_inserted INT NOT NULL DEFAULT 0,
  posts_updated INT NOT NULL DEFAULT 0,
  apify_run_id TEXT,
  estimated_cost_usd NUMERIC(8, 4),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_instagram_radar_collect_log_started
  ON instagram_radar_collect_log(started_at DESC);

CREATE OR REPLACE FUNCTION update_instagram_radar_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_instagram_radar_posts_updated_at ON instagram_radar_posts;
CREATE TRIGGER update_instagram_radar_posts_updated_at
  BEFORE UPDATE ON instagram_radar_posts
  FOR EACH ROW EXECUTE FUNCTION update_instagram_radar_posts_updated_at();

ALTER TABLE instagram_radar_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_radar_collect_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read instagram_radar_posts" ON instagram_radar_posts;
DROP POLICY IF EXISTS "Authenticated write instagram_radar_posts" ON instagram_radar_posts;
CREATE POLICY "Authenticated read instagram_radar_posts" ON instagram_radar_posts
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write instagram_radar_posts" ON instagram_radar_posts
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read instagram_radar_collect_log" ON instagram_radar_collect_log;
DROP POLICY IF EXISTS "Authenticated write instagram_radar_collect_log" ON instagram_radar_collect_log;
CREATE POLICY "Authenticated read instagram_radar_collect_log" ON instagram_radar_collect_log
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write instagram_radar_collect_log" ON instagram_radar_collect_log
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE instagram_radar_posts IS 'Posts públicos do Instagram coletados via Apify por candidato monitorado';
COMMENT ON TABLE instagram_radar_collect_log IS 'Log de coletas Apify — limite padrão de 1 execução a cada 7 dias';
