-- Corrige chave primária de chapas_cenarios para escopo por usuário.
-- Cenário atual com problema: PRIMARY KEY (id)
-- Cenário esperado: PRIMARY KEY (user_id, id)

DO $$
DECLARE
  pkey_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
  INTO pkey_def
  FROM pg_constraint c
  WHERE c.conname = 'chapas_cenarios_pkey'
    AND c.conrelid = 'chapas_cenarios'::regclass;

  -- Só altera se a PK antiga for apenas em "id"
  IF pkey_def IS NOT NULL AND pkey_def ILIKE 'PRIMARY KEY (id)' THEN
    ALTER TABLE chapas_cenarios DROP CONSTRAINT chapas_cenarios_pkey;
    ALTER TABLE chapas_cenarios ADD CONSTRAINT chapas_cenarios_pkey PRIMARY KEY (user_id, id);
  END IF;
END $$;

-- IMPORTANTE:
-- Não remover chapas_cenarios_user_id_id_key aqui.
-- Em alguns ambientes a FK (chapas_partidos_user_id_cenario_id_fkey)
-- pode depender desse índice/constraint.
-- Mantemos a constraint para evitar quebra de dependências.

-- Índice auxiliar continua útil para consultas por user + ativo.
CREATE INDEX IF NOT EXISTS idx_chapas_cenarios_user_id_ativo
  ON chapas_cenarios(user_id, ativo);
