-- Consultas e tópicos relacionados (Google Trends) por candidato/termo
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS google_trends_related (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politico_id UUID REFERENCES political_actors(id) ON DELETE SET NULL,
  search_term TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('query', 'topic')),
  bucket TEXT NOT NULL CHECK (bucket IN ('top', 'rising')),
  label TEXT NOT NULL,
  value_score NUMERIC,
  formatted_value TEXT,
  explore_link TEXT,
  rank SMALLINT NOT NULL CHECK (rank >= 1),
  geo TEXT NOT NULL DEFAULT 'BR-PI',
  timeframe TEXT NOT NULL DEFAULT 'today 3-m',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (search_term, kind, bucket, rank, geo, timeframe)
);

CREATE INDEX IF NOT EXISTS idx_google_trends_related_term ON google_trends_related(search_term);
CREATE INDEX IF NOT EXISTS idx_google_trends_related_politico ON google_trends_related(politico_id);
CREATE INDEX IF NOT EXISTS idx_google_trends_related_geo_tf ON google_trends_related(geo, timeframe);

ALTER TABLE google_trends_related ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read google_trends_related" ON google_trends_related;
DROP POLICY IF EXISTS "Authenticated write google_trends_related" ON google_trends_related;
CREATE POLICY "Authenticated read google_trends_related" ON google_trends_related
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write google_trends_related" ON google_trends_related
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE google_trends_related IS 'Consultas e tópicos relacionados do Google Trends (período completo, não por dia)';
