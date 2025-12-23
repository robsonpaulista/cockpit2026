-- ============================================
-- CORREÇÃO RLS PARA TABELA POLLS
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view their own polls" ON polls;
DROP POLICY IF EXISTS "Users can insert their own polls" ON polls;
DROP POLICY IF EXISTS "Users can update their own polls" ON polls;
DROP POLICY IF EXISTS "Users can delete their own polls" ON polls;

-- 2. Criar políticas corretas com TO authenticated
-- Política: Usuários autenticados podem ver suas próprias pesquisas
CREATE POLICY "Users can view their own polls"
  ON polls FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política: Usuários autenticados podem inserir suas próprias pesquisas
CREATE POLICY "Users can insert their own polls"
  ON polls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem atualizar suas próprias pesquisas
CREATE POLICY "Users can update their own polls"
  ON polls FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem deletar suas próprias pesquisas
CREATE POLICY "Users can delete their own polls"
  ON polls FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Verificar se funcionou
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'polls'
ORDER BY policyname;



