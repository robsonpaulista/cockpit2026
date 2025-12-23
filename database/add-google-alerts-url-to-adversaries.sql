-- Adicionar coluna para URL do Google Alerts RSS feed na tabela adversaries
ALTER TABLE adversaries 
ADD COLUMN IF NOT EXISTS google_alerts_rss_url TEXT;

-- Comentário na coluna
COMMENT ON COLUMN adversaries.google_alerts_rss_url IS 'URL do feed RSS do Google Alerts para monitorar este adversário';




