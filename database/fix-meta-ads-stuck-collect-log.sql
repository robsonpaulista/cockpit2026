-- Libera coletas travadas (finished_at NULL após crash/reinício)
UPDATE meta_ads_collect_log
SET
  finished_at = NOW(),
  success = FALSE,
  error_message = 'Coleta encerrada manualmente (registro travado).'
WHERE finished_at IS NULL;
