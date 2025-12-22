-- Garantir que a extensão UUID está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- IMPORTANTE: Esta tabela depende de 'crises'
-- Certifique-se de que a tabela 'crises' existe antes de executar este script
-- Se 'crises' não existir, o campo crisis_id será criado sem foreign key constraint

-- Criar tabela news se não existir
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  content TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  theme TEXT,
  actor TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  crisis_id UUID, -- Referência à crise relacionada (foreign key adicionado depois se crises existir)
  adversary_id UUID, -- Referência ao adversário cujo feed RSS coletou esta notícia (NULL para notícias gerais)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign key para crises se a tabela existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crises') THEN
    -- Remover constraint se já existir
    ALTER TABLE news DROP CONSTRAINT IF EXISTS news_crisis_id_fkey;
    -- Adicionar foreign key
    ALTER TABLE news ADD CONSTRAINT news_crisis_id_fkey 
      FOREIGN KEY (crisis_id) REFERENCES crises(id);
  END IF;
END $$;

-- Adicionar foreign key para adversaries se a tabela existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adversaries') THEN
    -- Remover constraint se já existir
    ALTER TABLE news DROP CONSTRAINT IF EXISTS news_adversary_id_fkey;
    -- Adicionar foreign key
    ALTER TABLE news ADD CONSTRAINT news_adversary_id_fkey 
      FOREIGN KEY (adversary_id) REFERENCES adversaries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_news_collected_at ON news(collected_at);
CREATE INDEX IF NOT EXISTS idx_news_risk_level ON news(risk_level);
CREATE INDEX IF NOT EXISTS idx_news_sentiment ON news(sentiment);
CREATE INDEX IF NOT EXISTS idx_news_theme ON news(theme);
CREATE INDEX IF NOT EXISTS idx_news_processed ON news(processed);
CREATE INDEX IF NOT EXISTS idx_news_crisis_id ON news(crisis_id);
CREATE INDEX IF NOT EXISTS idx_news_adversary_id ON news(adversary_id);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at);
CREATE INDEX IF NOT EXISTS idx_news_source ON news(source);

-- Criar índice único para evitar duplicatas por URL
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_url_unique ON news(url) WHERE url IS NOT NULL;

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_news_updated_at ON news;
CREATE TRIGGER update_news_updated_at 
  BEFORE UPDATE ON news
  FOR EACH ROW
  EXECUTE FUNCTION update_news_updated_at();

-- Habilitar RLS
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
DROP POLICY IF EXISTS "Authenticated users can read all news" ON news;
DROP POLICY IF EXISTS "Authenticated users can insert news" ON news;
DROP POLICY IF EXISTS "Authenticated users can update news" ON news;
DROP POLICY IF EXISTS "Authenticated users can delete news" ON news;

CREATE POLICY "Authenticated users can read all news" ON news
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert news" ON news
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update news" ON news
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete news" ON news
  FOR DELETE USING (auth.role() = 'authenticated');

-- Comentários
COMMENT ON TABLE news IS 'Tabela de notícias coletadas de diversas fontes (RSS, Google Alerts, etc.)';
COMMENT ON COLUMN news.title IS 'Título da notícia';
COMMENT ON COLUMN news.source IS 'Fonte da notícia (ex: Google Alerts, Instagram, Gazeta do Povo)';
COMMENT ON COLUMN news.url IS 'URL da notícia original';
COMMENT ON COLUMN news.content IS 'Conteúdo completo ou resumo da notícia';
COMMENT ON COLUMN news.sentiment IS 'Sentimento detectado: positive, negative, neutral';
COMMENT ON COLUMN news.risk_level IS 'Nível de risco: low, medium, high';
COMMENT ON COLUMN news.theme IS 'Tema identificado (ex: Saúde, Educação, Infraestrutura)';
COMMENT ON COLUMN news.actor IS 'Ator mencionado na notícia';
COMMENT ON COLUMN news.published_at IS 'Data de publicação original da notícia';
COMMENT ON COLUMN news.collected_at IS 'Data/hora em que a notícia foi coletada pelo sistema';
COMMENT ON COLUMN news.processed IS 'Indica se a notícia já foi processada (classificação automática aplicada)';
COMMENT ON COLUMN news.crisis_id IS 'Referência à crise relacionada, se detectada';
COMMENT ON COLUMN news.adversary_id IS 'Referência ao adversário cujo feed RSS coletou esta notícia (NULL para notícias gerais do Inbox)';

