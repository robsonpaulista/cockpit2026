-- Tetos MAC, PAP e faixas SUAS (editáveis por exercício/ano)
-- Execute no SQL Editor do Supabase após autenticação configurada

CREATE TABLE IF NOT EXISTS public.tetos_config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.tetos_config (chave, valor) VALUES ('exercicio_ativo', '2025')
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.limites_pap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercicio INTEGER NOT NULL,
  municipio_chave TEXT NOT NULL,
  municipio_nome TEXT NOT NULL,
  ibge TEXT,
  valor NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exercicio, municipio_chave)
);

CREATE INDEX IF NOT EXISTS idx_limites_pap_exercicio ON public.limites_pap (exercicio);
CREATE INDEX IF NOT EXISTS idx_limites_pap_municipio ON public.limites_pap (municipio_chave);

CREATE TABLE IF NOT EXISTS public.limites_mac_municipio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercicio INTEGER NOT NULL,
  municipio_chave TEXT NOT NULL,
  municipio_nome TEXT NOT NULL,
  ibge TEXT,
  valor NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exercicio, municipio_chave)
);

CREATE INDEX IF NOT EXISTS idx_limites_mac_exercicio ON public.limites_mac_municipio (exercicio);

CREATE TABLE IF NOT EXISTS public.suas_faixas_porte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercicio INTEGER NOT NULL,
  ordem SMALLINT NOT NULL,
  populacao_max INTEGER,
  porte TEXT NOT NULL,
  valor NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exercicio, ordem)
);

CREATE INDEX IF NOT EXISTS idx_suas_faixas_exercicio ON public.suas_faixas_porte (exercicio, ordem);

CREATE OR REPLACE FUNCTION public.touch_limites_tetos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_limites_pap_updated ON public.limites_pap;
CREATE TRIGGER trg_limites_pap_updated
  BEFORE UPDATE ON public.limites_pap
  FOR EACH ROW EXECUTE FUNCTION public.touch_limites_tetos_updated_at();

DROP TRIGGER IF EXISTS trg_limites_mac_updated ON public.limites_mac_municipio;
CREATE TRIGGER trg_limites_mac_updated
  BEFORE UPDATE ON public.limites_mac_municipio
  FOR EACH ROW EXECUTE FUNCTION public.touch_limites_tetos_updated_at();

DROP TRIGGER IF EXISTS trg_suas_faixas_updated ON public.suas_faixas_porte;
CREATE TRIGGER trg_suas_faixas_updated
  BEFORE UPDATE ON public.suas_faixas_porte
  FOR EACH ROW EXECUTE FUNCTION public.touch_limites_tetos_updated_at();

ALTER TABLE public.tetos_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limites_pap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limites_mac_municipio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suas_faixas_porte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read tetos_config" ON public.tetos_config;
CREATE POLICY "Authenticated read tetos_config" ON public.tetos_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated manage tetos_config" ON public.tetos_config;
CREATE POLICY "Authenticated manage tetos_config" ON public.tetos_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read limites_pap" ON public.limites_pap;
CREATE POLICY "Authenticated read limites_pap" ON public.limites_pap
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated manage limites_pap" ON public.limites_pap;
CREATE POLICY "Authenticated manage limites_pap" ON public.limites_pap
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read limites_mac" ON public.limites_mac_municipio;
CREATE POLICY "Authenticated read limites_mac" ON public.limites_mac_municipio
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated manage limites_mac" ON public.limites_mac_municipio;
CREATE POLICY "Authenticated manage limites_mac" ON public.limites_mac_municipio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read suas_faixas" ON public.suas_faixas_porte;
CREATE POLICY "Authenticated read suas_faixas" ON public.suas_faixas_porte
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated manage suas_faixas" ON public.suas_faixas_porte;
CREATE POLICY "Authenticated manage suas_faixas" ON public.suas_faixas_porte
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
