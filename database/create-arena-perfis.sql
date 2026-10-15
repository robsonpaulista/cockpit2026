-- Arena de Apoiadores — perfis do ranking exportado do sistema da arena
-- Carga: node scripts/import-arena-perfis.mjs data/ranking-AAAA-MM-DD_AAAA-MM-DD.csv

CREATE TABLE IF NOT EXISTS public.arena_perfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('lideranca', 'liderado')),
  cidade TEXT,
  regiao TEXT,
  nivel TEXT,
  pontos INT NOT NULL DEFAULT 0,
  posicao INT,
  fidelidade BOOLEAN NOT NULL DEFAULT false,
  periodo_inicio DATE,
  periodo_fim DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_perfis_papel ON public.arena_perfis(papel);

ALTER TABLE public.arena_perfis ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.arena_perfis IS 'Perfis da Arena de Apoiadores (lideranças e liderados) com nível e pontos do ranking. Leitura só via service role.';
COMMENT ON COLUMN public.arena_perfis.instagram IS 'Handle Instagram (sem @, lowercase).';
