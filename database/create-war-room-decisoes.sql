-- ============================================
-- WAR ROOM — Fila de decisões / alertas
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS war_room_decisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  prioridade TEXT NOT NULL
    CHECK (prioridade IN ('critica', 'alta', 'media', 'baixa', 'info')),
  categoria TEXT NOT NULL,
  icone TEXT NOT NULL DEFAULT 'info'
    CHECK (icone IN ('alerta', 'mensagem', 'bandeira', 'documento', 'info')),
  destaque BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_andamento', 'resolvida', 'arquivada')),
  href TEXT,
  contexto TEXT,
  responsavel TEXT,
  prazo TIMESTAMPTZ,
  acao TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_war_room_decisoes_status_prioridade
  ON war_room_decisoes (status, prioridade, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_war_room_decisoes_created
  ON war_room_decisoes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_war_room_decisoes_categoria
  ON war_room_decisoes (categoria, status);

COMMENT ON TABLE war_room_decisoes IS
  'Fila de decisões e alertas operacionais da War Room';

COMMENT ON COLUMN war_room_decisoes.titulo IS
  'Texto principal exibido no card (ex.: Aprovar nova peça – Rádio)';

COMMENT ON COLUMN war_room_decisoes.destaque IS
  'Destaca o item na lista (fundo/ícone de alerta)';

-- updated_at automático
CREATE OR REPLACE FUNCTION war_room_decisoes_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_war_room_decisoes_updated_at ON war_room_decisoes;
CREATE TRIGGER trg_war_room_decisoes_updated_at
  BEFORE UPDATE ON war_room_decisoes
  FOR EACH ROW
  EXECUTE FUNCTION war_room_decisoes_set_updated_at();

ALTER TABLE war_room_decisoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read war_room_decisoes" ON war_room_decisoes;
CREATE POLICY "Authenticated read war_room_decisoes"
  ON war_room_decisoes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert war_room_decisoes" ON war_room_decisoes;
CREATE POLICY "Authenticated insert war_room_decisoes"
  ON war_room_decisoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update war_room_decisoes" ON war_room_decisoes;
CREATE POLICY "Authenticated update war_room_decisoes"
  ON war_room_decisoes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete war_room_decisoes" ON war_room_decisoes;
CREATE POLICY "Authenticated delete war_room_decisoes"
  ON war_room_decisoes FOR DELETE
  TO authenticated
  USING (true);

-- Sem seed de exemplo: a fila exibe só registros reais inseridos pelo sistema.
