-- Views reais de vídeo/reels (Apify videoViewCount / Graph quando disponível)
ALTER TABLE instagram_radar_posts
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN instagram_radar_posts.views_count IS
  'Views de vídeo/reels (Apify videoViewCount). 0 em imagens ou quando a fonte não envia.';
