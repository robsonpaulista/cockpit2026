-- ============================================
-- RLS POLICIES PARA NARRATIVAS
-- ============================================

-- Habilitar RLS (se ainda não estiver habilitado)
ALTER TABLE narratives ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_usage ENABLE ROW LEVEL SECURITY;

-- Políticas para narratives
-- Todos os usuários autenticados podem ler narrativas
DROP POLICY IF EXISTS "Authenticated users can read narratives" ON narratives;
CREATE POLICY "Authenticated users can read narratives"
  ON narratives FOR SELECT
  TO authenticated
  USING (true);

-- Todos os usuários autenticados podem criar narrativas
DROP POLICY IF EXISTS "Authenticated users can insert narratives" ON narratives;
CREATE POLICY "Authenticated users can insert narratives"
  ON narratives FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Todos os usuários autenticados podem atualizar narrativas
DROP POLICY IF EXISTS "Authenticated users can update narratives" ON narratives;
CREATE POLICY "Authenticated users can update narratives"
  ON narratives FOR UPDATE
  TO authenticated
  USING (true);

-- Todos os usuários autenticados podem deletar narrativas
DROP POLICY IF EXISTS "Authenticated users can delete narratives" ON narratives;
CREATE POLICY "Authenticated users can delete narratives"
  ON narratives FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para narrative_usage
-- Todos os usuários autenticados podem ler uso de narrativas
DROP POLICY IF EXISTS "Authenticated users can read narrative usage" ON narrative_usage;
CREATE POLICY "Authenticated users can read narrative usage"
  ON narrative_usage FOR SELECT
  TO authenticated
  USING (true);

-- Todos os usuários autenticados podem criar registro de uso
DROP POLICY IF EXISTS "Authenticated users can insert narrative usage" ON narrative_usage;
CREATE POLICY "Authenticated users can insert narrative usage"
  ON narrative_usage FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Adicionar campo status se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'narratives' AND column_name = 'status'
  ) THEN
    ALTER TABLE narratives ADD COLUMN status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'rascunho', 'arquivada'));
  END IF;
END $$;

-- Criar trigger para updated_at se não existir
CREATE OR REPLACE FUNCTION update_narratives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_narratives_updated_at ON narratives;
CREATE TRIGGER update_narratives_updated_at
  BEFORE UPDATE ON narratives
  FOR EACH ROW
  EXECUTE FUNCTION update_narratives_updated_at();












