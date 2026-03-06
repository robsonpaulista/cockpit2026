-- Habilita base compartilhada de Chapas (Federal e Estadual) para todos os usuários autenticados.
-- Remove isolamento por user_id nas políticas RLS dessas tabelas.

ALTER TABLE chapas_cenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapas_partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapas_configuracoes ENABLE ROW LEVEL SECURITY;

-- chapas_cenarios
DROP POLICY IF EXISTS "Users can view their own scenarios" ON chapas_cenarios;
DROP POLICY IF EXISTS "Users can insert their own scenarios" ON chapas_cenarios;
DROP POLICY IF EXISTS "Users can update their own scenarios" ON chapas_cenarios;
DROP POLICY IF EXISTS "Users can delete their own scenarios" ON chapas_cenarios;

CREATE POLICY "Authenticated users can read chapas cenarios"
  ON chapas_cenarios FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert chapas cenarios"
  ON chapas_cenarios FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update chapas cenarios"
  ON chapas_cenarios FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete chapas cenarios"
  ON chapas_cenarios FOR DELETE TO authenticated
  USING (true);

-- chapas_partidos
DROP POLICY IF EXISTS "Users can view their own parties" ON chapas_partidos;
DROP POLICY IF EXISTS "Users can insert their own parties" ON chapas_partidos;
DROP POLICY IF EXISTS "Users can update their own parties" ON chapas_partidos;
DROP POLICY IF EXISTS "Users can delete their own parties" ON chapas_partidos;

CREATE POLICY "Authenticated users can read chapas partidos"
  ON chapas_partidos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert chapas partidos"
  ON chapas_partidos FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update chapas partidos"
  ON chapas_partidos FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete chapas partidos"
  ON chapas_partidos FOR DELETE TO authenticated
  USING (true);

-- chapas_configuracoes
DROP POLICY IF EXISTS "Users can view their own configurations" ON chapas_configuracoes;
DROP POLICY IF EXISTS "Users can insert their own configurations" ON chapas_configuracoes;
DROP POLICY IF EXISTS "Users can update their own configurations" ON chapas_configuracoes;
DROP POLICY IF EXISTS "Users can delete their own configurations" ON chapas_configuracoes;

CREATE POLICY "Authenticated users can read chapas configuracoes"
  ON chapas_configuracoes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert chapas configuracoes"
  ON chapas_configuracoes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update chapas configuracoes"
  ON chapas_configuracoes FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete chapas configuracoes"
  ON chapas_configuracoes FOR DELETE TO authenticated
  USING (true);
