-- Colunas extras para lideranças importadas do Engaja / Arena
ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS afiliacao_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaders_instagram_unique
  ON public.leaders (lower(instagram))
  WHERE instagram IS NOT NULL AND btrim(instagram) <> '';

COMMENT ON COLUMN public.leaders.instagram IS 'Handle Instagram da liderança (sem @, lowercase).';
COMMENT ON COLUMN public.leaders.email IS 'E-mail de contato da liderança.';
COMMENT ON COLUMN public.leaders.afiliacao_url IS 'Link de afiliação Engaja / cadastro.';
