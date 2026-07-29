-- Visitas ao perfil do Instagram informadas manualmente
-- (a Graph API descontinuou profile_views em série temporal em jan/2025).
-- Separada de instagram_metrics_history para o snapshot automático não sobrescrever.

CREATE TABLE IF NOT EXISTS instagram_profile_visits_manual (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  visits INTEGER NOT NULL DEFAULT 0 CHECK (visits >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, visit_date)
);

CREATE INDEX IF NOT EXISTS idx_ig_profile_visits_manual_user_date
  ON instagram_profile_visits_manual (user_id, visit_date DESC);

ALTER TABLE instagram_profile_visits_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile visits manual"
  ON instagram_profile_visits_manual FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile visits manual"
  ON instagram_profile_visits_manual FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile visits manual"
  ON instagram_profile_visits_manual FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile visits manual"
  ON instagram_profile_visits_manual FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE instagram_profile_visits_manual IS
  'Visitas diárias ao perfil Instagram lançadas manualmente (Meta Insights)';
COMMENT ON COLUMN instagram_profile_visits_manual.visits IS
  'Quantidade de visitas ao perfil no dia (número do app Meta Insights)';
