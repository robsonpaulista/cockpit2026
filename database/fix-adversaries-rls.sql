-- Corrigir políticas RLS para a tabela adversaries
-- Permitir que usuários autenticados possam inserir, atualizar e deletar seus próprios adversários

-- Remover política antiga se existir
DROP POLICY IF EXISTS "Authenticated users can read adversaries" ON adversaries;

-- Criar políticas completas
CREATE POLICY "Authenticated users can read all adversaries" ON adversaries
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert adversaries" ON adversaries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update adversaries" ON adversaries
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete adversaries" ON adversaries
  FOR DELETE USING (auth.role() = 'authenticated');


