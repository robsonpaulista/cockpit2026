-- Ficha de Atendimento — página e permissão independente
-- Execute no SQL Editor do Supabase

INSERT INTO pages (key, label, path) VALUES
  ('ficha-atendimento', 'Ficha de Atendimento', '/dashboard/ficha-atendimento')
ON CONFLICT (key) DO NOTHING;

-- Quem já tinha Território ganha Ficha de Atendimento (pode revogar depois na gestão de usuários)
INSERT INTO profile_permissions (profile_id, page_key)
SELECT pp.profile_id, 'ficha-atendimento'
FROM profile_permissions pp
WHERE pp.page_key = 'territorio'
  AND NOT EXISTS (
    SELECT 1 FROM profile_permissions x
    WHERE x.profile_id = pp.profile_id AND x.page_key = 'ficha-atendimento'
  )
ON CONFLICT (profile_id, page_key) DO NOTHING;
