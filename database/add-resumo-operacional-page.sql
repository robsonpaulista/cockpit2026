-- Resumo Operacional — página e permissões iniciais
INSERT INTO public.pages (key, label, path)
VALUES ('resumo-operacional', 'Resumo Operacional', '/dashboard/resumo-operacional')
ON CONFLICT (key) DO NOTHING;

-- Quem já acessa Campo, Operação, Mobilização ou Conteúdo recebe o resumo operacional
INSERT INTO profile_permissions (profile_id, page_key)
SELECT DISTINCT pp.profile_id, 'resumo-operacional'
FROM profile_permissions pp
WHERE pp.page_key IN ('campo', 'operacao', 'mobilizacao', 'conteudo')
ON CONFLICT (profile_id, page_key) DO NOTHING;
