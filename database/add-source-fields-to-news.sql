-- ============================================
-- ADICIONAR CAMPOS PARA FONTES AVANÇADAS (GDELT, Media Cloud)
-- ============================================
-- Este script adiciona campos necessários para suportar múltiplas fontes de notícias
-- Complementa o sistema existente de Google Alerts

-- Adicionar campo source_type para distinguir fontes
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'news' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE news ADD COLUMN source_type TEXT 
      DEFAULT 'google_alerts' 
      CHECK (source_type IN ('google_alerts', 'gdelt', 'media_cloud'));
    
    -- Atualizar registros existentes
    UPDATE news SET source_type = 'google_alerts' WHERE source_type IS NULL;
  END IF;
END $$;

-- Adicionar campo publisher (domínio da fonte)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'news' AND column_name = 'publisher'
  ) THEN
    ALTER TABLE news ADD COLUMN publisher TEXT;
  END IF;
END $$;

-- Adicionar campo reviewed (classificação manual)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'news' AND column_name = 'reviewed'
  ) THEN
    ALTER TABLE news ADD COLUMN reviewed BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Adicionar campo notes (notas da classificação manual)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'news' AND column_name = 'notes'
  ) THEN
    ALTER TABLE news ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_news_source_type ON news(source_type);
CREATE INDEX IF NOT EXISTS idx_news_publisher ON news(publisher);
CREATE INDEX IF NOT EXISTS idx_news_reviewed ON news(reviewed);

-- Comentários
COMMENT ON COLUMN news.source_type IS 'Tipo de fonte: google_alerts, gdelt, media_cloud';
COMMENT ON COLUMN news.publisher IS 'Domínio/publicador da notícia (ex: g1.com.br, folha.com.br)';
COMMENT ON COLUMN news.reviewed IS 'Indica se a notícia foi revisada/classificada manualmente';
COMMENT ON COLUMN news.notes IS 'Notas adicionais da classificação manual';
