-- ============================================
-- MIGRAÇÃO COMPLETA: Migrar cities.id de UUID para TEXT
-- e atualizar todas as tabelas dependentes
-- ============================================
-- Este script migra a tabela cities e todas as referências
-- para suportar códigos IBGE (formato: 'ibge-2201000')

BEGIN;

-- Passo 1: Remover todas as foreign key constraints que referenciam cities(id)
ALTER TABLE agendas DROP CONSTRAINT IF EXISTS agendas_city_id_fkey;
ALTER TABLE leaderships DROP CONSTRAINT IF EXISTS leaderships_city_id_fkey;
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_cidade_id_fkey;

-- Passo 2: Alterar cities.id de UUID para TEXT
-- Primeiro, precisamos converter os valores UUID existentes para TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'cities' 
    AND column_name = 'id' 
    AND data_type = 'uuid'
  ) THEN
    -- Converter UUIDs existentes para formato TEXT
    ALTER TABLE cities ALTER COLUMN id TYPE TEXT USING id::TEXT;
    RAISE NOTICE 'Tabela cities.id migrada de UUID para TEXT';
  END IF;
END $$;

-- Passo 3: Alterar todas as colunas city_id de UUID para TEXT
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Alterar todas as colunas city_id que são UUID para TEXT
  FOR r IN (
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE column_name IN ('city_id', 'cidade_id')
    AND data_type = 'uuid'
    AND table_schema = 'public'
  ) LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE TEXT USING %I::TEXT', 
      r.table_name, r.column_name, r.column_name);
    RAISE NOTICE 'Tabela %.% migrada de UUID para TEXT', r.table_name, r.column_name;
  END LOOP;
END $$;

-- Passo 4: Adicionar coluna cidade_id em polls se não existir
ALTER TABLE polls ADD COLUMN IF NOT EXISTS cidade_id TEXT;

-- Passo 5: Recriar foreign key constraints
-- Recriar constraint para agendas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agendas' AND column_name = 'city_id'
  ) THEN
    ALTER TABLE agendas 
    ADD CONSTRAINT agendas_city_id_fkey 
    FOREIGN KEY (city_id) REFERENCES cities(id);
  END IF;
END $$;

-- Recriar constraint para leaderships
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leaderships' AND column_name = 'city_id'
  ) THEN
    ALTER TABLE leaderships 
    ADD CONSTRAINT leaderships_city_id_fkey 
    FOREIGN KEY (city_id) REFERENCES cities(id);
  END IF;
END $$;

-- Recriar constraint para polls
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'polls' AND column_name = 'cidade_id'
  ) THEN
    ALTER TABLE polls 
    ADD CONSTRAINT polls_cidade_id_fkey 
    FOREIGN KEY (cidade_id) REFERENCES cities(id);
  END IF;
END $$;

-- Passo 6: Criar índices
CREATE INDEX IF NOT EXISTS idx_polls_cidade_id ON polls(cidade_id);

-- Passo 7: Comentários
COMMENT ON COLUMN polls.cidade_id IS 'Referência à cidade do Piauí onde a pesquisa foi realizada';
COMMENT ON COLUMN cities.id IS 'ID da cidade (pode ser UUID ou código IBGE no formato ibge-{codigo})';

COMMIT;

-- Verificar resultado
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('cities', 'agendas', 'leaderships', 'polls')
  AND column_name IN ('id', 'city_id', 'cidade_id')
ORDER BY table_name, column_name;

