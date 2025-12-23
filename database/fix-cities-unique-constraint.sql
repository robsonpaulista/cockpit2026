-- ============================================
-- GARANTIR CONSTRAINT UNIQUE(name, state) NA TABELA CITIES
-- Execute no SQL Editor do Supabase
-- ============================================

-- Verificar constraints existentes
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'cities'::regclass;

-- Remover constraint antiga se existir com nome diferente
ALTER TABLE cities DROP CONSTRAINT IF EXISTS cities_name_state_key;
ALTER TABLE cities DROP CONSTRAINT IF EXISTS cities_name_state_unique;

-- Criar constraint UNIQUE(name, state) se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'cities'::regclass 
    AND contype = 'u'
    AND array_to_string(conkey, ',') = (
      SELECT array_to_string(array_agg(attnum), ',')
      FROM pg_attribute
      WHERE attrelid = 'cities'::regclass
      AND attname IN ('name', 'state')
    )
  ) THEN
    ALTER TABLE cities ADD CONSTRAINT cities_name_state_unique UNIQUE (name, state);
    RAISE NOTICE 'Constraint UNIQUE(name, state) criada';
  ELSE
    RAISE NOTICE 'Constraint UNIQUE(name, state) já existe';
  END IF;
END $$;

-- Verificar se foi criada
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'cities'::regclass
AND contype = 'u';



