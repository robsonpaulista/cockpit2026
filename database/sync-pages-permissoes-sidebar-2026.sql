-- ============================================
-- Alinha `pages` à sidebar atual (sem apagar chaves existentes)
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1) Novas páginas (INSERT only — não remove nada)
INSERT INTO pages (key, label, path) VALUES
  ('ipt', 'Diagnóstico Operacional', '/dashboard/territorio/ipt'),
  ('resumo-eleicoes', 'Resumo Eleições', '/dashboard/resumo-eleicoes'),
  ('proposicoes', 'Proposições', '/dashboard/proposicoes'),
  ('sei-pesquisa', 'Pesquisa SEI (teste)', '/dashboard/sei-pesquisa'),
  ('emendas', 'Emendas', '/dashboard/emendas'),
  ('arquivos', 'Arquivos', '/dashboard/arquivos'),
  ('resumo-operacional', 'Resumo Operacional', '/dashboard/resumo-operacional'),
  ('log_system', 'Log System', '/dashboard/log-system'),
  ('material-campanha', 'Gestão de Material', '/dashboard/material-campanha'),
  ('fluxo-digital', 'Fluxo Digital', '/dashboard/fluxo-digital')
ON CONFLICT (key) DO NOTHING;

-- 2) Atualiza rótulos/paths das chaves já usadas (preserva a chave)
UPDATE pages SET label = 'Visão Geral', path = '/dashboard' WHERE key = 'dashboard';
UPDATE pages SET label = 'Resumo Operacional', path = '/dashboard/resumo-operacional' WHERE key = 'resumo-operacional';
UPDATE pages SET label = 'Estratégia', path = '/dashboard/narrativas' WHERE key = 'narrativas';
UPDATE pages SET label = 'Território & Campo', path = '/dashboard/territorio' WHERE key = 'territorio';
UPDATE pages SET label = 'Agenda', path = '/dashboard/agenda' WHERE key = 'agenda';
UPDATE pages SET label = 'Ficha de Atendimento', path = '/dashboard/ficha-atendimento' WHERE key = 'ficha-atendimento';
UPDATE pages SET label = 'Pesquisa & Relato', path = '/dashboard/pesquisa' WHERE key = 'pesquisa';
UPDATE pages SET label = 'Chapas', path = '/dashboard/resumo-eleicoes' WHERE key = 'chapas';
UPDATE pages SET label = 'Resumo Eleições', path = '/dashboard/resumo-eleicoes' WHERE key = 'resumo-eleicoes';
UPDATE pages SET label = 'Redes Sociais', path = '/dashboard/conteudo' WHERE key = 'conteudo';
UPDATE pages SET label = 'Radar Eleitoral', path = '/dashboard/noticias/monitoramento' WHERE key = 'noticias';
UPDATE pages SET label = 'Mobilização', path = '/dashboard/mobilizacao' WHERE key = 'mobilizacao';
UPDATE pages SET label = 'WhatsApp', path = '/dashboard/whatsapp' WHERE key = 'whatsapp';
UPDATE pages SET label = 'Operação & Equipe', path = '/dashboard/operacao' WHERE key = 'operacao';
UPDATE pages SET label = 'Jurídico', path = '/dashboard/juridico' WHERE key = 'juridico';
UPDATE pages SET label = 'Emendas', path = '/dashboard/emendas' WHERE key = 'emendas';
UPDATE pages SET label = 'Obras', path = '/dashboard/obras' WHERE key = 'obras';
UPDATE pages SET label = 'Proposições', path = '/dashboard/proposicoes' WHERE key = 'proposicoes';
UPDATE pages SET label = 'Pesquisa SEI (teste)', path = '/dashboard/sei-pesquisa' WHERE key = 'sei-pesquisa';
UPDATE pages SET label = 'Gestão de Pesquisas (Campo)', path = '/dashboard/gestao-pesquisas' WHERE key = 'gestao_pesquisas';
UPDATE pages SET label = 'Arquivos', path = '/dashboard/arquivos' WHERE key = 'arquivos';
UPDATE pages SET label = 'Diagnóstico Operacional', path = '/dashboard/territorio/ipt' WHERE key = 'ipt';
UPDATE pages SET label = 'Gestão de Usuários', path = '/dashboard/usuarios' WHERE key = 'usuarios';
UPDATE pages SET label = 'Log System', path = '/dashboard/log-system' WHERE key = 'log_system';
UPDATE pages SET label = 'Gestão de Material', path = '/dashboard/material-campanha' WHERE key = 'material-campanha';
UPDATE pages SET label = 'Fluxo Digital', path = '/dashboard/fluxo-digital' WHERE key = 'fluxo-digital';

-- Chaves legadas mantidas (ainda aparecem no modal; não apagar):
-- campo, fases, narrativas antigas, pesquisador_campo, etc.

-- 3) Quem já tinha Território/Campo/Agenda passa a ter Diagnóstico (IPT)
INSERT INTO profile_permissions (profile_id, page_key)
SELECT DISTINCT pp.profile_id, 'ipt'
FROM profile_permissions pp
WHERE pp.page_key IN ('territorio', 'campo', 'agenda')
ON CONFLICT (profile_id, page_key) DO NOTHING;

-- 4) Polls: base de campanha compartilhada para quem tem pesquisa / IPT / território
-- (antes só o dono via RLS via; a API também filtrava por user_id — ver /api/pesquisa)
DROP POLICY IF EXISTS "Users can view their own polls" ON polls;
DROP POLICY IF EXISTS "Users with campaign access can view all polls" ON polls;

CREATE POLICY "Users with campaign access can view all polls"
  ON polls FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM profile_permissions pp
      WHERE pp.profile_id = auth.uid()
        AND pp.page_key IN ('pesquisa', 'territorio', 'ipt', 'campo', 'agenda')
    )
  );
