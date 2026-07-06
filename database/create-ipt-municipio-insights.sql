-- Insights de campo por município no IPT (histórico + override opcional de sinal)
CREATE TABLE IF NOT EXISTS ipt_municipio_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio TEXT NOT NULL,
  municipio_normalizado TEXT NOT NULL,
  indicador TEXT NOT NULL CHECK (indicador IN ('visitas', 'obras', 'pesquisa')),
  body TEXT NOT NULL,
  altera_avaliacao BOOLEAN NOT NULL DEFAULT false,
  sinal_override TEXT CHECK (sinal_override IS NULL OR sinal_override IN ('bem', 'mal', 'neutro', 'sem_dado')),
  restaurar_automatico BOOLEAN NOT NULL DEFAULT false,
  sinal_visitas_calculado TEXT,
  sinal_obras_calculado TEXT,
  sinal_pesquisa_calculado TEXT,
  prioridade_calculada TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ipt_insights_municipio_norm
  ON ipt_municipio_insights(municipio_normalizado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ipt_insights_created_at
  ON ipt_municipio_insights(created_at DESC);

ALTER TABLE ipt_municipio_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read ipt_municipio_insights" ON ipt_municipio_insights;
CREATE POLICY "Authenticated read ipt_municipio_insights" ON ipt_municipio_insights
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert ipt_municipio_insights" ON ipt_municipio_insights;
CREATE POLICY "Authenticated insert ipt_municipio_insights" ON ipt_municipio_insights
  FOR INSERT TO authenticated WITH CHECK (true);
