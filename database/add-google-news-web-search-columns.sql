-- Busca web (Google Programmable Search) + plataforma de origem nas menções
ALTER TABLE google_news_mentions
  ADD COLUMN IF NOT EXISTS collect_channel TEXT NOT NULL DEFAULT 'google_news_rss',
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'website';

CREATE INDEX IF NOT EXISTS idx_google_news_mentions_channel
  ON google_news_mentions(collect_channel);

CREATE INDEX IF NOT EXISTS idx_google_news_mentions_platform
  ON google_news_mentions(platform);

COMMENT ON COLUMN google_news_mentions.collect_channel IS
  'Canal de coleta: google_news_rss (Google Notícias) ou google_web (busca web / Programmable Search)';

COMMENT ON COLUMN google_news_mentions.platform IS
  'Plataforma inferida pela URL: website, instagram, facebook, youtube, twitter, tiktok, linkedin, other';
