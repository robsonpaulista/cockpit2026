-- ============================================
-- ÚLTIMO STATUS SEI (LISTA DE PROTOCOLOS)
-- ============================================
-- Dados do último registro tr.infraTrClara da tabela tblDocumentos (Lista de Protocolos).

ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS sei_ultimo_status TEXT,
  ADD COLUMN IF NOT EXISTS sei_ultimo_status_data TIMESTAMPTZ;

COMMENT ON COLUMN obras.sei_ultimo_status IS 'Texto do último protocolo na Lista de Protocolos (tblDocumentos, último infraTrClara)';
COMMENT ON COLUMN obras.sei_ultimo_status_data IS 'Data do último protocolo (4ª coluna do último infraTrClara)';
