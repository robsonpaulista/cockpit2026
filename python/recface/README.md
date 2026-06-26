# Motor facial (recface) — Cockpit 2026

**Streamlit não é usado.** Serviço Python (InsightFace) chamado pelo Next.js.

## Desenvolvimento local

```bash
npm run dev
```

Sobe **Next.js + recface** juntos (via `concurrently`).

Só o Next, sem Python:

```bash
npm run dev:next
```

## Produção

O recface **não roda dentro da Vercel/serverless** — é um processo Python separado (CPU + ~200MB de modelos ONNX).

### Opção A — VPS / servidor próprio (mais simples)

```bash
npm run build
npm run start:all
```

Sobe Next (`next start`) + recface no mesmo servidor. No `.env`:

```env
RECFACE_API_URL=http://127.0.0.1:8502
RECFACE_SKIP_PIP=1   # após primeira instalação do venv
```

### Opção B — Docker (recface isolado)

```bash
docker compose -f docker-compose.recface.yml up -d --build
```

No `.env` do Cockpit:

```env
RECFACE_API_URL=http://127.0.0.1:8502
# ou URL interna: http://recface:8502 se Next também estiver no Docker
RECFACE_CORS_ORIGINS=https://seu-dominio.com
```

### Opção C — Vercel (Next) + recface em outro host

1. Deploy do Cockpit na Vercel (`npm run build` / `next start` automático).
2. recface em Railway, Fly.io, Render ou VPS via Docker.
3. Variável na Vercel:

```env
RECFACE_API_URL=https://recface.seudominio.com
RECFACE_CORS_ORIGINS=https://cockpit.seudominio.com
```

Cadastro de pessoas e reconhecimento nas fotos **ficam indisponíveis** se `RECFACE_API_URL` não apontar para um serviço ativo.

## Scripts npm

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Next + recface (local) |
| `npm run dev:next` | Só Next |
| `npm run start` | Só Next (Vercel / padrão) |
| `npm run start:all` | Next + recface (VPS) |
| `npm run recface:server` | Só o motor Python |

## Setup Supabase (cadastro de pessoas)

1. `database/create-person-enrollments.sql`
2. Bucket Storage **`person-enrollments`**

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `RECFACE_API_URL` | `http://127.0.0.1:8502` | URL usada pelo Next.js |
| `RECFACE_PORT` | `8502` | Porta do uvicorn |
| `RECFACE_HOST` | `127.0.0.1` | Use `0.0.0.0` no Docker |
| `RECFACE_SKIP_PIP` | — | `1` pula `pip install` no start |
| `RECFACE_CORS_ORIGINS` | localhost:3000 | Origens permitidas (CSV) |
