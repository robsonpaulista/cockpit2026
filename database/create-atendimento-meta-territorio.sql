-- Metas informadas no atendimento por bairro/local, por vereador (não altera Exp. 2026)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS atendimento_meta_territorio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio TEXT NOT NULL,
  municipio_normalizado TEXT NOT NULL,
  vereador_nome TEXT NOT NULL,
  vereador_nome_normalizado TEXT NOT NULL,
  vereador_numero TEXT NOT NULL DEFAULT '',
  ano_eleicao SMALLINT NOT NULL DEFAULT 2024,
  -- { "bairro:<id>": 120, "local:<id>": 45 }
  valores JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (municipio_normalizado, vereador_nome_normalizado, vereador_numero, ano_eleicao)
);

CREATE INDEX IF NOT EXISTS idx_atendimento_meta_territorio_municipio
  ON atendimento_meta_territorio (municipio_normalizado);

CREATE INDEX IF NOT EXISTS idx_atendimento_meta_territorio_vereador
  ON atendimento_meta_territorio (vereador_nome_normalizado);

ALTER TABLE atendimento_meta_territorio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read atendimento_meta_territorio" ON atendimento_meta_territorio;
CREATE POLICY "Authenticated read atendimento_meta_territorio"
  ON atendimento_meta_territorio FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert atendimento_meta_territorio" ON atendimento_meta_territorio;
CREATE POLICY "Authenticated insert atendimento_meta_territorio"
  ON atendimento_meta_territorio FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update atendimento_meta_territorio" ON atendimento_meta_territorio;
CREATE POLICY "Authenticated update atendimento_meta_territorio"
  ON atendimento_meta_territorio FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete atendimento_meta_territorio" ON atendimento_meta_territorio;
CREATE POLICY "Authenticated delete atendimento_meta_territorio"
  ON atendimento_meta_territorio FOR DELETE TO authenticated
  USING (true);

COMMENT ON TABLE atendimento_meta_territorio IS
  'Metas manuais por bairro/local no Painel de Atendimentos (por município + vereador). Independente da Exp. 2026.';
