-- Migração: ano (exercício) e data de pagamento; remove coluna texto `pagamento` se existir.
-- Execute no SQL Editor do Supabase após já ter criado `emendas` com o script antigo.

ALTER TABLE public.emendas ADD COLUMN IF NOT EXISTS exercicio INTEGER;
ALTER TABLE public.emendas ADD COLUMN IF NOT EXISTS data_pagamento DATE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'emendas'
      AND column_name = 'pagamento'
  ) THEN
    UPDATE public.emendas
    SET data_pagamento = pagamento::date
    WHERE data_pagamento IS NULL
      AND pagamento IS NOT NULL
      AND TRIM(pagamento) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

    ALTER TABLE public.emendas DROP COLUMN pagamento;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_emendas_data_pagamento ON public.emendas (data_pagamento);
CREATE INDEX IF NOT EXISTS idx_emendas_exercicio ON public.emendas (exercicio);
