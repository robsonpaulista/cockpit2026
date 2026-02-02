-- ============================================
-- CAMPO TIPO EM OBRAS
-- ============================================
-- Tipo da obra: pavimentação ou obras diversas

ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS tipo TEXT;

COMMENT ON COLUMN obras.tipo IS 'Tipo da obra: pavimentação ou obras diversas';

-- Opcional: restringir valores (descomente se quiser)
-- ALTER TABLE obras ADD CONSTRAINT chk_obras_tipo
--   CHECK (tipo IS NULL OR tipo IN ('pavimentação', 'obras diversas'));
