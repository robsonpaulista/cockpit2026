-- Após importar limites 2026 (scripts/import-limites-2026-to-supabase.mjs),
-- ou manualmente via API/modal "Editar limites", ative o exercício 2026:

UPDATE public.tetos_config
SET valor = '2026', updated_at = NOW()
WHERE chave = 'exercicio_ativo';

-- Verificação rápida:
-- SELECT chave, valor FROM public.tetos_config WHERE chave = 'exercicio_ativo';
-- SELECT exercicio, COUNT(*) FROM public.limites_pap GROUP BY exercicio;
-- SELECT exercicio, COUNT(*) FROM public.limites_mac_municipio GROUP BY exercicio;
