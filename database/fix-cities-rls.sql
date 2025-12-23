-- ============================================
-- CORREÇÃO RLS PARA TABELA CITIES
-- Execute no SQL Editor do Supabase
-- ============================================

-- Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'cities';

-- Se RLS estiver habilitado, criar políticas ou desabilitar temporariamente
-- Opção 1: Desabilitar RLS (mais simples para dados públicos como cidades)
ALTER TABLE cities DISABLE ROW LEVEL SECURITY;

-- OU Opção 2: Criar políticas permissivas (se quiser manter RLS)
-- DROP POLICY IF EXISTS "Anyone can read cities" ON cities;
-- DROP POLICY IF EXISTS "Authenticated users can insert cities" ON cities;
-- 
-- CREATE POLICY "Anyone can read cities"
--   ON cities FOR SELECT
--   TO public
--   USING (true);
-- 
-- CREATE POLICY "Authenticated users can insert cities"
--   ON cities FOR INSERT
--   TO authenticated
--   WITH CHECK (true);
-- 
-- CREATE POLICY "Authenticated users can update cities"
--   ON cities FOR UPDATE
--   TO authenticated
--   USING (true);

-- Verificar resultado
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'cities';



