# Restaurar backup Supabase (17/11/2025)

Backup local: `scripts/db_cluster-17-11-2025@02-49-17.backup.gz`

## O que este backup contém

O dump é um **cluster completo** do Supabase, mas o schema **`public` do app** tem apenas **6 tabelas** de um projeto de **fotos do Google Drive + reconhecimento facial**:

| Tabela | Descrição |
|--------|-----------|
| `users` | OAuth Google (tokens) — **não** é `auth.users` |
| `photos` | Metadados das fotos (Drive, GPS, emoções, evento) |
| `photo_tags` | Tags por foto |
| `face_descriptors` | Vetores faciais (128 dims) |
| `persons` | Pessoas identificadas |
| `sync_events` | Log de sincronizações com o Drive |

Também há view `photos_with_tags` e função `get_photo_stats`.

O **Cockpit 2026** (perfis, agendas, pesquisas, Instagram radar, etc.) está em `database/schema.sql` e nos arquivos `database/create-*.sql` — **não** neste backup.

## 1. Criar novo projeto Supabase

1. [supabase.com](https://supabase.com) → New project  
2. Anote **Project URL** e **service_role** (Settings → API)  
3. Atualize `.env.local` do Cockpit com `NEXT_PUBLIC_SUPABASE_URL` e chaves

## 2. Recriar estrutura (schema)

**Opção A — arquivo revisado (recomendado)**

No **SQL Editor** do projeto, execute:

```
database/restore-from-backup-2025-11-17-schema.sql
```

**Opção B — extrair de novo do `.gz`**

```bash
node scripts/extract-supabase-public-schema.mjs
# gera database/restore-from-backup-public-schema-extracted.sql
```

## 3. Restaurar dados (opcional)

O backup inclui dados nas tabelas `public` (fotos, tags, usuários OAuth, etc.).

O formato é `COPY ... FROM stdin` — **só funciona via `psql`**, não no SQL Editor web.

```bash
# Instalar cliente PostgreSQL (macOS)
brew install libpq
brew link --force libpq

# Connection string: Settings → Database → Connection string (URI)
export DATABASE_URL="postgresql://postgres.[ref]:[SENHA]@aws-0-[regiao].pooler.supabase.com:6543/postgres"

# Schema primeiro (se ainda não rodou)
psql "$DATABASE_URL" -f database/restore-from-backup-2025-11-17-schema.sql

# Extrair blocos COPY do backup
node scripts/extract-supabase-public-schema.mjs --data

# Importar dados
psql "$DATABASE_URL" -f database/restore-from-backup-public-data-extracted.sql
```

**Segurança:** `public.users` contém `access_token` e `refresh_token`. Não exponha essa tabela via API sem RLS. Considere migrar tokens para Vault ou criptografia antes de ir para produção.

## 4. Cockpit 2026 — schema principal

Depois do app de fotos (se for usar no mesmo projeto), aplique as migrações do Cockpit na ordem habitual, começando por:

```
database/schema.sql
```

e em seguida os `database/create-*.sql` / `database/add-*.sql` conforme a documentação do repositório.

Não há conflito de nome entre `public.users` (fotos) e `auth.users` (login Supabase), mas **`profiles`** do Cockpit é tabela separada ligada a `auth.users`.

## 5. Próximos passos no código

Para reativar funcionalidades no Cockpit contra este banco:

1. APIs em `app/api/` que leiam/escrevam `photos`, `sync_events`, etc.  
2. RLS em `public.users` (tokens sensíveis)  
3. Integração com módulo Conteúdo / Storage se thumbnails forem re-hospedados no Supabase Storage  

Se o backup esperado era o **banco antigo completo do Cockpit**, este arquivo `.gz` não o contém — seria necessário outro export ou reconstruir via `database/*.sql`.
