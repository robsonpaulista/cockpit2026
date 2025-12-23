# 🔧 Separar Notícias de Adversários do Inbox

## ⚠️ Problema

As notícias coletadas dos feeds RSS de adversários estão aparecendo no "Inbox de Notícias" junto com as notícias gerais.

## ✅ Solução

Execute os scripts SQL na ordem abaixo:

### 1. Adicionar campo `adversary_id` à tabela `news`

**Arquivo:** `database/add-adversary-id-to-news.sql`

Este script:
- Adiciona a coluna `adversary_id` se não existir
- Cria índice para performance
- Configura foreign key para `adversaries`

### 2. Atualizar notícias existentes

**Arquivo:** `database/update-existing-adversary-news.sql`

Este script:
- Garante que a coluna existe
- Atualiza notícias existentes que foram coletadas de adversários
- Identifica notícias pelo campo `actor` (que contém o nome do adversário)
- Mostra estatísticas de quantas notícias foram atualizadas

## 🚀 Passos

1. **Execute o primeiro script** (`add-adversary-id-to-news.sql`)
   ```sql
   -- No Supabase SQL Editor
   ```

2. **Execute o segundo script** (`update-existing-adversary-news.sql`)
   ```sql
   -- Isso atualizará as notícias já coletadas
   ```

3. **Verifique o resultado**
   ```sql
   -- Ver quantas notícias têm adversary_id
   SELECT 
     COUNT(*) as total,
     COUNT(adversary_id) as com_adversary_id,
     COUNT(*) - COUNT(adversary_id) as sem_adversary_id
   FROM news;
   ```

4. **Teste na interface**
   - Recarregue a página de notícias
   - O Inbox deve mostrar apenas notícias sem `adversary_id`
   - O Radar de Adversários deve mostrar notícias com `adversary_id`

## 🔍 Como Funciona

- **Notícias gerais** (Inbox): `adversary_id IS NULL`
- **Notícias de adversários** (Radar): `adversary_id IS NOT NULL`

A API `/api/noticias` filtra automaticamente para mostrar apenas notícias sem `adversary_id`.

## ⚠️ Troubleshooting

### Se ainda aparecerem todas juntas:

1. Verifique se o campo existe:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'news' AND column_name = 'adversary_id';
   ```

2. Verifique se as notícias têm `adversary_id`:
   ```sql
   SELECT id, title, adversary_id, actor 
   FROM news 
   LIMIT 10;
   ```

3. Se necessário, atualize manualmente:
   ```sql
   -- Para um adversário específico
   UPDATE news 
   SET adversary_id = 'ID_DO_ADVERSARIO'
   WHERE actor = 'Nome do Adversário'
     AND adversary_id IS NULL;
   ```

### Se der erro ao executar o script:

- Certifique-se de que a tabela `adversaries` existe
- Verifique se há notícias com `actor` que não correspondem a nenhum adversário cadastrado



