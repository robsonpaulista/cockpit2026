# 🧪 Guia de Teste - APIs de Coleta Manual

## ✅ Pré-requisitos

1. ✅ Script SQL executado no Supabase (`database/add-source-fields-to-news.sql`)
2. ✅ Servidor Next.js rodando (npm run dev)
3. ✅ Usuário autenticado no sistema

---

## 🔍 1. Testar API GDELT

### Opção A: Usando curl (Terminal)

```bash
# Teste básico - buscar últimas 24 horas
curl -X POST http://localhost:3000/api/noticias/collect/gdelt \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "query": "Lula",
    "maxRecords": 10,
    "hours": 24,
    "auto_classify": false
  }'
```

### Opção B: Usando JavaScript/Fetch (Console do Navegador)

Abra o console do navegador (F12) na página de notícias e execute:

```javascript
// Teste básico - GDELT
fetch('/api/noticias/collect/gdelt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'Lula',
    maxRecords: 10,
    hours: 24,
    auto_classify: false
  })
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Resposta GDELT:', data)
  })
  .catch(error => {
    console.error('❌ Erro:', error)
  })
```

### Exemplo de Resposta Esperada (Sucesso):

```json
{
  "message": "10 notícias coletadas do GDELT",
  "collected": 10,
  "news": [
    {
      "id": "...",
      "title": "...",
      "source": "...",
      "source_type": "gdelt",
      "url": "...",
      "publisher": "...",
      "reviewed": false,
      "processed": false,
      ...
    }
  ]
}
```

### Exemplo de Resposta (Nenhuma notícia nova):

```json
{
  "message": "Todas as notícias já foram coletadas",
  "collected": 0
}
```

---

## 📊 2. Testar API Media Cloud

**⚠️ Nota:** Media Cloud requer API key. Obtenha em: https://www.mediacloud.org/

### Opção A: Usando curl

```bash
curl -X POST http://localhost:3000/api/noticias/collect/media-cloud \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "api_key": "SUA_API_KEY_AQUI",
    "query": "Lula",
    "days": 7,
    "limit": 10,
    "auto_classify": false
  }'
```

### Opção B: Usando JavaScript/Fetch

```javascript
// Teste Media Cloud (requer API key)
fetch('/api/noticias/collect/media-cloud', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    api_key: 'SUA_API_KEY_AQUI', // Substitua pela sua API key
    query: 'Lula',
    days: 7,
    limit: 10,
    auto_classify: false
  })
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Resposta Media Cloud:', data)
  })
  .catch(error => {
    console.error('❌ Erro:', error)
  })
```

### Exemplo de Resposta Esperada:

```json
{
  "message": "5 notícias coletadas do Media Cloud",
  "collected": 5,
  "news": [...]
}
```

---

## 🔧 3. Testar via Interface do Sistema

### Verificar Notícias Coletadas

Após executar as APIs, acesse:
- **Dashboard → Notícias e Relatos**
- Verifique se as notícias aparecem na lista
- Filtre por `source_type` para ver:
  - `gdelt` - Notícias do GDELT
  - `media_cloud` - Notícias do Media Cloud
  - `google_alerts` - Notícias do Google Alerts (existente)

---

## 📝 4. Testes Sugeridos

### Teste 1: GDELT - Busca Básica
```json
{
  "query": "eleições 2026",
  "maxRecords": 5,
  "hours": 24
}
```

### Teste 2: GDELT - Período Específico
```json
{
  "query": "candidato",
  "maxRecords": 10,
  "startDateTime": "20241201000000",
  "endDateTime": "20241231235959"
}
```

### Teste 3: Media Cloud - Últimos 7 dias
```json
{
  "api_key": "SUA_API_KEY",
  "query": "política",
  "days": 7,
  "limit": 10
}
```

---

## 🔍 5. Verificar Dados no Banco

Execute no Supabase SQL Editor:

```sql
-- Ver notícias coletadas do GDELT
SELECT 
  id,
  title,
  source,
  source_type,
  publisher,
  url,
  reviewed,
  processed,
  collected_at
FROM news
WHERE source_type = 'gdelt'
ORDER BY collected_at DESC
LIMIT 10;

-- Ver notícias coletadas do Media Cloud
SELECT 
  id,
  title,
  source,
  source_type,
  publisher,
  url,
  reviewed,
  processed,
  collected_at
FROM news
WHERE source_type = 'media_cloud'
ORDER BY collected_at DESC
LIMIT 10;

-- Ver todas as fontes
SELECT 
  source_type,
  COUNT(*) as total,
  COUNT(CASE WHEN reviewed = true THEN 1 END) as revisadas,
  COUNT(CASE WHEN processed = true THEN 1 END) as processadas
FROM news
GROUP BY source_type;
```

---

## ❌ 6. Troubleshooting

### Erro: "Não autenticado"
- **Solução:** Certifique-se de estar logado no sistema
- Para curl: inclua o cookie de autenticação

### Erro: "GDELT API retornou status..."
- **Causa:** Problema na API do GDELT (pode estar temporariamente indisponível)
- **Solução:** Tente novamente em alguns minutos

### Erro: "API key do Media Cloud inválida"
- **Causa:** API key incorreta ou não configurada
- **Solução:** Verifique a API key em https://www.mediacloud.org/

### Erro: "Nenhuma notícia encontrada"
- **Causa:** Query não retornou resultados
- **Solução:** Tente termos de busca diferentes ou período maior

### Erro no banco: "column does not exist"
- **Causa:** Script SQL não foi executado
- **Solução:** Execute `database/add-source-fields-to-news.sql` no Supabase

---

## 📊 7. Checklist de Teste

- [ ] Script SQL executado com sucesso
- [ ] API GDELT retorna dados
- [ ] API Media Cloud retorna dados (se tiver API key)
- [ ] Notícias aparecem na interface
- [ ] Campos `source_type` e `publisher` estão preenchidos
- [ ] Notícias aparecem com `reviewed: false` e `processed: false`
- [ ] Duplicatas são detectadas corretamente
- [ ] Classificação manual funciona (editar notícia)

---

## 🚀 Próximo Passo

Após testar as APIs manuais, configure a coleta automática do GDELT:

1. Adicione `GDELT_QUERIES` no `.env.local`
2. Configure cron job
3. Teste o endpoint `/api/noticias/collect/gdelt/schedule`
