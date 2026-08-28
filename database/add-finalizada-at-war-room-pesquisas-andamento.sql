-- ============================================
-- WAR ROOM — Pesquisas em andamento: finalizada_at
-- Execute no SQL Editor do Supabase
-- ============================================

ALTER TABLE public.war_room_pesquisas_andamento
  ADD COLUMN IF NOT EXISTS finalizada_at TIMESTAMPTZ;

COMMENT ON COLUMN public.war_room_pesquisas_andamento.finalizada_at IS
  'Momento em que a pesquisa foi marcada como entregue; visível no card por 24h.';

-- Backfill: pesquisas já entregues usam updated_at como referência
UPDATE public.war_room_pesquisas_andamento
SET finalizada_at = updated_at
WHERE status = 'entregue' AND finalizada_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_war_room_pesquisas_andamento_finalizada_at
  ON public.war_room_pesquisas_andamento (finalizada_at DESC)
  WHERE status = 'entregue';
