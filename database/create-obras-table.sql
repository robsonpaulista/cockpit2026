-- ============================================
-- TABELA PARA OBRAS
-- ============================================

-- Tabela para armazenar dados de obras
CREATE TABLE IF NOT EXISTS obras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipio TEXT,
  obra TEXT NOT NULL,
  orgao TEXT,
  sei TEXT,
  sei_medicao TEXT,
  status TEXT,
  publicacao_os DATE,
  solicitacao_medicao DATE,
  data_medicao DATE,
  status_medicao TEXT,
  valor_total DECIMAL(15, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_obras_municipio ON obras(municipio);
CREATE INDEX IF NOT EXISTS idx_obras_status ON obras(status);
CREATE INDEX IF NOT EXISTS idx_obras_status_medicao ON obras(status_medicao);
CREATE INDEX IF NOT EXISTS idx_obras_orgao ON obras(orgao);
CREATE INDEX IF NOT EXISTS idx_obras_publicacao_os ON obras(publicacao_os);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_obras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_obras_updated_at
  BEFORE UPDATE ON obras
  FOR EACH ROW
  EXECUTE FUNCTION update_obras_updated_at();

-- RLS Policies
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;

-- Política: Todos os usuários autenticados podem ver obras
CREATE POLICY "Authenticated users can view obras"
  ON obras FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política: Apenas usuários autenticados podem inserir/atualizar obras
CREATE POLICY "Authenticated users can manage obras"
  ON obras FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Comentários nas colunas
COMMENT ON TABLE obras IS 'Tabela para armazenar informações sobre obras';
COMMENT ON COLUMN obras.municipio IS 'Município onde a obra está localizada';
COMMENT ON COLUMN obras.obra IS 'Nome/descrição da obra';
COMMENT ON COLUMN obras.orgao IS 'Órgão responsável pela obra';
COMMENT ON COLUMN obras.sei IS 'Número do SEI (Sistema Eletrônico de Informações)';
COMMENT ON COLUMN obras.sei_medicao IS 'Número do SEI da medição';
COMMENT ON COLUMN obras.status IS 'Status da obra';
COMMENT ON COLUMN obras.publicacao_os IS 'Data de publicação da OS (Ordem de Serviço)';
COMMENT ON COLUMN obras.solicitacao_medicao IS 'Data de solicitação da medição';
COMMENT ON COLUMN obras.data_medicao IS 'Data da medição';
COMMENT ON COLUMN obras.status_medicao IS 'Status da medição';
COMMENT ON COLUMN obras.valor_total IS 'Valor total da obra';
