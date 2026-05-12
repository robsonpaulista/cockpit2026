-- ============================================
-- LOGS DE ENVIO WHATSAPP
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_send_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_email TEXT,
  recipient_jid TEXT NOT NULL,
  recipient_phone TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',
  cidade TEXT,
  message_length INTEGER NOT NULL DEFAULT 0,
  message_preview TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_status INTEGER,
  provider_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_logs_sender
  ON whatsapp_send_logs(sender_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_logs_recipient
  ON whatsapp_send_logs(recipient_jid);

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_logs_source
  ON whatsapp_send_logs(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_logs_cidade
  ON whatsapp_send_logs(cidade, created_at DESC);

ALTER TABLE whatsapp_send_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own whatsapp send logs" ON whatsapp_send_logs;
CREATE POLICY "Users can view own whatsapp send logs"
  ON whatsapp_send_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_user_id);

DROP POLICY IF EXISTS "Users can insert own whatsapp send logs" ON whatsapp_send_logs;
CREATE POLICY "Users can insert own whatsapp send logs"
  ON whatsapp_send_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_user_id);

DROP POLICY IF EXISTS "Admins can view all whatsapp send logs" ON whatsapp_send_logs;
CREATE POLICY "Admins can view all whatsapp send logs"
  ON whatsapp_send_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );

COMMENT ON TABLE whatsapp_send_logs IS 'Auditoria de envios feitos pela integração WhatsApp do Cockpit';
COMMENT ON COLUMN whatsapp_send_logs.message_preview IS 'Prévia curta da mensagem, para controle sem armazenar o conteúdo completo';
