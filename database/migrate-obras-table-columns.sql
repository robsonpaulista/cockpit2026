-- ============================================
-- MIGRAÇÃO: ATUALIZAR COLUNAS DA TABELA OBRAS
-- ============================================
-- Este script atualiza a tabela obras para corresponder às colunas do Excel geralobras.xlsx
-- Execute apenas se a tabela já foi criada com a estrutura antiga

-- 1. Renomear colunas existentes (se necessário) ou adicionar novas
DO $$ 
BEGIN
  -- Adicionar novas colunas se não existirem
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='municipio') THEN
    ALTER TABLE obras ADD COLUMN municipio TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='obra') THEN
    -- Se nome_obra existe, renomear para obra
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='nome_obra') THEN
      ALTER TABLE obras RENAME COLUMN nome_obra TO obra;
    ELSE
      ALTER TABLE obras ADD COLUMN obra TEXT NOT NULL DEFAULT '';
    END IF;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='orgao') THEN
    ALTER TABLE obras ADD COLUMN orgao TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='sei') THEN
    ALTER TABLE obras ADD COLUMN sei TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='sei_medicao') THEN
    ALTER TABLE obras ADD COLUMN sei_medicao TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='publicacao_os') THEN
    ALTER TABLE obras ADD COLUMN publicacao_os DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='solicitacao_medicao') THEN
    ALTER TABLE obras ADD COLUMN solicitacao_medicao DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='data_medicao') THEN
    ALTER TABLE obras ADD COLUMN data_medicao DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='status_medicao') THEN
    ALTER TABLE obras ADD COLUMN status_medicao TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='obras' AND column_name='valor_total') THEN
    ALTER TABLE obras ADD COLUMN valor_total DECIMAL(15, 2);
  END IF;
END $$;

-- 2. Remover colunas antigas que não são mais necessárias (opcional - descomente se quiser remover)
-- ALTER TABLE obras DROP COLUMN IF EXISTS localizacao;
-- ALTER TABLE obras DROP COLUMN IF EXISTS cidade;
-- ALTER TABLE obras DROP COLUMN IF EXISTS estado;
-- ALTER TABLE obras DROP COLUMN IF EXISTS tipo_obra;
-- ALTER TABLE obras DROP COLUMN IF EXISTS data_inicio;
-- ALTER TABLE obras DROP COLUMN IF EXISTS data_prevista_conclusao;
-- ALTER TABLE obras DROP COLUMN IF EXISTS data_conclusao;
-- ALTER TABLE obras DROP COLUMN IF EXISTS valor_orcado;
-- ALTER TABLE obras DROP COLUMN IF EXISTS valor_executado;
-- ALTER TABLE obras DROP COLUMN IF EXISTS percentual_execucao;
-- ALTER TABLE obras DROP COLUMN IF EXISTS responsavel;
-- ALTER TABLE obras DROP COLUMN IF EXISTS observacoes;

-- 3. Atualizar índices
DROP INDEX IF EXISTS idx_obras_cidade;
DROP INDEX IF EXISTS idx_obras_estado;
DROP INDEX IF EXISTS idx_obras_tipo;
DROP INDEX IF EXISTS idx_obras_data_inicio;

CREATE INDEX IF NOT EXISTS idx_obras_municipio ON obras(municipio);
CREATE INDEX IF NOT EXISTS idx_obras_status ON obras(status);
CREATE INDEX IF NOT EXISTS idx_obras_status_medicao ON obras(status_medicao);
CREATE INDEX IF NOT EXISTS idx_obras_orgao ON obras(orgao);
CREATE INDEX IF NOT EXISTS idx_obras_publicacao_os ON obras(publicacao_os);

-- 4. Garantir que obra não seja NULL
ALTER TABLE obras ALTER COLUMN obra SET NOT NULL;
