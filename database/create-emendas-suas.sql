-- Emendas SUAS manuais (lançamentos locais, espelhando jadyelapp / Firebase emendassuas)
CREATE TABLE IF NOT EXISTS emendas_suas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio TEXT NOT NULL,
  tipo_proposta TEXT NOT NULL DEFAULT 'INCREMENTO SUAS',
  tipo_recurso TEXT NOT NULL DEFAULT 'EMENDA/PROJETO',
  valor_proposta NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_pagar NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emendas_suas_municipio ON emendas_suas(municipio);

ALTER TABLE emendas_suas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read emendas_suas" ON emendas_suas;
CREATE POLICY "Authenticated read emendas_suas" ON emendas_suas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert emendas_suas" ON emendas_suas;
CREATE POLICY "Authenticated insert emendas_suas" ON emendas_suas
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update emendas_suas" ON emendas_suas;
CREATE POLICY "Authenticated update emendas_suas" ON emendas_suas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete emendas_suas" ON emendas_suas;
CREATE POLICY "Authenticated delete emendas_suas" ON emendas_suas
  FOR DELETE TO authenticated USING (true);
