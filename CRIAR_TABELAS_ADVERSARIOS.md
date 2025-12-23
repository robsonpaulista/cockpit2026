# 🔧 Criar Tabelas de Adversários

## ⚠️ Erro: Tabela "adversaries" não existe

Se você recebeu o erro `relation "adversaries" does not exist`, significa que as tabelas não foram criadas no banco de dados.

## 📋 Solução

Execute os scripts SQL na ordem abaixo no Supabase SQL Editor:

### 1. Criar Tabela `adversaries`

**Arquivo:** `database/create-adversaries-table.sql`

Este script cria:
- Tabela `adversaries` com todos os campos necessários
- Índices para performance
- Trigger para atualizar `updated_at`
- Políticas RLS (Row Level Security)
- Campo `google_alerts_rss_url` incluído

### 2. Criar Tabela `adversary_attacks` (Opcional, mas recomendado)

**Arquivo:** `database/create-adversary-attacks-table.sql`

Este script cria:
- Tabela `adversary_attacks` para registrar menções/ataques
- Índices para performance
- Políticas RLS

**⚠️ IMPORTANTE:** Esta tabela depende de:
- `adversaries` (deve existir primeiro)
- `news` (deve existir primeiro)

Se a tabela `news` não existir, você pode pular este script por enquanto.

## 🚀 Passos

1. **Acesse o Supabase Dashboard**
   - Vá para SQL Editor

2. **Execute o primeiro script**
   ```sql
   -- Cole o conteúdo de database/create-adversaries-table.sql
   ```

3. **Verifique se foi criada**
   ```sql
   SELECT * FROM adversaries LIMIT 1;
   ```
   - Deve retornar vazio (sem erro)

4. **Execute o segundo script** (se a tabela `news` existir)
   ```sql
   -- Cole o conteúdo de database/create-adversary-attacks-table.sql
   ```

## ✅ Verificação

Após executar, verifique:

```sql
-- Verificar se a tabela existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'adversaries';

-- Verificar colunas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'adversaries'
ORDER BY ordinal_position;

-- Verificar políticas RLS
SELECT * FROM pg_policies 
WHERE tablename = 'adversaries';
```

## 🔍 Estrutura da Tabela `adversaries`

- `id` (UUID) - Chave primária
- `name` (TEXT) - Nome do adversário (obrigatório)
- `type` (TEXT) - Tipo: candidate, party, media, influencer, other
- `themes` (JSONB) - Array de temas que aborda
- `presence_score` (INTEGER) - Share of Voice (0-100)
- `google_alerts_rss_url` (TEXT) - URL do feed RSS (opcional)
- `last_updated` (TIMESTAMPTZ) - Última atualização
- `created_at` (TIMESTAMPTZ) - Data de criação
- `updated_at` (TIMESTAMPTZ) - Data de atualização

## 🎯 Próximos Passos

Após criar as tabelas:

1. Teste criar um adversário pela interface
2. Verifique se o campo de URL do Google Alerts aparece
3. Teste a detecção automática coletando notícias

## ⚠️ Troubleshooting

### Erro: "relation 'news' does not exist"

Se você receber este erro ao criar `adversary_attacks`, significa que a tabela `news` não existe ainda. Neste caso:

1. Crie apenas a tabela `adversaries` por enquanto
2. Crie a tabela `news` depois (se necessário)
3. Depois crie `adversary_attacks`

### Erro: "function uuid_generate_v4() does not exist"

Execute primeiro:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Erro de permissão

Certifique-se de estar usando um usuário com permissões adequadas no Supabase.




