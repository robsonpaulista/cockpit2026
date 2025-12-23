-- ============================================
-- CORREÇÃO: Permitir NULL em cidade_id
-- ============================================

-- Remover constraint antiga
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_cidade_id_fkey;

-- Recriar constraint permitindo NULL
ALTER TABLE polls
ADD CONSTRAINT polls_cidade_id_fkey 
FOREIGN KEY (cidade_id) REFERENCES cities(id) ON DELETE SET NULL;

-- Verificar se a coluna permite NULL
ALTER TABLE polls ALTER COLUMN cidade_id DROP NOT NULL;



