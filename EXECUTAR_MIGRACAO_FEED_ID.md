# Executar Migração: Adicionar feed_id à tabela news

## Erro Atual
```
error: "column news.feed_id does not exist"
```

## Solução

Execute o script SQL abaixo no Supabase SQL Editor:

### Passo 1: Acesse o Supabase Dashboard
1. Vá para https://app.supabase.com
2. Selecione seu projeto
3. Clique em "SQL Editor" no menu lateral

### Passo 2: Execute o Script

Copie e cole o conteúdo do arquivo `database/add-feed-id-to-news.sql`:

```sql
-- Adicionar campo feed_id à tabela news para identificar de qual feed RSS veio cada notícia
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS feed_id UUID REFERENCES news_feeds(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_news_feed_id ON news(feed_id);

-- Comentário
COMMENT ON COLUMN news.feed_id IS 'Referência ao feed RSS do usuário que coletou esta notícia (NULL para notícias de adversários ou outras fontes)';
```

### Passo 3: Verificar

Após executar, verifique se a coluna foi criada:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'news' AND column_name = 'feed_id';
```

Deve retornar uma linha com `feed_id` e tipo `uuid`.

### Passo 4: Recarregar a Página

Após executar o script, recarregue a página da aplicação (F5) e teste novamente os filtros.

