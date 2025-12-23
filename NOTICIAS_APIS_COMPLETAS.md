# 📰 APIs - Notícias, Crises & Radar de Adversários

## ✅ APIs Implementadas

### 📰 Notícias

#### GET `/api/noticias`
Lista notícias com filtros opcionais.

**Query Params:**
- `sentiment` (optional): positive | negative | neutral
- `risk_level` (optional): low | medium | high
- `theme` (optional): string
- `processed` (optional): true | false
- `limit` (optional): número (padrão: 50)
- `offset` (optional): número (padrão: 0)

**Resposta:**
```json
[
  {
    "id": "uuid",
    "title": "string",
    "source": "string",
    "url": "string",
    "content": "string",
    "sentiment": "positive|negative|neutral",
    "risk_level": "low|medium|high",
    "theme": "string",
    "actor": "string",
    "published_at": "ISO string",
    "collected_at": "ISO string",
    "processed": boolean,
    "crisis_id": "uuid|null",
    "created_at": "ISO string",
    "updated_at": "ISO string"
  }
]
```

#### POST `/api/noticias`
Cria uma nova notícia (importação manual).

**Body:**
```json
{
  "title": "string (required)",
  "source": "string (required)",
  "url": "string (optional)",
  "content": "string (optional)",
  "sentiment": "positive|negative|neutral (optional)",
  "risk_level": "low|medium|high (optional)",
  "theme": "string (optional)",
  "actor": "string (optional)",
  "published_at": "ISO string (optional)",
  "crisis_id": "uuid (optional)"
}
```

#### GET `/api/noticias/[id]`
Busca uma notícia específica.

#### PUT `/api/noticias/[id]`
Atualiza uma notícia (classificação manual, vinculação a crise, etc.).

#### DELETE `/api/noticias/[id]`
Remove uma notícia.

---

### 🚨 Crises

#### GET `/api/noticias/crises`
Lista crises com filtros.

**Query Params:**
- `status` (optional): open | monitoring | resolved | archived
- `severity` (optional): low | medium | high | critical

**Resposta:** Inclui dados relacionados de narrativas sugeridas.

#### POST `/api/noticias/crises`
Cria uma nova crise.

**Body:**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "severity": "low|medium|high|critical (required)",
  "status": "open|monitoring|resolved|archived (optional, padrão: open)",
  "narrative_id": "uuid (optional)"
}
```

#### GET `/api/noticias/crises/[id]`
Busca uma crise específica.

#### PUT `/api/noticias/crises/[id]`
Atualiza uma crise. Se mudar status para "resolved", calcula automaticamente o tempo de resposta.

#### DELETE `/api/noticias/crises/[id]`
Remove uma crise.

---

### 👥 Adversários

#### GET `/api/noticias/adversarios`
Lista todos os adversários, ordenados por presença (Share of Voice).

#### POST `/api/noticias/adversarios`
Cadastra um novo adversário.

**Body:**
```json
{
  "name": "string (required)",
  "type": "candidate|party|media|influencer|other (optional)",
  "themes": ["string"] (optional),
  "presence_score": 0-100 (optional)
}
```

#### GET `/api/noticias/adversarios/[id]`
Busca um adversário específico.

#### PUT `/api/noticias/adversarios/[id]`
Atualiza um adversário. Atualiza automaticamente `last_updated`.

#### DELETE `/api/noticias/adversarios/[id]`
Remove um adversário.

---

### ⚔️ Ataques de Adversários

#### GET `/api/noticias/adversarios/[id]/attacks`
Lista todos os ataques/menções de um adversário.

**Resposta:** Inclui dados das notícias relacionadas.

#### POST `/api/noticias/adversarios/[id]/attacks`
Registra um novo ataque/menção.

**Body:**
```json
{
  "news_id": "uuid (required)",
  "attack_type": "direct|indirect|false_claim|omission (required)"
}
```

---

### 📊 Métricas

#### GET `/api/noticias/metrics`
Retorna métricas agregadas.

**Query Params:**
- `days` (optional): número de horas para menções (padrão: 24)

**Resposta:**
```json
{
  "mentions_24h": 142,
  "high_risk_crises_open": 2,
  "avg_response_time_hours": "2.5",
  "share_of_voice": 42
}
```

---

### 📈 Temas em Alta

#### GET `/api/noticias/temas-alta`
Retorna temas mais mencionados.

**Query Params:**
- `days` (optional): número de dias (padrão: 7)
- `limit` (optional): número de resultados (padrão: 10)

**Resposta:**
```json
[
  {
    "tema": "Saúde",
    "mencoes": 45,
    "recentes": 12,
    "tendencia": "+12"
  }
]
```

---

## 🔐 Autenticação

Todas as APIs requerem autenticação via Supabase. O token deve ser enviado no header ou cookie de sessão.

## ✅ Status

- ✅ Schema do banco criado
- ✅ APIs CRUD completas para Notícias
- ✅ APIs CRUD completas para Crises
- ✅ APIs CRUD completas para Adversários
- ✅ API de Ataques de Adversários
- ✅ API de Métricas
- ✅ API de Temas em Alta
- 🟡 UI/Frontend: A implementar
- 🔴 Integrações externas: Pendente




