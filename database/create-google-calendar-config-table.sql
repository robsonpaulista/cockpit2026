-- ============================================
-- TABELA PARA CONFIGURAÇÃO DO GOOGLE CALENDAR
-- ============================================

-- Tabela para armazenar configuração global do Google Calendar
CREATE TABLE IF NOT EXISTS google_calendar_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id TEXT NOT NULL,
  service_account_email TEXT NOT NULL,
  credentials TEXT NOT NULL, -- JSON das credenciais criptografado ou em texto
  subject_user TEXT, -- Email do usuário real para Domain-Wide Delegation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(id) -- Garantir apenas uma configuração
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_google_calendar_config_id ON google_calendar_config(id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_google_calendar_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_google_calendar_config_updated_at
  BEFORE UPDATE ON google_calendar_config
  FOR EACH ROW
  EXECUTE FUNCTION update_google_calendar_config_updated_at();

-- RLS Policies
ALTER TABLE google_calendar_config ENABLE ROW LEVEL SECURITY;

-- Política: Todos os usuários autenticados podem ver a configuração
CREATE POLICY "Authenticated users can view calendar config"
  ON google_calendar_config FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política: Apenas administradores podem inserir/atualizar (você pode ajustar isso)
-- Por enquanto, qualquer usuário autenticado pode atualizar
CREATE POLICY "Authenticated users can manage calendar config"
  ON google_calendar_config FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
