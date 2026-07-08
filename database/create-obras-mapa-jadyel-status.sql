-- Status editável das obras do mapa (planilhas Jadyel 2023-24, 2025, 2026)
CREATE TABLE IF NOT EXISTS public.obras_mapa_jadyel_status (
  obra_id TEXT PRIMARY KEY,
  status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_obras_mapa_jadyel_status_updated
  ON public.obras_mapa_jadyel_status(updated_at DESC);

ALTER TABLE public.obras_mapa_jadyel_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read obras_mapa_jadyel_status" ON public.obras_mapa_jadyel_status;
CREATE POLICY "Authenticated read obras_mapa_jadyel_status"
  ON public.obras_mapa_jadyel_status FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated write obras_mapa_jadyel_status" ON public.obras_mapa_jadyel_status;
CREATE POLICY "Authenticated write obras_mapa_jadyel_status"
  ON public.obras_mapa_jadyel_status FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.obras_mapa_jadyel_status IS
  'Status informado pelo usuário para obras do mapa (fonte: planilhas Jadyel).';
