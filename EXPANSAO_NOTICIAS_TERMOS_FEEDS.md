# 🔄 Atualização: Uso dos Mesmos Termos dos Feeds do Google Alerts

## ✅ Implementação

### O que foi ajustado:

#### 1. **API Unificada** (`/api/noticias/collect/all-sources`)
- Nova API que coleta de **todas as fontes** usando os **mesmos termos** dos feeds configurados
- Usa o campo `name` dos feeds como termo de busca para GDELT e Media Cloud
- Mantém a coleta do Google Alerts usando os feeds RSS existentes

#### 2. **API GDELT Schedule Atualizada** (`/api/noticias/collect/gdelt/schedule`)
- Agora busca termos dos feeds configurados primeiro
- Fallback para variável de ambiente `GDELT_QUERIES` se não houver feeds
- **Garante que os mesmos termos sejam usados** em todas as fontes

---

## 🎯 Como Funciona

### Fluxo de Coleta Unificada:

1. **Buscar feeds configurados** do usuário (tabela `news_feeds`)
2. **Extrair termos únicos** do campo `name` de cada feed
3. **Coletar de cada fonte usando os mesmos termos:**
   - **Google Alerts**: Usa os feeds RSS (já existente)
   - **GDELT**: Usa o `name` do feed como termo de busca
   - **Media Cloud**: Usa o `name` do feed como termo de busca

### Exemplo:

Se você tem feeds configurados com:
- Feed 1: `name = "Jady Lencar"`
- Feed 2: `name = "Jady Lencar + Piauí"`

O sistema irá buscar:
- **Google Alerts**: Via RSS de cada feed
- **GDELT**: `"Jady Lencar"` e `"Jady Lencar + Piauí"`
- **Media Cloud**: `"Jady Lencar"` e `"Jady Lencar + Piauí"`

---

## 🔧 Como Usar

### Opção 1: API Unificada (Recomendado)

```javascript
// Coletar de todas as fontes usando termos dos feeds
fetch('/api/noticias/collect/all-sources', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    include_gdelt: true,           // Incluir GDELT
    include_media_cloud: false,     // Incluir Media Cloud (requer API key)
    media_cloud_api_key: '...',     // Opcional: se incluir Media Cloud
    maxRecords: 50,                 // Máximo por termo (GDELT)
    hours: 24,                      // Horas para GDELT
    days: 7,                        // Dias para Media Cloud
  })
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Coleta unificada:', data)
  })
```

### Opção 2: Coleta Manual Individual (Termos Específicos)

Você ainda pode usar as APIs individuais se quiser buscar termos específicos:

```javascript
// GDELT manual (termo específico)
fetch('/api/noticias/collect/gdelt', {
  method: 'POST',
  body: JSON.stringify({
    query: 'Termo específico',
    maxRecords: 10,
    hours: 24,
  })
})

// Media Cloud manual (termo específico)
fetch('/api/noticias/collect/media-cloud', {
  method: 'POST',
  body: JSON.stringify({
    api_key: 'SUA_API_KEY',
    query: 'Termo específico',
    days: 7,
  })
})
```

---

## 📊 Resposta da API Unificada

```json
{
  "message": "Coleta concluída: 45 notícias coletadas de todas as fontes",
  "collected": 45,
  "search_terms_used": [
    "Jady Lencar",
    "Jady Lencar + Piauí"
  ],
  "results": [
    {
      "source": "google_alerts",
      "feed_name": "Jady Lencar",
      "collected": 5
    },
    {
      "source": "google_alerts",
      "feed_name": "Jady Lencar + Piauí",
      "collected": 3
    },
    {
      "source": "gdelt",
      "search_term": "Jady Lencar",
      "collected": 12
    },
    {
      "source": "gdelt",
      "search_term": "Jady Lencar + Piauí",
      "collected": 8
    },
    {
      "source": "media_cloud",
      "search_term": "Jady Lencar",
      "collected": 10
    },
    {
      "source": "media_cloud",
      "search_term": "Jady Lencar + Piauí",
      "collected": 7
    }
  ]
}
```

---

## 🔄 Coleta Agendada (GDELT)

A coleta agendada do GDELT agora **automaticamente** usa os termos dos feeds configurados:

```bash
POST /api/noticias/collect/gdelt/schedule
Authorization: Bearer seu-secret-token
```

**Comportamento:**
1. Busca todos os feeds ativos
2. Extrai termos únicos do campo `name`
3. Busca no GDELT usando esses termos
4. Se não houver feeds, usa `GDELT_QUERIES` do `.env` (fallback)

---

## ✅ Vantagens

1. **Consistência**: Mesmos termos em todas as fontes
2. **Simplicidade**: Configura uma vez (nos feeds), usa em todas as fontes
3. **Manutenção**: Ao atualizar um feed, todos os sistemas usam o termo atualizado
4. **Rastreabilidade**: Fácil identificar qual termo gerou cada notícia

---

## 📝 Notas Importantes

1. **O campo `name` do feed é usado como termo de busca** para GDELT e Media Cloud
2. **Termos são extraídos automaticamente** dos feeds configurados
3. **Duplicatas são removidas** entre todas as fontes (por URL)
4. **Google Alerts mantém classificação automática** (se configurado)
5. **GDELT e Media Cloud são armazenados brutos** (sem classificação automática)

---

## 🚀 Próximos Passos

1. Testar a API unificada: `/api/noticias/collect/all-sources`
2. Configurar cron job usando a API unificada (se desejado)
3. Verificar notícias coletadas na interface
4. Classificar manualmente as notícias do GDELT e Media Cloud
