-- Lideranças · nova projeção "Previsto" ao lado da expectativa de votos 2026.
-- Rodar no SQL Editor do Supabase.

ALTER TABLE public.territorio_liderancas
  ADD COLUMN IF NOT EXISTS previsto_2026 NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.territorio_liderancas.previsto_2026 IS
  'Projeção "Previsto" de votos 2026 por liderança (editável na aba Lideranças).';

NOTIFY pgrst, 'reload schema';
