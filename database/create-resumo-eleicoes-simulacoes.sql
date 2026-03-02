CREATE TABLE IF NOT EXISTS resumo_eleicoes_simulacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio TEXT NOT NULL,
  municipio_normalizado TEXT NOT NULL UNIQUE,
  mapeamento JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumo_eleicoes_simulacoes_municipio
  ON resumo_eleicoes_simulacoes (municipio);

ALTER TABLE resumo_eleicoes_simulacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read resumo eleicoes simulacoes" ON resumo_eleicoes_simulacoes;
CREATE POLICY "Authenticated read resumo eleicoes simulacoes"
  ON resumo_eleicoes_simulacoes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert resumo eleicoes simulacoes" ON resumo_eleicoes_simulacoes;
CREATE POLICY "Authenticated insert resumo eleicoes simulacoes"
  ON resumo_eleicoes_simulacoes FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update resumo eleicoes simulacoes" ON resumo_eleicoes_simulacoes;
CREATE POLICY "Authenticated update resumo eleicoes simulacoes"
  ON resumo_eleicoes_simulacoes FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
