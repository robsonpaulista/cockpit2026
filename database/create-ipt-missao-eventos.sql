-- Evolução das missões IPT: entradas/saídas com motivo (para insight contínuo)
CREATE TABLE IF NOT EXISTS ipt_missao_eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio TEXT NOT NULL,
  municipio_normalizado TEXT NOT NULL,
  missao TEXT NOT NULL CHECK (missao IN ('expectativa', 'campo', 'pesquisa', 'digital', 'obras')),
  sentido TEXT NOT NULL CHECK (sentido IN ('entrou', 'saiu')),
  motivo TEXT NOT NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  fonte TEXT NOT NULL DEFAULT 'sync' CHECK (fonte IN ('sync', 'manual', 'bootstrap')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ipt_missao_eventos_created
  ON ipt_missao_eventos (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ipt_missao_eventos_municipio
  ON ipt_missao_eventos (municipio_normalizado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ipt_missao_eventos_missao
  ON ipt_missao_eventos (missao, created_at DESC);

ALTER TABLE ipt_missao_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read ipt_missao_eventos" ON ipt_missao_eventos;
CREATE POLICY "Authenticated read ipt_missao_eventos" ON ipt_missao_eventos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert ipt_missao_eventos" ON ipt_missao_eventos;
CREATE POLICY "Authenticated insert ipt_missao_eventos" ON ipt_missao_eventos
  FOR INSERT TO authenticated WITH CHECK (true);

COMMENT ON TABLE ipt_missao_eventos IS
  'Histórico de entrada/saída de municípios nas missões do Diagnóstico IPT';
