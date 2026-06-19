-- Radar YouTube: atores políticos, termos de busca e menções em vídeos públicos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS political_actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  actor_type TEXT NOT NULL DEFAULT 'own_candidate'
    CHECK (actor_type IN ('own_candidate', 'competitor', 'ally', 'other')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS youtube_search_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politico_id UUID NOT NULL REFERENCES political_actors(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (politico_id, term)
);

CREATE TABLE IF NOT EXISTS youtube_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politico_id UUID NOT NULL REFERENCES political_actors(id) ON DELETE CASCADE,
  search_term TEXT NOT NULL,
  video_id TEXT NOT NULL,
  channel_id TEXT,
  channel_title TEXT,
  video_title TEXT NOT NULL,
  description TEXT,
  published_at TIMESTAMPTZ,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  tema TEXT,
  cidade TEXT,
  sentimento TEXT CHECK (sentimento IN ('positivo', 'negativo', 'neutro')),
  relevancia SMALLINT CHECK (relevancia IS NULL OR (relevancia >= 1 AND relevancia <= 5)),
  classified_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (politico_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_youtube_mentions_politico ON youtube_mentions(politico_id);
CREATE INDEX IF NOT EXISTS idx_youtube_mentions_published ON youtube_mentions(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_mentions_collected ON youtube_mentions(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_search_terms_politico ON youtube_search_terms(politico_id);

CREATE OR REPLACE FUNCTION update_youtube_radar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_political_actors_updated_at ON political_actors;
CREATE TRIGGER update_political_actors_updated_at
  BEFORE UPDATE ON political_actors
  FOR EACH ROW EXECUTE FUNCTION update_youtube_radar_updated_at();

DROP TRIGGER IF EXISTS update_youtube_search_terms_updated_at ON youtube_search_terms;
CREATE TRIGGER update_youtube_search_terms_updated_at
  BEFORE UPDATE ON youtube_search_terms
  FOR EACH ROW EXECUTE FUNCTION update_youtube_radar_updated_at();

DROP TRIGGER IF EXISTS update_youtube_mentions_updated_at ON youtube_mentions;
CREATE TRIGGER update_youtube_mentions_updated_at
  BEFORE UPDATE ON youtube_mentions
  FOR EACH ROW EXECUTE FUNCTION update_youtube_radar_updated_at();

ALTER TABLE political_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read political_actors" ON political_actors;
DROP POLICY IF EXISTS "Authenticated write political_actors" ON political_actors;
CREATE POLICY "Authenticated read political_actors" ON political_actors
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write political_actors" ON political_actors
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read youtube_search_terms" ON youtube_search_terms;
DROP POLICY IF EXISTS "Authenticated write youtube_search_terms" ON youtube_search_terms;
CREATE POLICY "Authenticated read youtube_search_terms" ON youtube_search_terms
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write youtube_search_terms" ON youtube_search_terms
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read youtube_mentions" ON youtube_mentions;
DROP POLICY IF EXISTS "Authenticated write youtube_mentions" ON youtube_mentions;
CREATE POLICY "Authenticated read youtube_mentions" ON youtube_mentions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write youtube_mentions" ON youtube_mentions
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Piloto: Jadyel Alencar + termo "Jadyel Alencar"
INSERT INTO political_actors (name, slug, actor_type, active, notes)
VALUES (
  'Jadyel Alencar',
  'jadyel-alencar',
  'own_candidate',
  TRUE,
  'Candidato próprio — piloto Radar YouTube'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO youtube_search_terms (politico_id, term, active, priority)
SELECT id, 'Jadyel Alencar', TRUE, 1
FROM political_actors
WHERE slug = 'jadyel-alencar'
ON CONFLICT (politico_id, term) DO NOTHING;

COMMENT ON TABLE political_actors IS 'Políticos monitorados no radar (próprio, concorrentes, aliados)';
COMMENT ON TABLE youtube_search_terms IS 'Termos de busca YouTube por ator político';
COMMENT ON TABLE youtube_mentions IS 'Vídeos públicos encontrados via search.list que mencionam o ator';
