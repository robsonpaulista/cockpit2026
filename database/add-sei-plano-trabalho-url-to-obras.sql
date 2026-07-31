-- Link do documento "Plano de Trabalho" / "Plano" / "Relatório"
-- capturado na Lista de Protocolos (tblDocumentos) do SEI.
ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS sei_plano_trabalho_url TEXT,
  ADD COLUMN IF NOT EXISTS sei_plano_trabalho_tipo TEXT,
  ADD COLUMN IF NOT EXISTS sei_plano_trabalho_numero TEXT;

COMMENT ON COLUMN obras.sei_plano_trabalho_url IS
  'URL pública do documento (md_pesq_documento_consulta_externa.php?…) quando Tipo contém Plano de Trabalho / Plano / Relatório';
COMMENT ON COLUMN obras.sei_plano_trabalho_tipo IS
  'Tipo do documento capturado na Lista de Protocolos (ex.: Relatório, Plano de Trabalho)';
COMMENT ON COLUMN obras.sei_plano_trabalho_numero IS
  'Número do protocolo/documento na Lista de Protocolos';
