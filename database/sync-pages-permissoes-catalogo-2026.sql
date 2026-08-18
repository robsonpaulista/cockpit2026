-- Alinha `pages` ao catálogo atual (lib/page-permissions-catalog.ts).
-- O modal de permissões lê o catálogo no código; este SQL só atualiza o banco.

INSERT INTO pages (key, label, path) VALUES
  ('war-room', 'War Room', '/dashboard/war-room'),
  ('ipt', 'Diagnóstico Operacional', '/dashboard/territorio/ipt'),
  ('territorio', 'Base Eleitoral', '/dashboard/territorio'),
  ('agenda', 'Agenda', '/dashboard/agenda'),
  ('pesquisa', 'Pesquisas de Opinião', '/dashboard/pesquisa'),
  ('noticias', 'Radar Eleitoral', '/dashboard/noticias/monitoramento'),
  ('resumo-eleicoes', 'Atendimentos', '/dashboard/resumo-eleicoes'),
  ('conteudo', 'Redes Sociais / Instagram', '/dashboard/conteudo/redes'),
  ('material-campanha', 'Gestão de Material', '/dashboard/material-campanha'),
  ('resumo-operacional', 'Resumo Operacional', '/dashboard/resumo-operacional'),
  ('narrativas', 'Estratégia', '/dashboard/narrativas'),
  ('ficha-atendimento', 'Ficha de Atendimento', '/dashboard/ficha-atendimento'),
  ('chapas', 'Chapas', '/dashboard/resumo-eleicoes'),
  ('mobilizacao', 'Mobilização', '/dashboard/mobilizacao/config'),
  ('whatsapp', 'WhatsApp', '/dashboard/whatsapp'),
  ('operacao', 'Operação & Equipe', '/dashboard/operacao'),
  ('gestao_pesquisas', 'Gestão de Pesquisas (campo)', '/dashboard/gestao-pesquisas'),
  ('juridico', 'Jurídico', '/dashboard/juridico'),
  ('emendas', 'Emendas', '/dashboard/emendas'),
  ('obras', 'Obras', '/dashboard/obras'),
  ('proposicoes', 'Proposições', '/dashboard/proposicoes'),
  ('sei-pesquisa', 'Pesquisa SEI (teste)', '/dashboard/sei-pesquisa')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path;

-- Polls: só pesquisa / território / diagnóstico — Agenda não lê a base de pesquisas.
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
        AND pp.page_key IN ('pesquisa', 'territorio', 'ipt')
    )
  );
