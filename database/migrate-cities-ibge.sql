-- ============================================
-- MIGRAÇÃO: Atualizar tabela cities para aceitar IDs do IBGE
-- ============================================
-- Execute este script no Supabase SQL Editor antes de sincronizar os municípios

-- 1. Remover constraint de PRIMARY KEY se existir (se id for UUID)
-- Se a tabela já tiver dados, faça backup primeiro!

-- 2. Alterar tipo do ID para TEXT (aceita UUID e códigos IBGE)
ALTER TABLE cities ALTER COLUMN id TYPE TEXT;

-- 3. Adicionar coluna microrregiao se não existir
ALTER TABLE cities ADD COLUMN IF NOT EXISTS microrregiao TEXT;

-- 4. Garantir constraint UNIQUE em (name, state)
ALTER TABLE cities DROP CONSTRAINT IF EXISTS cities_name_state_key;
ALTER TABLE cities ADD CONSTRAINT cities_name_state_key UNIQUE (name, state);

-- 5. Verificar estrutura final
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cities'
ORDER BY ordinal_position;




