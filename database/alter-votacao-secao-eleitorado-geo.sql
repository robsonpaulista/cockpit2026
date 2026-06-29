-- Enriquecimento TSE: eleitorado por seção + geolocalização (Eleitorado por local de votação 2024)

ALTER TABLE public.votacao_secao_local
  ADD COLUMN IF NOT EXISTS qt_eleitores_secao INTEGER,
  ADD COLUMN IF NOT EXISTS nr_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS nr_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS nr_cep TEXT,
  ADD COLUMN IF NOT EXISTS ds_tipo_local TEXT,
  ADD COLUMN IF NOT EXISTS zona_rural BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_votacao_secao_local_geo
  ON public.votacao_secao_local (municipio_chave, nr_latitude, nr_longitude)
  WHERE nr_latitude IS NOT NULL AND nr_longitude IS NOT NULL;

COMMENT ON COLUMN public.votacao_secao_local.qt_eleitores_secao IS
  'QT_ELEITOR_SECAO — cadastro TSE Eleitorado por local de votação.';
COMMENT ON COLUMN public.votacao_secao_local.nr_latitude IS
  'NR_LATITUDE do cadastro TSE (local de votação).';
COMMENT ON COLUMN public.votacao_secao_local.nr_longitude IS
  'NR_LONGITUDE do cadastro TSE (local de votação).';
COMMENT ON COLUMN public.votacao_secao_local.zona_rural IS
  'Indicador heurístico rural (endereço/bairro TSE ou DS_TIPO_LOCAL).';
