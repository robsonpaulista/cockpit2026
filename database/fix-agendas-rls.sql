-- ============================================
-- CORREÇÃO RLS PARA TABELA AGENDAS
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Verificar se RLS está habilitado na tabela agendas
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'agendas';

-- 2. Verificar políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'agendas';

-- ============================================
-- 3. REMOVER POLÍTICAS ANTIGAS (se existirem)
-- ============================================
DROP POLICY IF EXISTS "Users can view their own agendas" ON agendas;
DROP POLICY IF EXISTS "Users can insert their own agendas" ON agendas;
DROP POLICY IF EXISTS "Users can update their own agendas" ON agendas;
DROP POLICY IF EXISTS "Users can delete their own agendas" ON agendas;
DROP POLICY IF EXISTS "Authenticated users can read agendas" ON agendas;
DROP POLICY IF EXISTS "Authenticated users can insert agendas" ON agendas;
DROP POLICY IF EXISTS "Authenticated users can update agendas" ON agendas;
DROP POLICY IF EXISTS "Authenticated users can delete agendas" ON agendas;

-- ============================================
-- 4. GARANTIR QUE RLS ESTÁ HABILITADO
-- ============================================
ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. CRIAR NOVAS POLÍTICAS
-- ============================================

-- Política para SELECT: usuários autenticados podem ver todas as agendas
-- (ajuste conforme necessidade - pode restringir por candidate_id = auth.uid())
CREATE POLICY "Authenticated users can read agendas"
  ON agendas FOR SELECT
  TO authenticated
  USING (true);

-- Política para INSERT: usuários autenticados podem criar agendas
-- O candidate_id deve ser o próprio usuário
CREATE POLICY "Authenticated users can insert agendas"
  ON agendas FOR INSERT
  TO authenticated
  WITH CHECK (candidate_id = auth.uid());

-- Política para UPDATE: usuários podem atualizar suas próprias agendas
CREATE POLICY "Users can update their own agendas"
  ON agendas FOR UPDATE
  TO authenticated
  USING (candidate_id = auth.uid())
  WITH CHECK (candidate_id = auth.uid());

-- Política para DELETE: usuários podem deletar suas próprias agendas
CREATE POLICY "Users can delete their own agendas"
  ON agendas FOR DELETE
  TO authenticated
  USING (candidate_id = auth.uid());

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
WHERE tablename = 'agendas';

-- ============================================
-- ALTERNATIVA: Se a tabela não tiver a coluna candidate_id
-- ou se quiser permitir qualquer usuário autenticado
-- ============================================

-- Descomente as linhas abaixo se precisar de políticas mais permissivas:

-- DROP POLICY IF EXISTS "Authenticated users can insert agendas" ON agendas;
-- CREATE POLICY "Authenticated users can insert agendas"
--   ON agendas FOR INSERT
--   TO authenticated
--   WITH CHECK (true);

-- DROP POLICY IF EXISTS "Users can update their own agendas" ON agendas;
-- CREATE POLICY "Authenticated users can update agendas"
--   ON agendas FOR UPDATE
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- DROP POLICY IF EXISTS "Users can delete their own agendas" ON agendas;
-- CREATE POLICY "Authenticated users can delete agendas"
--   ON agendas FOR DELETE
--   TO authenticated
--   USING (true);

