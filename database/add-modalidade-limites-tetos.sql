-- Distinção emenda individual vs coletiva nos tetos MAC/PAP
-- Execute no SQL Editor do Supabase após create-limites-tetos.sql

ALTER TABLE public.limites_pap
  ADD COLUMN IF NOT EXISTS modalidade TEXT NOT NULL DEFAULT 'individual';

ALTER TABLE public.limites_mac_municipio
  ADD COLUMN IF NOT EXISTS modalidade TEXT NOT NULL DEFAULT 'individual';

UPDATE public.limites_pap SET modalidade = 'individual' WHERE modalidade IS NULL OR modalidade = '';
UPDATE public.limites_mac_municipio SET modalidade = 'individual' WHERE modalidade IS NULL OR modalidade = '';

ALTER TABLE public.limites_pap
  DROP CONSTRAINT IF EXISTS limites_pap_exercicio_municipio_chave_key;

ALTER TABLE public.limites_mac_municipio
  DROP CONSTRAINT IF EXISTS limites_mac_municipio_exercicio_municipio_chave_key;

ALTER TABLE public.limites_pap
  ADD CONSTRAINT limites_pap_exercicio_municipio_modalidade_key
  UNIQUE (exercicio, municipio_chave, modalidade);

ALTER TABLE public.limites_mac_municipio
  ADD CONSTRAINT limites_mac_exercicio_municipio_modalidade_key
  UNIQUE (exercicio, municipio_chave, modalidade);

ALTER TABLE public.limites_pap
  DROP CONSTRAINT IF EXISTS limites_pap_modalidade_check;

ALTER TABLE public.limites_pap
  ADD CONSTRAINT limites_pap_modalidade_check
  CHECK (modalidade IN ('individual', 'coletiva'));

ALTER TABLE public.limites_mac_municipio
  DROP CONSTRAINT IF EXISTS limites_mac_modalidade_check;

ALTER TABLE public.limites_mac_municipio
  ADD CONSTRAINT limites_mac_modalidade_check
  CHECK (modalidade IN ('individual', 'coletiva'));

CREATE INDEX IF NOT EXISTS idx_limites_pap_modalidade
  ON public.limites_pap (exercicio, modalidade);

CREATE INDEX IF NOT EXISTS idx_limites_mac_modalidade
  ON public.limites_mac_municipio (exercicio, modalidade);
