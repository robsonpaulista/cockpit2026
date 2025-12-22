-- ============================================
-- CORREÇÃO RLS PARA TABELA PROFILES
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;

-- 2. Criar política permissiva para leitura (autenticados podem ver todos)
CREATE POLICY "Enable read access for authenticated users"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- 3. Criar política para usuários verem/atualizarem próprio perfil
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 4. Verificar se funcionou
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles';

-- Se ainda não funcionar, temporariamente desabilite RLS (APENAS PARA TESTE):
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;


