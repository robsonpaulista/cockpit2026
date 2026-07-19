-- =========================================================
-- Radar 224 — catálogo de fontes (fase 1)
-- Execute no SQL Editor do Supabase quando for persistir o catálogo.
-- Enquanto isso, o app usa lib/radar-224/fontes-seed.ts.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.radar_fontes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  camada TEXT NOT NULL CHECK (
    camada IN (
      'estadual',
      'regional',
      'local',
      'oficial',
      'rede_social',
      'conteudo_politico'
    )
  ),
  selo TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  dominio TEXT NOT NULL DEFAULT '',
  nota INTEGER NOT NULL DEFAULT 50 CHECK (nota >= 0 AND nota <= 100),
  status TEXT NOT NULL DEFAULT 'candidata' CHECK (
    status IN ('ativa', 'candidata', 'pausada', 'rejeitada')
  ),
  territorios TEXT[] NOT NULL DEFAULT '{}',
  municipios_prioritarios TEXT[] NOT NULL DEFAULT '{}',
  cobertura_resumo TEXT NOT NULL DEFAULT '',
  notas_operacionais TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_fontes_camada ON public.radar_fontes (camada);
CREATE INDEX IF NOT EXISTS idx_radar_fontes_status ON public.radar_fontes (status);
CREATE INDEX IF NOT EXISTS idx_radar_fontes_ativo ON public.radar_fontes (ativo);

ALTER TABLE public.radar_fontes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read radar_fontes" ON public.radar_fontes;
CREATE POLICY "Authenticated read radar_fontes"
  ON public.radar_fontes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated write radar_fontes" ON public.radar_fontes;
CREATE POLICY "Authenticated write radar_fontes"
  ON public.radar_fontes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.radar_fontes IS
  'Catálogo Radar 224: fontes estaduais, regionais, locais e oficiais';
