# 🔧 Criar Tabela de Notícias

## ⚠️ Erro: Tabela "news" não existe

Se você recebeu o erro `Could not find the table 'public.news' in the schema cache`, significa que a tabela `news` não foi criada no banco de dados.

## 📋 Solução

Execute o script SQL no Supabase SQL Editor:

### Arquivo: `database/create-news-table.sql`

Este script cria:
- Tabela `news` com todos os campos necessários
- Índices para performance (collected_at, risk_level, sentiment, theme, etc.)
- Índice único em `url` para evitar duplicatas
- Trigger para atualizar `updated_at` automaticamente
- Políticas RLS (Row Level Security) para acesso controlado

## 🚀 Passos

1. **Acesse o Supabase Dashboard**
   - Vá para SQL Editor

2. **Execute o script**
   ```sql
   -- Cole o conteúdo de database/create-news-table.sql
   ```

3. **Verifique se foi criada**
   ```sql
   SELECT * FROM news LIMIT 1;
   ```
   - Deve retornar vazio (sem erro)

## ✅ Verificação

Após executar, verifique:

```sql
-- Verificar se a tabela existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'news';

-- Verificar colunas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'news'
ORDER BY ordinal_position;

-- Verificar políticas RLS
SELECT * FROM pg_policies 
WHERE tablename = 'news';

-- Verificar índices
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'news';
```

## 🔍 Estrutura da Tabela `news`

- `id` (UUID) - Chave primária
- `title` (TEXT) - Título da notícia (obrigatório)
- `source` (TEXT) - Fonte da notícia (obrigatório)
- `url` (TEXT) - URL da notícia original (opcional, único)
- `content` (TEXT) - Conteúdo completo ou resumo (opcional)
- `sentiment` (TEXT) - Sentimento: positive, negative, neutral
- `risk_level` (TEXT) - Nível de risco: low, medium, high
- `theme` (TEXT) - Tema identificado (opcional)
- `actor` (TEXT) - Ator mencionado (opcional)
- `published_at` (TIMESTAMPTZ) - Data de publicação original
- `collected_at` (TIMESTAMPTZ) - Data/hora de coleta pelo sistema
- `processed` (BOOLEAN) - Se já foi processada (classificação automática)
- `crisis_id` (UUID) - Referência à crise relacionada (opcional)
- `created_at` (TIMESTAMPTZ) - Data de criação
- `updated_at` (TIMESTAMPTZ) - Data de atualização

## 🎯 Próximos Passos

Após criar a tabela:

1. Teste coletar notícias do Google Alerts
2. Verifique se as notícias aparecem na página
3. Teste a classificação automática (sentiment, risk_level, theme)

## ⚠️ Troubleshooting

### Erro: "relation 'crises' does not exist"

Se você receber este erro, significa que a tabela `crises` não existe ainda. Neste caso:

1. Crie primeiro a tabela `crises` (deve estar no schema.sql)
2. Depois crie a tabela `news`

### Erro: "function uuid_generate_v4() does not exist"

Execute primeiro:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Erro de permissão

Certifique-se de estar usando um usuário com permissões adequadas no Supabase.

### Notícias duplicadas

A tabela tem um índice único em `url`, então notícias com a mesma URL não serão inseridas duas vezes. Isso evita duplicatas ao coletar feeds RSS periodicamente.



