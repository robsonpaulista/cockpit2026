-- Página Arquivos (PhotoFinder integrado ao Cockpit)
-- Execute no SQL Editor do Supabase
--
-- Pré-requisito: rodar antes database/restore-from-backup-2025-11-17-schema.sql
-- (tabelas users, photos, sync_events, etc.)

INSERT INTO pages (key, label, path) VALUES
  ('arquivos', 'Arquivos', '/dashboard/arquivos')
ON CONFLICT (key) DO NOTHING;

-- Liberar para admins existentes (ajuste conforme necessário)
INSERT INTO profile_permissions (profile_id, page_key)
SELECT p.id, 'arquivos'
FROM profiles p
WHERE p.is_admin = true
ON CONFLICT DO NOTHING;
