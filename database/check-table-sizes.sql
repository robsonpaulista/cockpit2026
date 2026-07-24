-- Tamanho real das tabelas (dados + índices) no Supabase.
-- Cole no SQL Editor: https://supabase.com/dashboard/project/_/sql/new

SELECT
  c.relname AS table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_size_pretty(pg_relation_size(c.oid)) AS data_size,
  pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS index_size,
  pg_total_relation_size(c.oid) AS total_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;

-- Só as tabelas do módulo Arquivos / PhotoFinder:
SELECT
  c.relname AS table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_total_relation_size(c.oid) AS total_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN ('users', 'photos', 'sync_events', 'persons', 'face_descriptors', 'photo_tags')
ORDER BY pg_total_relation_size(c.oid) DESC;
