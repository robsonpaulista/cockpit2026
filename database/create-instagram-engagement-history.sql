-- Histórico de engajamento por publicação e por dia de publicação (Instagram)

CREATE TABLE IF NOT EXISTS instagram_post_metrics_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  posted_at TIMESTAMPTZ NOT NULL,
  post_type TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  engagement INTEGER NOT NULL DEFAULT 0,
  post_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_instagram_post_metrics_user_snapshot
  ON instagram_post_metrics_history(user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_instagram_post_metrics_user_post
  ON instagram_post_metrics_history(user_id, post_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS instagram_publish_day_engagement (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publish_date DATE NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  total_engagement INTEGER NOT NULL DEFAULT 0,
  avg_engagement INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, publish_date)
);

CREATE INDEX IF NOT EXISTS idx_instagram_publish_day_user_date
  ON instagram_publish_day_engagement(user_id, publish_date DESC);

ALTER TABLE instagram_post_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_publish_day_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post metrics history"
  ON instagram_post_metrics_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own post metrics history"
  ON instagram_post_metrics_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own post metrics history"
  ON instagram_post_metrics_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own post metrics history"
  ON instagram_post_metrics_history FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own publish day engagement"
  ON instagram_publish_day_engagement FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own publish day engagement"
  ON instagram_publish_day_engagement FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own publish day engagement"
  ON instagram_publish_day_engagement FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own publish day engagement"
  ON instagram_publish_day_engagement FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE instagram_post_metrics_history IS
  'Snapshot diário das métricas de cada publicação do Instagram';
COMMENT ON TABLE instagram_publish_day_engagement IS
  'Engajamento médio agregado por dia de publicação, recalculado a cada coleta';
