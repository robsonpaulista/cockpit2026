-- Progresso em tempo real da coleta Playwright (barra de status na UI)
ALTER TABLE meta_ads_collect_log
  ADD COLUMN IF NOT EXISTS progress JSONB;

COMMENT ON COLUMN meta_ads_collect_log.progress IS
  'Estado da coleta em andamento: phase, message, percent, actorIndex, adIndex, etc.';
