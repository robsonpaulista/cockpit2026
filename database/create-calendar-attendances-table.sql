-- ============================================
-- TABELA PARA STATUS DE ATENDIMENTOS DA AGENDA
-- ============================================

-- Tabela de atendimentos de eventos do Google Calendar
CREATE TABLE IF NOT EXISTS calendar_attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL, -- ID do evento do Google Calendar
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attended BOOLEAN NOT NULL DEFAULT FALSE, -- true = atendido, false = não atendido
  notes TEXT, -- Observações sobre o atendimento
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id) -- Um usuário só pode ter um registro por evento
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_calendar_attendances_event_id ON calendar_attendances(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_attendances_user_id ON calendar_attendances(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_attendances_attended ON calendar_attendances(attended);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_calendar_attendances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_attendances_updated_at
  BEFORE UPDATE ON calendar_attendances
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_attendances_updated_at();

-- RLS Policies
ALTER TABLE calendar_attendances ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver seus próprios atendimentos
CREATE POLICY "Users can view their own attendances"
  ON calendar_attendances FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários podem inserir seus próprios atendimentos
CREATE POLICY "Users can insert their own attendances"
  ON calendar_attendances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar seus próprios atendimentos
CREATE POLICY "Users can update their own attendances"
  ON calendar_attendances FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar seus próprios atendimentos
CREATE POLICY "Users can delete their own attendances"
  ON calendar_attendances FOR DELETE
  USING (auth.uid() = user_id);
