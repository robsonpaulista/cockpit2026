-- ============================================
-- CORREÇÃO RLS PARA TABELA VISITS
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Verificar se RLS está habilitado na tabela visits
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'visits';

-- 2. Verificar políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'visits';

-- ============================================
-- 3. REMOVER POLÍTICAS ANTIGAS (se existirem)
-- ============================================
DROP POLICY IF EXISTS "Users can view visits" ON visits;
DROP POLICY IF EXISTS "Users can insert visits" ON visits;
DROP POLICY IF EXISTS "Users can update visits" ON visits;
DROP POLICY IF EXISTS "Users can delete visits" ON visits;
DROP POLICY IF EXISTS "Authenticated users can read visits" ON visits;
DROP POLICY IF EXISTS "Authenticated users can insert visits" ON visits;
DROP POLICY IF EXISTS "Authenticated users can update visits" ON visits;
DROP POLICY IF EXISTS "Authenticated users can delete visits" ON visits;

-- ============================================
-- 4. GARANTIR QUE RLS ESTÁ HABILITADO
-- ============================================
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. CRIAR NOVAS POLÍTICAS (permissivas para usuários autenticados)
-- ============================================

-- Política para SELECT: usuários autenticados podem ver todas as visitas
CREATE POLICY "Authenticated users can read visits"
  ON visits FOR SELECT
  TO authenticated
  USING (true);

-- Política para INSERT: usuários autenticados podem criar visitas
CREATE POLICY "Authenticated users can insert visits"
  ON visits FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para UPDATE: usuários autenticados podem atualizar visitas
CREATE POLICY "Authenticated users can update visits"
  ON visits FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para DELETE: usuários autenticados podem deletar visitas
CREATE POLICY "Authenticated users can delete visits"
  ON visits FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- 6. VERIFICAR RESULTADO
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'visits';

-- ============================================
-- TAMBÉM CORRIGIR TABELA AGENDAS (caso ainda não tenha feito)
-- ============================================

-- Remover políticas antigas de agendas
DROP POLICY IF EXISTS "Users can view their own agendas" ON agendas;
DROP POLICY IF EXISTS "Users can insert their own agendas" ON agendas;
DROP POLICY IF EXISTS "Users can update their own agendas" ON agendas;
DROP POLICY IF EXISTS "Users can delete their own agendas" ON agendas;
DROP POLICY IF EXISTS "Authenticated users can read agendas" ON agendas;
DROP POLICY IF EXISTS "Authenticated users can insert agendas" ON agendas;
DROP POLICY IF EXISTS "Authenticated users can update agendas" ON agendas;
DROP POLICY IF EXISTS "Authenticated users can delete agendas" ON agendas;

-- Habilitar RLS em agendas
ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;

-- Criar políticas para agendas
CREATE POLICY "Authenticated users can read agendas"
  ON agendas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert agendas"
  ON agendas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update agendas"
  ON agendas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete agendas"
  ON agendas FOR DELETE
  TO authenticated
  USING (true);

-- Verificar políticas de agendas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'agendas';

