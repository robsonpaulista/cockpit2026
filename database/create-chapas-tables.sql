-- ============================================
-- TABELAS PARA SISTEMA DE CHAPAS ELEITORAIS
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Cenários
CREATE TABLE IF NOT EXISTS chapas_cenarios (
  id TEXT PRIMARY KEY, -- 'base' ou 'cenario_timestamp'
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('base', 'simulacao')),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  ativo BOOLEAN DEFAULT FALSE,
  quociente_eleitoral INTEGER NOT NULL DEFAULT 190000,
  votos_igreja INTEGER,
  UNIQUE(user_id, id)
);

-- Tabela de Partidos e Candidatos por Cenário
CREATE TABLE IF NOT EXISTS chapas_partidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cenario_id TEXT NOT NULL,
  partido_nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT 'bg-gray-500',
  cor_texto TEXT NOT NULL DEFAULT 'text-white',
  votos_legenda INTEGER DEFAULT 0,
  candidato_nome TEXT NOT NULL,
  candidato_votos INTEGER NOT NULL DEFAULT 0,
  candidato_genero TEXT CHECK (candidato_genero IN ('homem', 'mulher')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id, cenario_id) REFERENCES chapas_cenarios(user_id, id) ON DELETE CASCADE
);

-- Tabela de Configurações (Quociente Eleitoral)
CREATE TABLE IF NOT EXISTS chapas_configuracoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  valor JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chave)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_chapas_cenarios_user_id ON chapas_cenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_chapas_cenarios_ativo ON chapas_cenarios(user_id, ativo) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_chapas_partidos_cenario ON chapas_partidos(user_id, cenario_id);
CREATE INDEX IF NOT EXISTS idx_chapas_partidos_partido ON chapas_partidos(user_id, cenario_id, partido_nome);
CREATE INDEX IF NOT EXISTS idx_chapas_configuracoes_user ON chapas_configuracoes(user_id, chave);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_chapas_cenarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chapas_cenarios_updated_at ON chapas_cenarios;
CREATE TRIGGER update_chapas_cenarios_updated_at
  BEFORE UPDATE ON chapas_cenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_chapas_cenarios_updated_at();

CREATE OR REPLACE FUNCTION update_chapas_partidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chapas_partidos_updated_at ON chapas_partidos;
CREATE TRIGGER update_chapas_partidos_updated_at
  BEFORE UPDATE ON chapas_partidos
  FOR EACH ROW
  EXECUTE FUNCTION update_chapas_partidos_updated_at();

-- RLS Policies
ALTER TABLE chapas_cenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapas_partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapas_configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas para chapas_cenarios
DROP POLICY IF EXISTS "Users can view their own scenarios" ON chapas_cenarios;
CREATE POLICY "Users can view their own scenarios"
  ON chapas_cenarios FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own scenarios" ON chapas_cenarios;
CREATE POLICY "Users can insert their own scenarios"
  ON chapas_cenarios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own scenarios" ON chapas_cenarios;
CREATE POLICY "Users can update their own scenarios"
  ON chapas_cenarios FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own scenarios" ON chapas_cenarios;
CREATE POLICY "Users can delete their own scenarios"
  ON chapas_cenarios FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Políticas para chapas_partidos
DROP POLICY IF EXISTS "Users can view their own parties" ON chapas_partidos;
CREATE POLICY "Users can view their own parties"
  ON chapas_partidos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own parties" ON chapas_partidos;
CREATE POLICY "Users can insert their own parties"
  ON chapas_partidos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own parties" ON chapas_partidos;
CREATE POLICY "Users can update their own parties"
  ON chapas_partidos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own parties" ON chapas_partidos;
CREATE POLICY "Users can delete their own parties"
  ON chapas_partidos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Políticas para chapas_configuracoes
DROP POLICY IF EXISTS "Users can view their own configurations" ON chapas_configuracoes;
CREATE POLICY "Users can view their own configurations"
  ON chapas_configuracoes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own configurations" ON chapas_configuracoes;
CREATE POLICY "Users can insert their own configurations"
  ON chapas_configuracoes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own configurations" ON chapas_configuracoes;
CREATE POLICY "Users can update their own configurations"
  ON chapas_configuracoes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own configurations" ON chapas_configuracoes;
CREATE POLICY "Users can delete their own configurations"
  ON chapas_configuracoes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

