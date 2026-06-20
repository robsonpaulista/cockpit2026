-- Segmentação geográfica e distribuição regional (Meta Ads Library — detalhe do anúncio)
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS target_locations_text TEXT;
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS target_locations JSONB;
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS delivery_by_region_text TEXT;
ALTER TABLE meta_ads_mentions ADD COLUMN IF NOT EXISTS delivery_by_region JSONB;

COMMENT ON COLUMN meta_ads_mentions.target_locations_text IS 'Localizações segmentadas (texto original: cidades/estados incluídos ou excluídos)';
COMMENT ON COLUMN meta_ads_mentions.target_locations IS 'Array JSON [{ name, excluded? }] parseado da biblioteca';
COMMENT ON COLUMN meta_ads_mentions.delivery_by_region_text IS 'Distribuição regional do alcance (texto original)';
COMMENT ON COLUMN meta_ads_mentions.delivery_by_region IS 'Array JSON [{ region, pct }] — % de contas alcançadas por região/estado';
    