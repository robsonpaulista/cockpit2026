-- Limpeza de histórico: mantém só os últimos 60 dias.
-- Rode no SQL Editor do Supabase.
--
-- 1) Execute o bloco PREVIEW primeiro e confira as quantidades.
-- 2) Se estiver ok, execute o bloco DELETE (descomente BEGIN/COMMIT se quiser transação).

-- =============================================================================
-- PREVIEW — quantos registros seriam removidos
-- =============================================================================

SELECT 'news' AS tabela,
       COUNT(*) AS remover,
       (SELECT COUNT(*) FROM news) AS total_atual
FROM news
WHERE COALESCE(published_at, collected_at) < NOW() - INTERVAL '60 days'

UNION ALL

SELECT 'google_news_mentions',
       COUNT(*),
       (SELECT COUNT(*) FROM google_news_mentions)
FROM google_news_mentions
WHERE COALESCE(published_at, collected_at) < NOW() - INTERVAL '60 days'

UNION ALL

SELECT 'instagram_comments',
       COUNT(*),
       (SELECT COUNT(*) FROM instagram_comments)
FROM instagram_comments
WHERE commented_at < NOW() - INTERVAL '60 days';

-- =============================================================================
-- DELETE — apaga registros com mais de 60 dias
-- (adversary_attacks e news_alerts ligados a news são removidos em CASCADE)
-- =============================================================================

-- BEGIN;

DELETE FROM news
WHERE COALESCE(published_at, collected_at) < NOW() - INTERVAL '60 days';

DELETE FROM google_news_mentions
WHERE COALESCE(published_at, collected_at) < NOW() - INTERVAL '60 days';

DELETE FROM instagram_comments
WHERE commented_at < NOW() - INTERVAL '60 days';

-- COMMIT;

-- Opcional: recuperar espaço em disco após deletes grandes (pode demorar)
-- VACUUM ANALYZE news;
-- VACUUM ANALYZE google_news_mentions;
-- VACUUM ANALYZE instagram_comments;
