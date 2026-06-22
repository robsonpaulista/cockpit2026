-- Correção: colunas usadas por /dashboard/conteudo/redes e panorama Instagram
-- Rode no Supabase SQL Editor se snapshots retornarem PGRST204.

ALTER TABLE instagram_metrics_history
  ADD COLUMN IF NOT EXISTS avg_post_engagement INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN instagram_metrics_history.avg_post_engagement IS
  'Média de engajamento das publicações no momento do snapshot';

ALTER TABLE instagram_post_metrics_history
  ADD COLUMN IF NOT EXISTS post_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS caption TEXT;
