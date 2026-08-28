-- ============================================
-- WAR ROOM — Pesquisas em andamento (campo)
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS public.war_room_pesquisas_andamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  instituto TEXT NOT NULL,
  cidade TEXT NOT NULL,
  cidade_id TEXT,
  status TEXT NOT NULL DEFAULT 'em_campo'
    CHECK (status IN ('planejada', 'em_campo', 'processando', 'entregue', 'atrasada')),
  finalizada_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_war_room_pesquisas_andamento_status_data
  ON public.war_room_pesquisas_andamento (status, data DESC);

CREATE INDEX IF NOT EXISTS idx_war_room_pesquisas_andamento_data
  ON public.war_room_pesquisas_andamento (data DESC);

COMMENT ON TABLE public.war_room_pesquisas_andamento IS
  'Pesquisas eleitorais em campo/tabulação, sem resultado ainda — card War Room.';

CREATE OR REPLACE FUNCTION public.war_room_pesquisas_andamento_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_war_room_pesquisas_andamento_updated_at
  ON public.war_room_pesquisas_andamento;
CREATE TRIGGER trg_war_room_pesquisas_andamento_updated_at
  BEFORE UPDATE ON public.war_room_pesquisas_andamento
  FOR EACH ROW
  EXECUTE FUNCTION public.war_room_pesquisas_andamento_set_updated_at();

ALTER TABLE public.war_room_pesquisas_andamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read war_room_pesquisas_andamento"
  ON public.war_room_pesquisas_andamento;
CREATE POLICY "Authenticated read war_room_pesquisas_andamento"
  ON public.war_room_pesquisas_andamento FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert war_room_pesquisas_andamento"
  ON public.war_room_pesquisas_andamento;
CREATE POLICY "Authenticated insert war_room_pesquisas_andamento"
  ON public.war_room_pesquisas_andamento FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update war_room_pesquisas_andamento"
  ON public.war_room_pesquisas_andamento;
CREATE POLICY "Authenticated update war_room_pesquisas_andamento"
  ON public.war_room_pesquisas_andamento FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete war_room_pesquisas_andamento"
  ON public.war_room_pesquisas_andamento;
CREATE POLICY "Authenticated delete war_room_pesquisas_andamento"
  ON public.war_room_pesquisas_andamento FOR DELETE
  TO authenticated
  USING (true);
