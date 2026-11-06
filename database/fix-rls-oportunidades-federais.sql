-- ============================================
-- Corrige alerta Supabase: rls_disabled_in_public
-- nas tabelas de Oportunidades federais.
-- Cole no SQL Editor e Execute.
-- ============================================

-- 1) Quais tabelas public ainda estão sem RLS? (diagnóstico)
SELECT c.relname AS tabela
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY 1;

-- 2) Liga RLS + remove grants abertos + SELECT só authenticated
ALTER TABLE public.oportunidades_federais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidades_federais_sync ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.oportunidades_federais FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.oportunidades_federais_sync FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.oportunidades_federais TO authenticated;
GRANT SELECT ON TABLE public.oportunidades_federais_sync TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view oportunidades_federais"
  ON public.oportunidades_federais;
CREATE POLICY "Authenticated users can view oportunidades_federais"
  ON public.oportunidades_federais FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can view oportunidades_federais_sync"
  ON public.oportunidades_federais_sync;
CREATE POLICY "Authenticated users can view oportunidades_federais_sync"
  ON public.oportunidades_federais_sync FOR SELECT
  TO authenticated
  USING (true);

-- 3) Confirma RLS ligado
SELECT c.relname AS tabela, c.relrowsecurity AS rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('oportunidades_federais', 'oportunidades_federais_sync');
