-- ============================================
-- ALERTA: ANDAMENTO ABERTO DESATUALIZADO
-- ============================================
-- Caso atípico: andamentoAberto tem data antiga, mas existem andamentoConcluido
-- com datas mais recentes (processo seguiu). Marca para alertar o usuário.

ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS sei_alerta_andamento_desatualizado BOOLEAN DEFAULT false;

COMMENT ON COLUMN obras.sei_alerta_andamento_desatualizado IS 'true quando há andamentos concluídos mais recentes que o andamento aberto (caso atípico)';
