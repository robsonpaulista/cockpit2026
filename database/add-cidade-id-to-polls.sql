-- ============================================
-- MIGRAÇÃO: Adicionar coluna cidade_id à tabela polls
-- ============================================
-- ATENÇÃO: Se você recebeu erro de incompatibilidade de tipos,
-- execute primeiro o script: database/migrate-cities-to-text-complete.sql
-- que migra toda a estrutura de cities de UUID para TEXT.

-- Este script assume que cities.id já é TEXT
-- Se ainda não migrou, use o script migrate-cities-to-text-complete.sql

-- Passo 1: Adicionar coluna cidade_id
ALTER TABLE polls
ADD COLUMN IF NOT EXISTS cidade_id TEXT;

-- Passo 2: Criar índice
CREATE INDEX IF NOT EXISTS idx_polls_cidade_id ON polls(cidade_id);

-- Passo 3: Adicionar foreign key constraint
-- Remover constraint antiga se existir
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_cidade_id_fkey;

-- Adicionar nova constraint
ALTER TABLE polls
ADD CONSTRAINT polls_cidade_id_fkey 
FOREIGN KEY (cidade_id) REFERENCES cities(id);

-- Passo 4: Comentário na coluna
COMMENT ON COLUMN polls.cidade_id IS 'Referência à cidade do Piauí onde a pesquisa foi realizada';

