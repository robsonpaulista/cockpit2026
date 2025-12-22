-- Garantir que a extensão UUID está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela adversaries se não existir
CREATE TABLE IF NOT EXISTS adversaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('candidate', 'party', 'media', 'influencer', 'other')),
  themes JSONB DEFAULT '[]'::jsonb, -- Temas que abordam
  presence_score INTEGER DEFAULT 0 CHECK (presence_score >= 0 AND presence_score <= 100), -- Share of Voice
  google_alerts_rss_url TEXT, -- URL do feed RSS do Google Alerts
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice para busca por nome
CREATE INDEX IF NOT EXISTS idx_adversaries_name ON adversaries(name);

-- Criar índice para busca por tipo
CREATE INDEX IF NOT EXISTS idx_adversaries_type ON adversaries(type);

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_adversaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_adversaries_updated_at ON adversaries;
CREATE TRIGGER update_adversaries_updated_at 
  BEFORE UPDATE ON adversaries
  FOR EACH ROW
  EXECUTE FUNCTION update_adversaries_updated_at();

-- Habilitar RLS
ALTER TABLE adversaries ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
DROP POLICY IF EXISTS "Authenticated users can read all adversaries" ON adversaries;
DROP POLICY IF EXISTS "Authenticated users can insert adversaries" ON adversaries;
DROP POLICY IF EXISTS "Authenticated users can update adversaries" ON adversaries;
DROP POLICY IF EXISTS "Authenticated users can delete adversaries" ON adversaries;

CREATE POLICY "Authenticated users can read all adversaries" ON adversaries
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert adversaries" ON adversaries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update adversaries" ON adversaries
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete adversaries" ON adversaries
  FOR DELETE USING (auth.role() = 'authenticated');

-- Comentários
COMMENT ON TABLE adversaries IS 'Tabela de adversários políticos monitorados';
COMMENT ON COLUMN adversaries.name IS 'Nome do adversário';
COMMENT ON COLUMN adversaries.type IS 'Tipo: candidate, party, media, influencer, other';
COMMENT ON COLUMN adversaries.themes IS 'Temas que o adversário aborda (JSON array)';
COMMENT ON COLUMN adversaries.presence_score IS 'Share of Voice - percentual de presença nas notícias (0-100)';
COMMENT ON COLUMN adversaries.google_alerts_rss_url IS 'URL do feed RSS do Google Alerts para monitorar este adversário';

