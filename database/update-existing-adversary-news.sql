-- Script para atualizar notícias existentes que foram coletadas de feeds RSS de adversários
-- Este script identifica notícias que têm o campo 'actor' preenchido com o nome de um adversário
-- e atualiza o campo adversary_id correspondente

-- Primeiro, garantir que a coluna existe
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS adversary_id UUID REFERENCES adversaries(id) ON DELETE SET NULL;

-- Criar índice se não existir
CREATE INDEX IF NOT EXISTS idx_news_adversary_id ON news(adversary_id);

-- Atualizar notícias existentes baseado no campo 'actor'
-- Isso funciona porque na coleta de adversários, o campo 'actor' é preenchido com o nome do adversário
UPDATE news n
SET adversary_id = a.id
FROM adversaries a
WHERE n.actor = a.name
  AND n.adversary_id IS NULL;

-- Verificar quantas notícias foram atualizadas
SELECT 
  COUNT(*) as total_noticias,
  COUNT(adversary_id) as noticias_com_adversary_id,
  COUNT(*) - COUNT(adversary_id) as noticias_sem_adversary_id
FROM news;

