-- ============================================
-- PÁGINAS E PERMISSÕES POR USUÁRIO
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Adicionar is_admin em profiles (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Tabela de páginas (rotas do dashboard)
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Permissões por perfil (quais páginas o usuário pode acessar)
CREATE TABLE IF NOT EXISTS profile_permissions (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (profile_id, page_key)
);

CREATE INDEX IF NOT EXISTS idx_profile_permissions_profile ON profile_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_permissions_page ON profile_permissions(page_key);

-- 4. Seed das páginas (alinhado ao menu e dashboard)
INSERT INTO pages (key, label, path) VALUES
  ('dashboard', 'Visão Geral', '/dashboard'),
  ('fases', 'Fases da Campanha', '/dashboard/fases'),
  ('narrativas', 'Bandeiras de Campanha', '/dashboard/narrativas'),
  ('campo', 'Campo & Agenda', '/dashboard/campo'),
  ('agenda', 'Agenda', '/dashboard/agenda'),
  ('territorio', 'Território & Base', '/dashboard/territorio'),
  ('chapas', 'Chapas', '/dashboard/chapas'),
  ('conteudo', 'Conteúdo & Redes', '/dashboard/conteudo'),
  ('noticias', 'Notícias & Crises', '/dashboard/noticias'),
  ('mobilizacao', 'Mobilização', '/dashboard/mobilizacao'),
  ('whatsapp', 'WhatsApp', '/dashboard/whatsapp'),
  ('pesquisa', 'Pesquisa & Relato', '/dashboard/pesquisa'),
  ('operacao', 'Operação & Equipe', '/dashboard/operacao'),
  ('juridico', 'Jurídico', '/dashboard/juridico'),
  ('obras', 'Obras', '/dashboard/obras'),
  ('usuarios', 'Gestão de Usuários', '/dashboard/usuarios')
ON CONFLICT (key) DO NOTHING;

-- 5. RLS para pages (todos autenticados podem ler)
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read pages" ON pages;
CREATE POLICY "Authenticated read pages" ON pages FOR SELECT TO authenticated USING (true);

-- 6. RLS para profile_permissions
ALTER TABLE profile_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own permissions" ON profile_permissions;
CREATE POLICY "Users read own permissions" ON profile_permissions FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Admins manage all permissions" ON profile_permissions;
CREATE POLICY "Admins manage all permissions" ON profile_permissions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- 7. Políticas adicionais em profiles para gestão por admin
-- (leitura de todos já existe; atualização por admin)
DROP POLICY IF EXISTS "Admins update any profile" ON profiles;
CREATE POLICY "Admins update any profile" ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (true);

COMMENT ON TABLE pages IS 'Páginas/rotas do dashboard para controle de permissão';
COMMENT ON TABLE profile_permissions IS 'Permissões de acesso por página por usuário (profile)';

-- Tornar o primeiro usuário admin (execute manualmente se necessário):
-- UPDATE profiles SET is_admin = true WHERE email = 'seu@email.com';
