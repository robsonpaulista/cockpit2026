-- Temas em alta no Google Trends (trendingNow) — feed de oportunidades de conteúdo
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS google_trending_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collected_at TIMESTAMPTZ NOT NULL,
  geo TEXT NOT NULL DEFAULT 'BR',
  hours SMALLINT NOT NULL DEFAULT 24 CHECK (hours IN (4, 24, 48, 168)),
  rank SMALLINT NOT NULL CHECK (rank >= 1),
  keyword TEXT NOT NULL,
  traffic INTEGER,
  traffic_growth_rate DOUBLE PRECISION,
  related_keywords TEXT[] NOT NULL DEFAULT '{}',
  active_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (collected_at, geo, hours, rank)
);

CREATE INDEX IF NOT EXISTS idx_google_trending_topics_collected
  ON google_trending_topics (collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_trending_topics_geo_hours
  ON google_trending_topics (geo, hours, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_trending_topics_keyword
  ON google_trending_topics (keyword);

ALTER TABLE google_trending_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read google_trending_topics" ON google_trending_topics;
DROP POLICY IF EXISTS "Authenticated write google_trending_topics" ON google_trending_topics;
CREATE POLICY "Authenticated read google_trending_topics" ON google_trending_topics
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write google_trending_topics" ON google_trending_topics
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE google_trending_topics IS
  'Snapshots de trendingNow (Google Trends) por geo/janela — histórico próprio da API que não persiste nativamente';
