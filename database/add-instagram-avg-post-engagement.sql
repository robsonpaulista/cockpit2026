-- Engajamento médio das publicações no snapshot diário (para gráfico de correlação)
ALTER TABLE instagram_metrics_history
  ADD COLUMN IF NOT EXISTS avg_post_engagement INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN instagram_metrics_history.avg_post_engagement IS
  'Média de engajamento (curtidas + comentários + etc.) das publicações no momento do snapshot';
