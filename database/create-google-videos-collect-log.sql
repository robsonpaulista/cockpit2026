-- Log de coletas Google Vídeos (Apify) — cooldown padrão de 7 dias (como Instagram Radar)
CREATE TABLE IF NOT EXISTS google_videos_collect_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  terms_count INT NOT NULL DEFAULT 0,
  videos_found INT NOT NULL DEFAULT 0,
  videos_inserted INT NOT NULL DEFAULT 0,
  videos_updated INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(8, 4),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_google_videos_collect_log_started
  ON google_videos_collect_log(started_at DESC);

ALTER TABLE google_videos_collect_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read google_videos_collect_log" ON google_videos_collect_log;
DROP POLICY IF EXISTS "Authenticated write google_videos_collect_log" ON google_videos_collect_log;
CREATE POLICY "Authenticated read google_videos_collect_log" ON google_videos_collect_log
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write google_videos_collect_log" ON google_videos_collect_log
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE google_videos_collect_log IS
  'Log de coletas Apify Google Vídeos — limite padrão de 1 execução a cada 7 dias';
