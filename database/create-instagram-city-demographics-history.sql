-- Histórico diário de demografia Instagram por cidade (top ~45 da Meta).
-- Necessário porque follower_demographics / engaged_audience_demographics não têm série histórica nativa.

CREATE TABLE IF NOT EXISTS instagram_city_demographics_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  city_label TEXT NOT NULL,
  municipio_norm TEXT,
  followers_count INTEGER NOT NULL DEFAULT 0,
  engaged_accounts INTEGER NOT NULL DEFAULT 0,
  followers_total_account INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, snapshot_date, city_label)
);

CREATE INDEX IF NOT EXISTS idx_ig_city_demo_user_date
  ON instagram_city_demographics_history (user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_ig_city_demo_mun_date
  ON instagram_city_demographics_history (user_id, municipio_norm, snapshot_date DESC)
  WHERE municipio_norm IS NOT NULL;

ALTER TABLE instagram_city_demographics_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own city demographics"
  ON instagram_city_demographics_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own city demographics"
  ON instagram_city_demographics_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own city demographics"
  ON instagram_city_demographics_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own city demographics"
  ON instagram_city_demographics_history FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE instagram_city_demographics_history IS
  'Snapshot diário do top de cidades (seguidores + contas engajadas) para evolução no mapa IPT';
