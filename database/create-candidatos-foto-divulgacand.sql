-- Fotos de candidatos (DivulgaCand) — Ficha de Atendimento, Prefeito/Vereador 2024
CREATE TABLE IF NOT EXISTS public.candidatos_foto_divulgacand (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_chave TEXT NOT NULL,
  municipio_nome TEXT NOT NULL,
  cargo TEXT NOT NULL CHECK (cargo IN ('prefeito', 'vereador')),
  ano_eleicao SMALLINT NOT NULL DEFAULT 2024,
  numero_urna TEXT NOT NULL,
  nome_urna TEXT NOT NULL,
  url_imagem TEXT NOT NULL,
  url_divulgacand TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (municipio_chave, cargo, ano_eleicao, numero_urna, nome_urna)
);

CREATE INDEX IF NOT EXISTS idx_candidatos_foto_municipio
  ON public.candidatos_foto_divulgacand (municipio_chave, cargo, ano_eleicao);

ALTER TABLE public.candidatos_foto_divulgacand ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read candidatos_foto" ON public.candidatos_foto_divulgacand;
CREATE POLICY "Authenticated read candidatos_foto" ON public.candidatos_foto_divulgacand
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated manage candidatos_foto" ON public.candidatos_foto_divulgacand;
CREATE POLICY "Authenticated manage candidatos_foto" ON public.candidatos_foto_divulgacand
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
