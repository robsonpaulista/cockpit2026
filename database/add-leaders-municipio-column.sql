-- Adiciona coluna `municipio` em `leaders` (deploy incremental no Supabase).
ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS municipio TEXT;

CREATE INDEX IF NOT EXISTS idx_leaders_municipio ON public.leaders(municipio);

COMMENT ON COLUMN public.leaders.municipio IS 'Município do Piauí (base oficial dos 12 TDs / Mapa TDs).';
