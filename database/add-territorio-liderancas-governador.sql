-- =========================================================
-- Base Eleitoral · territorio_liderancas
-- Coluna Governador + preenchimento inicial (Rafael)
-- Execute no SQL Editor do Supabase.
-- =========================================================

ALTER TABLE public.territorio_liderancas
  ADD COLUMN IF NOT EXISTS governador TEXT;

COMMENT ON COLUMN public.territorio_liderancas.governador IS
  'Governador associado à liderança (aliança / indicação).';

-- Preenche todas as linhas existentes com Rafael
UPDATE public.territorio_liderancas
SET
  governador = 'Rafael',
  updated_at = NOW()
WHERE governador IS NULL
   OR btrim(governador) = '';
