-- ============================================
-- CADASTRO DE CONTATOS WHATSAPP (Cockpit / Jarvis)
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cargo TEXT,
  categoria TEXT NOT NULL DEFAULT 'geral'
    CHECK (categoria IN ('geral', 'executivo', 'assessoria', 'territorio')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  notas TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_telefone_unique
  ON whatsapp_contacts (telefone)
  WHERE ativo = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_one_default
  ON whatsapp_contacts ((true))
  WHERE is_default = true AND ativo = true;

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_nome
  ON whatsapp_contacts (nome)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_categoria
  ON whatsapp_contacts (categoria)
  WHERE ativo = true;

CREATE OR REPLACE FUNCTION update_whatsapp_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_whatsapp_contacts_updated_at ON whatsapp_contacts;
CREATE TRIGGER trg_whatsapp_contacts_updated_at
  BEFORE UPDATE ON whatsapp_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_contacts_updated_at();

ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view whatsapp contacts" ON whatsapp_contacts;
CREATE POLICY "Authenticated users can view whatsapp contacts"
  ON whatsapp_contacts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage whatsapp contacts" ON whatsapp_contacts;
CREATE POLICY "Authenticated users can manage whatsapp contacts"
  ON whatsapp_contacts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE whatsapp_contacts IS 'Agenda de contatos para envio rápido de WhatsApp (Resumo Operacional, briefing, Jarvis)';
COMMENT ON COLUMN whatsapp_contacts.telefone IS 'Somente dígitos, com DDI quando aplicável (ex.: 5586998107492)';
COMMENT ON COLUMN whatsapp_contacts.categoria IS 'executivo | assessoria | territorio | geral — filtro opcional no UI';

-- Exemplo (ajuste antes de rodar):
-- INSERT INTO whatsapp_contacts (nome, telefone, cargo, categoria, is_default)
-- VALUES ('CEO', '5586998107492', 'Candidato', 'executivo', true);
