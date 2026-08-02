-- Vínculo obra (Mapa de Obras / Demandas) ↔ arquivo de plano no Drive
-- ou texto quando o plano ainda não está disponível.
CREATE TABLE IF NOT EXISTS public.obras_mapa_plano_drive (
  obra_id TEXT PRIMARY KEY,
  drive_file_id TEXT,
  drive_file_name TEXT,
  drive_web_view_link TEXT,
  nota_texto TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT obras_mapa_plano_drive_conteudo_chk CHECK (
    (drive_file_id IS NOT NULL AND length(trim(drive_file_id)) > 0)
    OR (nota_texto IS NOT NULL AND length(trim(nota_texto)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_obras_mapa_plano_drive_updated
  ON public.obras_mapa_plano_drive(updated_at DESC);

ALTER TABLE public.obras_mapa_plano_drive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read obras_mapa_plano_drive" ON public.obras_mapa_plano_drive;
CREATE POLICY "Authenticated read obras_mapa_plano_drive"
  ON public.obras_mapa_plano_drive FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated write obras_mapa_plano_drive" ON public.obras_mapa_plano_drive;
CREATE POLICY "Authenticated write obras_mapa_plano_drive"
  ON public.obras_mapa_plano_drive FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.obras_mapa_plano_drive IS
  'Plano de trabalho no Drive (ou nota textual) vinculado a obra do Mapa de Obras.';
