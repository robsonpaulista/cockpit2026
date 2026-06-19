-- Google News RSS: menções em notícias por candidato monitorado (political_actors)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS google_news_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politico_id UUID NOT NULL REFERENCES political_actors(id) ON DELETE CASCADE,
  search_term TEXT NOT NULL,
  article_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_name TEXT,
  url TEXT NOT NULL,
  summary TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (politico_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_google_news_mentions_politico ON google_news_mentions(politico_id);
CREATE INDEX IF NOT EXISTS idx_google_news_mentions_published ON google_news_mentions(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_news_mentions_collected ON google_news_mentions(collected_at DESC);

CREATE OR REPLACE FUNCTION update_google_news_mentions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_google_news_mentions_updated_at ON google_news_mentions;
CREATE TRIGGER update_google_news_mentions_updated_at
  BEFORE UPDATE ON google_news_mentions
  FOR EACH ROW EXECUTE FUNCTION update_google_news_mentions_updated_at();

ALTER TABLE google_news_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read google_news_mentions" ON google_news_mentions;
DROP POLICY IF EXISTS "Authenticated write google_news_mentions" ON google_news_mentions;
CREATE POLICY "Authenticated read google_news_mentions" ON google_news_mentions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write google_news_mentions" ON google_news_mentions
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE google_news_mentions IS 'Notícias do Google News RSS por termo/candidato monitorado';
