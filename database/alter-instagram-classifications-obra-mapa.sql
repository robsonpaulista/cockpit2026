-- Vincular post do Instagram a uma obra do mapa (planilha Jadyel / IPT).
-- IDs em data/obras-jadyel.json (texto), NÃO UUID da tabela operacional `obras`.

ALTER TABLE instagram_post_classifications
  ADD COLUMN IF NOT EXISTS obra_mapa_id TEXT;

CREATE INDEX IF NOT EXISTS idx_instagram_classifications_obra_mapa_id
  ON instagram_post_classifications(obra_mapa_id)
  WHERE obra_mapa_id IS NOT NULL;

COMMENT ON COLUMN instagram_post_classifications.obra_mapa_id IS
  'ID da obra no mapa Jadyel (mesma fonte do IPT / Mapa de Obras). Null = sem vínculo.';
