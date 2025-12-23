-- Tabela de Pesquisas Eleitorais
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  instituto TEXT NOT NULL,
  candidato_nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('estimulada', 'espontanea')),
  cargo TEXT NOT NULL CHECK (cargo IN ('dep_estadual', 'dep_federal', 'governador', 'senador', 'presidente')),
  cidade_id TEXT REFERENCES cities(id) ON DELETE SET NULL,
  intencao DECIMAL(5, 2) NOT NULL CHECK (intencao >= 0 AND intencao <= 100),
  rejeicao DECIMAL(5, 2) NOT NULL CHECK (rejeicao >= 0 AND rejeicao <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_polls_user_id ON polls(user_id);
CREATE INDEX IF NOT EXISTS idx_polls_data ON polls(data);
CREATE INDEX IF NOT EXISTS idx_polls_cargo ON polls(cargo);
CREATE INDEX IF NOT EXISTS idx_polls_tipo ON polls(tipo);
CREATE INDEX IF NOT EXISTS idx_polls_cidade_id ON polls(cidade_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_polls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_polls_updated_at
  BEFORE UPDATE ON polls
  FOR EACH ROW
  EXECUTE FUNCTION update_polls_updated_at();

-- RLS Policies
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ver suas próprias pesquisas
CREATE POLICY "Users can view their own polls"
  ON polls FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política: Usuários autenticados podem inserir suas próprias pesquisas
CREATE POLICY "Users can insert their own polls"
  ON polls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem atualizar suas próprias pesquisas
CREATE POLICY "Users can update their own polls"
  ON polls FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem deletar suas próprias pesquisas
CREATE POLICY "Users can delete their own polls"
  ON polls FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Comentários
COMMENT ON TABLE polls IS 'Pesquisas eleitorais realizadas';
COMMENT ON COLUMN polls.data IS 'Data da pesquisa';
COMMENT ON COLUMN polls.instituto IS 'Nome do instituto que realizou a pesquisa';
COMMENT ON COLUMN polls.tipo IS 'Tipo da pesquisa: estimulada ou espontânea';
COMMENT ON COLUMN polls.cargo IS 'Cargo pesquisado: Dep Estadual, Dep Federal, Governador, Senador ou Presidente';
COMMENT ON COLUMN polls.intencao IS 'Percentual de intenção de voto (0-100)';
COMMENT ON COLUMN polls.rejeicao IS 'Percentual de rejeição (0-100)';

