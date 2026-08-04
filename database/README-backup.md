# Backup do banco Supabase

Rotina de backup **lógico** das tabelas `public` (JSONL.gz por tabela), sem depender de `pg_dump`.

## Opções

### 1. Script local (recomendado no dia a dia)

```bash
# Backup padrão (omite tabelas muito grandes: radar, votos, fotos…)
npm run db:backup

# Inclui tudo
npm run db:backup -- --full

# Só algumas tabelas
npm run db:backup -- --tables=obras,polls,cities

# Envia também para o Storage (bucket db-backups)
npm run db:backup -- --upload

# Mantém só os 14 backups locais mais recentes (padrão)
npm run db:backup -- --keep=14

# Lista o que seria exportado
npm run db:backup -- --dry-run
```

Saída local (gitignored):

```
backups/supabase/2026-07-30T14-30-00/
  manifest.json
  tables/
    obras.jsonl.gz
    polls.jsonl.gz
    …
```

Requer em `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- opcional: `SUPABASE_BACKUP_BUCKET` (default `db-backups`)

### 2. Cron na Vercel (offsite no Storage)

Rota: `POST /api/cron/backup-supabase`  
Header: `Authorization: Bearer $CRON_SECRET`

Exemplo `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/backup-supabase",
      "schedule": "0 6 * * *"
    }
  ]
}
```

No painel Vercel, configure `CRON_SECRET` (e as chaves Supabase).  
O cron grava em **Storage → bucket `db-backups`** (privado).

### 3. Cron no Mac (launchd / crontab)

```bash
# Todo dia às 03:00
0 3 * * * cd "/Users/robson/Documents/backup robson/copilot 2026" && /usr/local/bin/npm run db:backup -- --upload >> /tmp/cockpit-db-backup.log 2>&1
```

## O que NÃO entra no modo padrão

Tabelas de alto volume (use `--full` ou `?full=1`):

- menções de notícias/vídeos/trends/Meta Ads
- históricos e comentários Instagram
- `votacao_secao_local`, `federal_2018`
- fotos / face descriptors (PhotoFinder)

Sempre fora (nem com `--full`): `votacao_secao_voto` (planilha TSE importada — maior tabela).

## Restore (orientação)

1. Descompacte o `.jsonl.gz` da tabela.
2. Reimporte via script/`INSERT` ou SQL Editor em lotes.
3. Schema continua vindo de `database/schema.sql` + migrações `database/*.sql`.

Para dump binário completo do Postgres (PITR / `pg_dump`), use o backup nativo do plano Supabase (Dashboard → Database → Backups) e/ou `DATABASE_URL` + `pg_dump` fora deste script.

## Relação com o purge de 60 dias

O cron `purge-retention` apaga notícias/comentários antigos. Rode o backup **antes** dessa janela (ex.: backup 06:00, purge 07:00).
