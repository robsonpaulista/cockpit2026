-- Meta Ads Library (Playwright): anúncios políticos por candidato monitorado (political_actors)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS meta_ads_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politico_id UUID NOT NULL REFERENCES political_actors(id) ON DELETE CASCADE,
  search_term TEXT NOT NULL,
  library_ad_id TEXT NOT NULL,
  page_name TEXT,
  page_id TEXT,
  ad_body TEXT,
  library_url TEXT NOT NULL,
  platforms TEXT,
  started_running_at TIMESTAMPTZ,
  ended_running_at TIMESTAMPTZ,
  is_active BOOLEAN,
  payer_name TEXT,
  spend_text TEXT,
  spend_min_brl NUMERIC,
  spend_max_brl NUMERIC,
  impressions_text TEXT,
  audience_size_text TEXT,
  ads_in_group INT,
  target_locations_text TEXT,
  target_locations JSONB,
  delivery_by_region_text TEXT,
  delivery_by_region JSONB,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (politico_id, library_ad_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_mentions_politico ON meta_ads_mentions(politico_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_mentions_started ON meta_ads_mentions(started_running_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_ads_mentions_collected ON meta_ads_mentions(collected_at DESC);

CREATE TABLE IF NOT EXISTS meta_ads_collect_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  actors_count INT NOT NULL DEFAULT 0,
  ads_found INT NOT NULL DEFAULT 0,
  ads_inserted INT NOT NULL DEFAULT 0,
  ads_updated INT NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_collect_log_started ON meta_ads_collect_log(started_at DESC);

CREATE OR REPLACE FUNCTION update_meta_ads_mentions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_meta_ads_mentions_updated_at ON meta_ads_mentions;
CREATE TRIGGER update_meta_ads_mentions_updated_at
  BEFORE UPDATE ON meta_ads_mentions
  FOR EACH ROW EXECUTE FUNCTION update_meta_ads_mentions_updated_at();

ALTER TABLE meta_ads_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_collect_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read meta_ads_mentions" ON meta_ads_mentions;
DROP POLICY IF EXISTS "Authenticated write meta_ads_mentions" ON meta_ads_mentions;
CREATE POLICY "Authenticated read meta_ads_mentions" ON meta_ads_mentions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write meta_ads_mentions" ON meta_ads_mentions
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read meta_ads_collect_log" ON meta_ads_collect_log;
DROP POLICY IF EXISTS "Authenticated write meta_ads_collect_log" ON meta_ads_collect_log;
CREATE POLICY "Authenticated read meta_ads_collect_log" ON meta_ads_collect_log
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write meta_ads_collect_log" ON meta_ads_collect_log
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE meta_ads_mentions IS 'Anúncios políticos da Meta Ads Library por termo/candidato monitorado';
COMMENT ON TABLE meta_ads_collect_log IS 'Log de coletas Playwright — limite de 1 execução por 24h';

