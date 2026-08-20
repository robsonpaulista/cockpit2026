-- Links de acervo do Relatório Executivo municipal (Bloco 03)
-- Editáveis no War Room → Copiloto → Relatório; usados como hiperlinks no PDF.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.relatorio_executivo_acervo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio TEXT NOT NULL,
  municipio_normalizado TEXT NOT NULL,
  obra_id TEXT,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACERVO',
  url TEXT NOT NULL,
  label TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT relatorio_executivo_acervo_url_chk CHECK (
    length(trim(url)) > 0
    AND (
      lower(trim(url)) LIKE 'http://%'
      OR lower(trim(url)) LIKE 'https://%'
    )
  )
);

-- Um vínculo salvo por obra no município (itens livres ficam com obra_id NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_relatorio_executivo_acervo_obra
  ON public.relatorio_executivo_acervo (municipio_normalizado, obra_id)
  WHERE obra_id IS NOT NULL AND length(trim(obra_id)) > 0;

CREATE INDEX IF NOT EXISTS idx_relatorio_executivo_acervo_municipio
  ON public.relatorio_executivo_acervo (municipio_normalizado, sort_order, updated_at DESC);

ALTER TABLE public.relatorio_executivo_acervo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read relatorio_executivo_acervo"
  ON public.relatorio_executivo_acervo;
CREATE POLICY "Authenticated read relatorio_executivo_acervo"
  ON public.relatorio_executivo_acervo FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated write relatorio_executivo_acervo"
  ON public.relatorio_executivo_acervo;
CREATE POLICY "Authenticated write relatorio_executivo_acervo"
  ON public.relatorio_executivo_acervo FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.relatorio_executivo_acervo IS
  'Links de acervo fotográfico/documentação do Relatório Executivo, por município (e opcionalmente por obra).';
