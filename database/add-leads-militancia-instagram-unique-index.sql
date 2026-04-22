-- Unicidade do perfil Instagram (valor já normalizado em minúsculas pela API).
-- Vários NULL continuam permitidos (cadastros antigos / manual sem Instagram).
--
-- Se o CREATE falhar por duplicata, identifique com:
--   SELECT instagram, count(*) FROM public.leads_militancia WHERE instagram IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_militancia_instagram_unique
  ON public.leads_militancia (instagram)
  WHERE instagram IS NOT NULL;

COMMENT ON INDEX public.idx_leads_militancia_instagram_unique IS
  'Evita dois leads ativos com o mesmo @/handle de Instagram (campo normalizado).';
