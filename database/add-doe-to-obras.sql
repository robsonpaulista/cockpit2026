-- Campos de consulta ao Diário Oficial do PI (doe/busca) por número SEI.
ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS doe_edicao TEXT,
  ADD COLUMN IF NOT EXISTS doe_resumo TEXT,
  ADD COLUMN IF NOT EXISTS doe_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS doe_nota_uuid TEXT,
  ADD COLUMN IF NOT EXISTS doe_encontrados INTEGER,
  ADD COLUMN IF NOT EXISTS doe_consultado_em TIMESTAMPTZ;

COMMENT ON COLUMN obras.doe_edicao IS 'Edição do DOE onde o SEI foi encontrado';
COMMENT ON COLUMN obras.doe_resumo IS 'Texto do resumo (visualizar nota) no Diário Oficial';
COMMENT ON COLUMN obras.doe_pdf_url IS 'URL do PDF da edição no DOE';
COMMENT ON COLUMN obras.doe_nota_uuid IS 'UUID da nota no DOE';
COMMENT ON COLUMN obras.doe_encontrados IS 'Quantidade de ocorrências na busca do DOE';
COMMENT ON COLUMN obras.doe_consultado_em IS 'Quando a consulta ao DOE foi feita';
