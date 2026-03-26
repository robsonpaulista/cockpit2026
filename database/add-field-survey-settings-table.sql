-- Configuração do questionário de campo (listas, ordem, perguntas desativadas)
-- Execute no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.field_survey_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

INSERT INTO public.field_survey_settings (id, config)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.field_survey_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read field_survey_settings" ON public.field_survey_settings;
CREATE POLICY "Authenticated read field_survey_settings"
  ON public.field_survey_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita apenas via service role (API com checagem de permissão)

INSERT INTO public.pages (key, label, path)
VALUES ('gestao_pesquisas', 'Gestão de Pesquisas (Campo)', '/dashboard/gestao-pesquisas')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.field_survey_settings IS 'JSON: lists, questionOrder, disabledQuestionIds — ver app gestão de pesquisas.';
