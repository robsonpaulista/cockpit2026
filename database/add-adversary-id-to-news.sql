-- Adicionar campo adversary_id à tabela news para identificar notícias coletadas de feeds RSS de adversários
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS adversary_id UUID REFERENCES adversaries(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_news_adversary_id ON news(adversary_id);

-- Comentário
COMMENT ON COLUMN news.adversary_id IS 'Referência ao adversário cujo feed RSS coletou esta notícia (NULL para notícias gerais)';



