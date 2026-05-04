-- ============================================
-- EMENDAS (gestão institucional)
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS public.emendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco TEXT,
  emenda TEXT NOT NULL,
  municipio_beneficiario TEXT,
  funcional TEXT,
  gnd TEXT,
  valor_indicado NUMERIC(15, 2),
  valor_empenhado NUMERIC(15, 2),
  valor_a_empenhar NUMERIC(15, 2),
  valor_pago NUMERIC(15, 2),
  valor_a_ser_pago NUMERIC(15, 2),
  empenho TEXT,
  data_empenho DATE,
  portaria_convenio TEXT,
  numero_proposta TEXT,
  data_pagamento DATE,
  exercicio INTEGER,
  liderancas TEXT,
  alteracao TEXT,
  objeto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emendas_emenda ON public.emendas (emenda);
CREATE INDEX IF NOT EXISTS idx_emendas_bloco ON public.emendas (bloco);
CREATE INDEX IF NOT EXISTS idx_emendas_data_empenho ON public.emendas (data_empenho);
CREATE INDEX IF NOT EXISTS idx_emendas_data_pagamento ON public.emendas (data_pagamento);
CREATE INDEX IF NOT EXISTS idx_emendas_exercicio ON public.emendas (exercicio);
CREATE INDEX IF NOT EXISTS idx_emendas_updated_at ON public.emendas (updated_at DESC);

CREATE OR REPLACE FUNCTION public.update_emendas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emendas_updated_at ON public.emendas;
CREATE TRIGGER trg_emendas_updated_at
  BEFORE UPDATE ON public.emendas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_emendas_updated_at();

ALTER TABLE public.emendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view emendas" ON public.emendas;
CREATE POLICY "Authenticated users can view emendas"
  ON public.emendas FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage emendas" ON public.emendas;
CREATE POLICY "Authenticated users can manage emendas"
  ON public.emendas FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE public.emendas IS 'Gestão de emendas parlamentares (institucional)';

INSERT INTO public.pages (key, label, path)
VALUES ('emendas', 'Emendas', '/dashboard/emendas')
ON CONFLICT (key) DO NOTHING;
