-- Adiciona coluna para link externo do SEI (site do governo)
ALTER TABLE obras
ADD COLUMN IF NOT EXISTS sei_url TEXT;

COMMENT ON COLUMN obras.sei_url IS 'URL para página do SEI no site do governo (abre ao clicar no link)';
