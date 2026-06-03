-- ============================================
-- HISTÓRICO DE MOVIMENTAÇÕES — JURÍDICO
-- Execute no SQL Editor do Supabase
-- ============================================
-- Mantém todas as movimentações registradas por processo (CNJ como chave).
-- A planilha JSON continua como base; este histórico é atualizado pela equipe.

CREATE TABLE IF NOT EXISTS public.juridico_processo_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id TEXT NOT NULL,
  descricao TEXT NOT NULL,
  data_movimentacao DATE,
  status_processo TEXT,
  observacoes TEXT,
  fonte TEXT NOT NULL DEFAULT 'manual'
    CHECK (fonte IN ('manual', 'planilha', 'datajud')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_juridico_mov_processo_id
  ON public.juridico_processo_movimentacoes (processo_id);

CREATE INDEX IF NOT EXISTS idx_juridico_mov_processo_data
  ON public.juridico_processo_movimentacoes (processo_id, data_movimentacao DESC NULLS LAST, created_at DESC);

COMMENT ON TABLE public.juridico_processo_movimentacoes IS
  'Histórico de movimentações dos processos Dimensão (atualização manual e importações)';

ALTER TABLE public.juridico_processo_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view juridico movimentacoes"
  ON public.juridico_processo_movimentacoes;
CREATE POLICY "Authenticated users can view juridico movimentacoes"
  ON public.juridico_processo_movimentacoes FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage juridico movimentacoes"
  ON public.juridico_processo_movimentacoes;
CREATE POLICY "Authenticated users can manage juridico movimentacoes"
  ON public.juridico_processo_movimentacoes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
