-- ============================================
-- DATA DO REGISTRO MAIS RECENTE (ANDAMENTO CONCLUÍDO)
-- ============================================
-- Quando alerta_andamento_desatualizado=true, armazena a data/hora
-- do andamento concluído mais recente para exibir no tooltip.

ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS sei_data_mais_recente_concluido TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sei_descricao_mais_recente_concluido TEXT,
  ADD COLUMN IF NOT EXISTS sei_todos_andamentos_concluidos BOOLEAN DEFAULT false;

COMMENT ON COLUMN obras.sei_data_mais_recente_concluido IS 'Data/hora do andamento concluído mais recente (quando alerta desatualizado)';
COMMENT ON COLUMN obras.sei_descricao_mais_recente_concluido IS 'Descrição do andamento concluído mais recente (ex: SEAGRO-PI/DIRFRUT/GFFA/CFFA | Processo recebido na unidade)';
COMMENT ON COLUMN obras.sei_todos_andamentos_concluidos IS 'true quando não há andamento aberto — todos os protocolos foram concluídos';
