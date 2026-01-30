-- ============================================
-- ÚLTIMO ANDAMENTO SEI EM OBRAS
-- ============================================
-- Armazena o último status (andamento/Aberto) extraído da página do SEI
-- para cada obra que possui sei_url preenchido.

ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS sei_ultimo_andamento TEXT,
  ADD COLUMN IF NOT EXISTS sei_ultimo_andamento_data TIMESTAMPTZ;

COMMENT ON COLUMN obras.sei_ultimo_andamento IS 'Descrição do último andamento (ex: Processo remetido pela unidade)';
COMMENT ON COLUMN obras.sei_ultimo_andamento_data IS 'Data/hora do último andamento conforme exibido no SEI';
