-- ============================================
-- ADICIONAR COLUNA microrregiao À TABELA CITIES
-- Execute no SQL Editor do Supabase
-- ============================================

-- Adicionar coluna microrregiao se não existir
ALTER TABLE cities 
ADD COLUMN IF NOT EXISTS microrregiao TEXT;

-- Comentário na coluna
COMMENT ON COLUMN cities.microrregiao IS 'Microrregião do município segundo IBGE';

-- Verificar se foi adicionada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cities' AND column_name = 'microrregiao';



