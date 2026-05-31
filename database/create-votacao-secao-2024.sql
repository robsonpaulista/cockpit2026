-- Votação por seção — Eleições Municipais 2024 / PI (fonte: TSE bweb)

CREATE TABLE IF NOT EXISTS public.votacao_secao_local (
  id UUID PRIMARY KEY,
  ano_eleicao INTEGER NOT NULL DEFAULT 2024,
  nr_turno INTEGER NOT NULL DEFAULT 1,
  sg_uf TEXT NOT NULL DEFAULT 'PI',
  cd_municipio TEXT,
  municipio_chave TEXT NOT NULL,
  nm_municipio TEXT NOT NULL,
  nr_zona INTEGER NOT NULL,
  nr_secao INTEGER NOT NULL,
  nr_local_votacao INTEGER,
  nm_local_votacao TEXT,
  ds_endereco TEXT,
  nm_bairro TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ano_eleicao, nr_turno, municipio_chave, nr_zona, nr_secao, nr_local_votacao)
);

CREATE TABLE IF NOT EXISTS public.votacao_secao_voto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id UUID NOT NULL REFERENCES public.votacao_secao_local(id) ON DELETE CASCADE,
  cd_cargo INTEGER NOT NULL,
  ds_cargo TEXT NOT NULL,
  nr_votavel INTEGER NOT NULL,
  nm_votavel TEXT NOT NULL,
  sq_candidato BIGINT,
  qt_votos INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (local_id, cd_cargo, nr_votavel)
);

CREATE INDEX IF NOT EXISTS idx_votacao_secao_local_municipio
  ON public.votacao_secao_local (ano_eleicao, municipio_chave);

CREATE INDEX IF NOT EXISTS idx_votacao_secao_local_zona_secao
  ON public.votacao_secao_local (municipio_chave, nr_zona, nr_secao);

CREATE INDEX IF NOT EXISTS idx_votacao_secao_local_bairro
  ON public.votacao_secao_local (municipio_chave, nm_bairro);

CREATE INDEX IF NOT EXISTS idx_votacao_secao_voto_local
  ON public.votacao_secao_voto (local_id);

CREATE INDEX IF NOT EXISTS idx_votacao_secao_voto_cargo
  ON public.votacao_secao_voto (local_id, ds_cargo);

COMMENT ON TABLE public.votacao_secao_local IS 'Locais de votação (zona/seção) por município — TSE bweb PI (2022 geral, 2024 municipal).';
COMMENT ON TABLE public.votacao_secao_voto IS 'Votos por candidato em cada seção — TSE bweb PI.';

ALTER TABLE public.votacao_secao_local ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votacao_secao_voto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read votacao_secao_local" ON public.votacao_secao_local;
CREATE POLICY "Authenticated read votacao_secao_local" ON public.votacao_secao_local
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert votacao_secao_local" ON public.votacao_secao_local;
CREATE POLICY "Authenticated insert votacao_secao_local" ON public.votacao_secao_local
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update votacao_secao_local" ON public.votacao_secao_local;
CREATE POLICY "Authenticated update votacao_secao_local" ON public.votacao_secao_local
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete votacao_secao_local" ON public.votacao_secao_local;
CREATE POLICY "Authenticated delete votacao_secao_local" ON public.votacao_secao_local
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read votacao_secao_voto" ON public.votacao_secao_voto;
CREATE POLICY "Authenticated read votacao_secao_voto" ON public.votacao_secao_voto
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert votacao_secao_voto" ON public.votacao_secao_voto;
CREATE POLICY "Authenticated insert votacao_secao_voto" ON public.votacao_secao_voto
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update votacao_secao_voto" ON public.votacao_secao_voto;
CREATE POLICY "Authenticated update votacao_secao_voto" ON public.votacao_secao_voto
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete votacao_secao_voto" ON public.votacao_secao_voto;
CREATE POLICY "Authenticated delete votacao_secao_voto" ON public.votacao_secao_voto
  FOR DELETE TO authenticated USING (true);
