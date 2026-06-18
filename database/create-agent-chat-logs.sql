-- ============================================
-- LOG SYSTEM — perguntas e respostas do Jarvis
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS agent_chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_email TEXT,
  session_id TEXT,
  page_path TEXT,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'client',
  intent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_chat_logs_user_created
  ON agent_chat_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_chat_logs_created
  ON agent_chat_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_chat_logs_session
  ON agent_chat_logs(session_id, created_at DESC);

ALTER TABLE agent_chat_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own agent chat logs" ON agent_chat_logs;
CREATE POLICY "Users insert own agent chat logs"
  ON agent_chat_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own agent chat logs" ON agent_chat_logs;
CREATE POLICY "Users read own agent chat logs"
  ON agent_chat_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all agent chat logs" ON agent_chat_logs;
CREATE POLICY "Admins read all agent chat logs"
  ON agent_chat_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

INSERT INTO pages (key, label, path) VALUES
  ('log_system', 'Log System', '/dashboard/log-system')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE agent_chat_logs IS 'Auditoria de perguntas e respostas do Jarvis / agente do Cockpit';
