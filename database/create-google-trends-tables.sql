-- Google Trends: interesse de busca por nome/tema (complementa political_actors)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS google_trends_interest (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politico_id UUID REFERENCES political_actors(id) ON DELETE SET NULL,
  search_term TEXT NOT NULL,
  interest_date DATE NOT NULL,
  interest_score SMALLINT NOT NULL CHECK (interest_score >= 0 AND interest_score <= 100),
  geo TEXT NOT NULL DEFAULT 'BR-PI',
  timeframe TEXT NOT NULL DEFAULT 'today 3-m',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (search_term, interest_date, geo, timeframe)
);

CREATE INDEX IF NOT EXISTS idx_google_trends_interest_date ON google_trends_interest(interest_date DESC);
CREATE INDEX IF NOT EXISTS idx_google_trends_interest_term ON google_trends_interest(search_term);
CREATE INDEX IF NOT EXISTS idx_google_trends_interest_politico ON google_trends_interest(politico_id);
CREATE INDEX IF NOT EXISTS idx_google_trends_interest_geo_tf ON google_trends_interest(geo, timeframe);

ALTER TABLE google_trends_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read google_trends_interest" ON google_trends_interest;
DROP POLICY IF EXISTS "Authenticated write google_trends_interest" ON google_trends_interest;
CREATE POLICY "Authenticated read google_trends_interest" ON google_trends_interest
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write google_trends_interest" ON google_trends_interest
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE google_trends_interest IS 'Série temporal de interesse no Google Trends por termo (trendsearch / Node)';
