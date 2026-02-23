-- Adiciona campos de pagamento à tabela obras
ALTER TABLE obras ADD COLUMN IF NOT EXISTS valor_pago NUMERIC;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS nro_doc TEXT;

CREATE INDEX IF NOT EXISTS idx_obras_valor_pago ON obras(valor_pago) WHERE valor_pago IS NOT NULL;
