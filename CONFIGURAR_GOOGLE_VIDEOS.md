# Google Vídeos no Radar (Playwright — piloto castração)

Coleta da **aba Vídeos do Google** (`udm=7`) via Playwright + Chromium, espelhando a busca manual no Google.

**Escopo:** apenas tema **castração / causa animal** (Teresina/Piauí):

- `busão da castração teresina`
- `ônibus da castração teresina`
- `castração teresina piauí`
- `pacto pelos animais piaui teresina`

**Custo:** gratuito (sem Apify). Requer ambiente com Chromium instalado.

---

## Pré-requisitos

```bash
npx playwright install chromium
```

No `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_VIDEOS_SKIP_COOLDOWN=1   # opcional, só dev
```

---

## Migration do log (cooldown)

Execute no Supabase:

```sql
-- database/create-google-videos-collect-log.sql
```

Cooldown padrão: **7 dias** entre coletas.

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `GOOGLE_VIDEOS_MAX_ITEMS` | 20 | Vídeos por termo (máx. 40) |
| `GOOGLE_VIDEOS_SOCIAL_ONLY` | `1` | Só Instagram, YouTube, Facebook… |
| `GOOGLE_VIDEOS_LOCAL_FILTER` | `1` | Exige Teresina/Piauí no título/snippet |
| `GOOGLE_VIDEOS_COOLDOWN_DAYS` | 7 | Dias entre coletas |
| `GOOGLE_VIDEOS_SKIP_COOLDOWN` | — | `1` desativa cooldown (dev) |
| `GOOGLE_VIDEOS_COUNTRY` | `br` | Parâmetro `gl` do Google |
| `GOOGLE_VIDEOS_LANGUAGE` | `pt-BR` | Parâmetro `hl` do Google |

---

## Coleta

### Pelo cockpit (dev local)

1. `npm run dev`
2. Radar → aba **Google Vídeos** → **Atualizar vídeos**

### Linha de comando

```bash
node scripts/collect-google-videos.mjs
node scripts/collect-google-videos.mjs --slug instagram-causa-animal
```

---

## Vercel / produção

Playwright **não roda** no runtime serverless da Vercel. Opções:

- Coletar localmente ou em cron na sua máquina/servidor
- Forçar na Vercel (não recomendado): `GOOGLE_VIDEOS_RUNNER_ENABLED=1`

---

## Ator no cockpit

Slugs reconhecidos para o piloto:

- `instagram-causa-animal`
- nome contendo **instagram** + **causa animal**
