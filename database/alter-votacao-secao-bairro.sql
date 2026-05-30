-- Enriquecimento: bairro oficial TSE (Eleitorado por local de votação 2024)

ALTER TABLE public.votacao_secao_local
  ADD COLUMN IF NOT EXISTS nm_bairro TEXT;

CREATE INDEX IF NOT EXISTS idx_votacao_secao_local_bairro
  ON public.votacao_secao_local (municipio_chave, nm_bairro);

COMMENT ON COLUMN public.votacao_secao_local.nm_bairro IS
  'Bairro oficial (NM_BAIRRO) — cadastro TSE Eleitorado por local de votação.';
