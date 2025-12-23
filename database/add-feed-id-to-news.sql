-- Adicionar campo feed_id à tabela news para identificar de qual feed RSS veio cada notícia
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS feed_id UUID REFERENCES news_feeds(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_news_feed_id ON news(feed_id);

-- Comentário
COMMENT ON COLUMN news.feed_id IS 'Referência ao feed RSS do usuário que coletou esta notícia (NULL para notícias de adversários ou outras fontes)';



