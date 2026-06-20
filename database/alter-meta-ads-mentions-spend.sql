-- Campos de investimento/alcance da Meta Ads Library (Playwright)
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS spend_text TEXT;
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS spend_min_brl NUMERIC;
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS spend_max_brl NUMERIC;
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS impressions_text TEXT;
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS audience_size_text TEXT;
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS ads_in_group INT;

COMMENT ON COLUMN meta_ads_mentions.spend_text IS 'Valor gasto exibido na biblioteca (texto original, ex. R$2,5 mil a R$3 mil)';
COMMENT ON COLUMN meta_ads_mentions.spend_min_brl IS 'Estimativa mínima de gasto em BRL parseada do texto';
COMMENT ON COLUMN meta_ads_mentions.spend_max_brl IS 'Estimativa máxima de gasto em BRL parseada do texto';
