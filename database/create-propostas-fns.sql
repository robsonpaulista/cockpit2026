-- Snapshot de propostas FNS por exercício (anos encerrados).
-- O exercício corrente (ex.: 2026) NÃO deve ser gravado aqui — consulta sempre ao vivo no FNS.

CREATE TABLE IF NOT EXISTS public.propostas_fns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercicio INTEGER NOT NULL,
  municipio_chave TEXT NOT NULL,
  municipio_nome TEXT NOT NULL,
  ibge TEXT,
  nu_proposta TEXT NOT NULL,
  co_tipo_proposta TEXT,
  ds_tipo_recurso TEXT,
  vl_proposta NUMERIC(14, 2) NOT NULL DEFAULT 0,
  vl_pagar NUMERIC(14, 2) NOT NULL DEFAULT 0,
  vl_pago NUMERIC(14, 2) NOT NULL DEFAULT 0,
  dt_cadastramento TIMESTAMPTZ,
  ds_situacao_proposta TEXT,
  nu_processo TEXT,
  constituido_processo BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exercicio, municipio_chave, nu_proposta)
);

CREATE INDEX IF NOT EXISTS idx_propostas_fns_exercicio_municipio
  ON public.propostas_fns (exercicio, municipio_chave);

COMMENT ON TABLE public.propostas_fns IS
  'Arquivo histórico de propostas FNS por exercício. Exercício ativo: consulta ao vivo, sem persistir.';

ALTER TABLE public.propostas_fns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read propostas_fns" ON public.propostas_fns;
CREATE POLICY "Authenticated read propostas_fns" ON public.propostas_fns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert propostas_fns" ON public.propostas_fns;
CREATE POLICY "Authenticated insert propostas_fns" ON public.propostas_fns
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update propostas_fns" ON public.propostas_fns;
CREATE POLICY "Authenticated update propostas_fns" ON public.propostas_fns
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete propostas_fns" ON public.propostas_fns;
CREATE POLICY "Authenticated delete propostas_fns" ON public.propostas_fns
  FOR DELETE TO authenticated USING (true);
