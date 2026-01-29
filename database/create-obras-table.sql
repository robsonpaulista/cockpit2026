-- ============================================
-- TABELA PARA OBRAS
-- ============================================

-- Tabela para armazenar dados de obras
CREATE TABLE IF NOT EXISTS obras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_obra TEXT NOT NULL,
  localizacao TEXT,
  cidade TEXT,
  estado TEXT,
  tipo_obra TEXT,
  status TEXT,
  data_inicio DATE,
  data_prevista_conclusao DATE,
  data_conclusao DATE,
  valor_orcado DECIMAL(15, 2),
  valor_executado DECIMAL(15, 2),
  percentual_execucao DECIMAL(5, 2),
  responsavel TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_obras_cidade ON obras(cidade);
CREATE INDEX IF NOT EXISTS idx_obras_estado ON obras(estado);
CREATE INDEX IF NOT EXISTS idx_obras_status ON obras(status);
CREATE INDEX IF NOT EXISTS idx_obras_tipo ON obras(tipo_obra);
CREATE INDEX IF NOT EXISTS idx_obras_data_inicio ON obras(data_inicio);

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
COMMENT ON COLUMN obras.nome_obra IS 'Nome da obra';
COMMENT ON COLUMN obras.localizacao IS 'Endereço/localização da obra';
COMMENT ON COLUMN obras.cidade IS 'Cidade onde a obra está localizada';
COMMENT ON COLUMN obras.estado IS 'Estado onde a obra está localizada';
COMMENT ON COLUMN obras.tipo_obra IS 'Tipo da obra (ex: Asfaltamento, Construção, Reforma)';
COMMENT ON COLUMN obras.status IS 'Status da obra (ex: Em andamento, Concluída, Paralisada)';
COMMENT ON COLUMN obras.valor_orcado IS 'Valor orçado para a obra';
COMMENT ON COLUMN obras.valor_executado IS 'Valor já executado na obra';
COMMENT ON COLUMN obras.percentual_execucao IS 'Percentual de execução da obra (0-100)';
