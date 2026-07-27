-- ============================================
-- Distâncias rodoviárias entre municípios (cache)
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS municipio_distancia_estrada (
  origem_norm TEXT NOT NULL,
  destino_norm TEXT NOT NULL,
  origem_nome TEXT NOT NULL,
  destino_nome TEXT NOT NULL,
  km NUMERIC(10, 2) NOT NULL CHECK (km >= 0),
  segundos INTEGER CHECK (segundos IS NULL OR segundos >= 0),
  provedor TEXT NOT NULL DEFAULT 'openrouteservice',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (origem_norm, destino_norm)
);

CREATE INDEX IF NOT EXISTS idx_municipio_distancia_estrada_destino
  ON municipio_distancia_estrada (destino_norm);

CREATE INDEX IF NOT EXISTS idx_municipio_distancia_estrada_updated
  ON municipio_distancia_estrada (updated_at DESC);

ALTER TABLE municipio_distancia_estrada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read municipio distancia estrada"
  ON municipio_distancia_estrada;
CREATE POLICY "Authenticated can read municipio distancia estrada"
  ON municipio_distancia_estrada FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert municipio distancia estrada"
  ON municipio_distancia_estrada;
CREATE POLICY "Authenticated can insert municipio distancia estrada"
  ON municipio_distancia_estrada FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update municipio distancia estrada"
  ON municipio_distancia_estrada;
CREATE POLICY "Authenticated can update municipio distancia estrada"
  ON municipio_distancia_estrada FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE municipio_distancia_estrada IS
  'Cache de km rodoviários entre sedes municipais (ORS Matrix). Distâncias quase estáticas.';
COMMENT ON COLUMN municipio_distancia_estrada.origem_norm IS
  'Município origem normalizado (normalizeIptMunicipio)';
COMMENT ON COLUMN municipio_distancia_estrada.destino_norm IS
  'Município destino normalizado (normalizeIptMunicipio)';
