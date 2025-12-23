-- Adicionar coluna candidato_nome à tabela polls
ALTER TABLE polls
ADD COLUMN IF NOT EXISTS candidato_nome TEXT NOT NULL DEFAULT '';

-- Remover o DEFAULT após adicionar (para permitir valores NULL temporariamente se necessário)
-- Se você já tem dados, pode precisar atualizar os registros existentes primeiro
-- ALTER TABLE polls ALTER COLUMN candidato_nome DROP DEFAULT;

-- Comentário na coluna
COMMENT ON COLUMN polls.candidato_nome IS 'Nome do candidato pesquisado';



