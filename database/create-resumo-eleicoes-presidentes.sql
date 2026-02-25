CREATE TABLE IF NOT EXISTS resumo_eleicoes_presidentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio TEXT NOT NULL,
  municipio_normalizado TEXT NOT NULL UNIQUE,
  vereador_nome TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumo_eleicoes_presidentes_municipio
  ON resumo_eleicoes_presidentes (municipio);

ALTER TABLE resumo_eleicoes_presidentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read resumo eleicoes presidentes" ON resumo_eleicoes_presidentes;
CREATE POLICY "Authenticated read resumo eleicoes presidentes"
  ON resumo_eleicoes_presidentes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert resumo eleicoes presidentes" ON resumo_eleicoes_presidentes;
CREATE POLICY "Authenticated insert resumo eleicoes presidentes"
  ON resumo_eleicoes_presidentes FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update resumo eleicoes presidentes" ON resumo_eleicoes_presidentes;
CREATE POLICY "Authenticated update resumo eleicoes presidentes"
  ON resumo_eleicoes_presidentes FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
