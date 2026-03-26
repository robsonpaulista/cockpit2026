-- ============================================
-- Role pesquisadores + entrevistas de campo (PI 2026)
-- Execute no SQL Editor do Supabase após backup.
-- ============================================

-- 1) Ampliar CHECK de role em profiles
-- Remove qualquer CHECK que envolva a coluna "role" (o nome da constraint pode variar no PG)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (
  role IN (
    'candidato',
    'coordenacao',
    'comunicacao',
    'articulacao',
    'juridico',
    'bi',
    'pesquisadores'
  )
);

-- 2) Página opcional (permissões do dashboard — pesquisadores não usam menu)
INSERT INTO public.pages (key, label, path)
VALUES ('pesquisador_campo', 'Pesquisa de Campo', '/pesquisador')
ON CONFLICT (key) DO NOTHING;

-- 3) Respostas de campo (JSONB flexível para o questionário)
CREATE TABLE IF NOT EXISTS public.field_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  local_client_id TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  questionnaire_version TEXT NOT NULL DEFAULT 'pi2026_premium_v1',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (interviewer_id, local_client_id)
);

CREATE INDEX IF NOT EXISTS idx_field_survey_interviewer ON public.field_survey_responses (interviewer_id);
CREATE INDEX IF NOT EXISTS idx_field_survey_created ON public.field_survey_responses (created_at DESC);

ALTER TABLE public.field_survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pesquisadores insert own field surveys" ON public.field_survey_responses;
CREATE POLICY "Pesquisadores insert own field surveys"
  ON public.field_survey_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = interviewer_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'pesquisadores'
    )
  );

DROP POLICY IF EXISTS "Pesquisadores select own field surveys" ON public.field_survey_responses;
CREATE POLICY "Pesquisadores select own field surveys"
  ON public.field_survey_responses
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = interviewer_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'pesquisadores'
    )
  );

DROP POLICY IF EXISTS "Pesquisadores update own field surveys" ON public.field_survey_responses;
CREATE POLICY "Pesquisadores update own field surveys"
  ON public.field_survey_responses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = interviewer_id)
  WITH CHECK (auth.uid() = interviewer_id);

-- Admins podem ler todas (BI / auditoria)
DROP POLICY IF EXISTS "Admins read all field surveys" ON public.field_survey_responses;
CREATE POLICY "Admins read all field surveys"
  ON public.field_survey_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Trigger updated_at (reusa função global se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_field_survey_responses_updated_at ON public.field_survey_responses;
    CREATE TRIGGER update_field_survey_responses_updated_at
      BEFORE UPDATE ON public.field_survey_responses
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE public.field_survey_responses IS 'Entrevistas PI 2026 — respostas JSON; local_client_id idempotente por entrevistador.';
