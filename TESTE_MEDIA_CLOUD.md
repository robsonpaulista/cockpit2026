# 🔍 Teste Media Cloud API

## Como Testar

### Opção 1: Console do Navegador (Recomendado)

1. Abra o navegador e acesse seu sistema (http://localhost:3000)
2. Faça login se necessário
3. Abra o Console do Desenvolvedor (F12 → Console)
4. Cole o código abaixo e execute:

```javascript
// Teste Media Cloud individual
fetch('/api/noticias/collect/media-cloud', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: 'f7dc85ed00f79b8bc71b812d5840891bb88d80cf',
    query: 'Jadyel Alencar',
    days: 7,
    limit: 10,
  })
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Resultado:', data)
    if (data.news) {
      console.log('📰 Notícias:', data.news)
    }
  })
  .catch(err => console.error('❌ Erro:', err))
```

Ou use o arquivo `teste-media-cloud-rapido.js`:

1. Abra `teste-media-cloud-rapido.js` no editor
2. Copie todo o conteúdo
3. Cole no console do navegador
4. Execute: `testeMediaCloudRapido('Jadyel Alencar', 7)`

### Opção 2: Node.js (requer fetch global)

Se você tem Node.js 18+ com fetch global:

```bash
node teste-media-cloud-node.js
```

**Nota**: Este método pode falhar se precisar de autenticação. Use o console do navegador.

### Opção 3: cURL

```bash
curl -X POST http://localhost:3000/api/noticias/collect/media-cloud \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "f7dc85ed00f79b8bc71b812d5840891bb88d80cf",
    "query": "Jadyel Alencar",
    "days": 7,
    "limit": 10
  }'
```

---

## Teste Coleta Unificada (Todas as Fontes)

No console do navegador:

```javascript
fetch('/api/noticias/collect/all-sources', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    include_gdelt: true,
    include_media_cloud: true,
    media_cloud_api_key: 'f7dc85ed00f79b8bc71b812d5840891bb88d80cf',
    maxRecords: 10,
    hours: 24,
    days: 7,
  })
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Resultado:', data)
    console.log('📊 Por fonte:', data.results)
  })
  .catch(err => console.error('❌ Erro:', err))
```

Ou use o arquivo `teste-media-cloud-rapido.js` e execute:
```javascript
testeColetaUnificadaComMediaCloud()
```

---

## O que Esperar

### Sucesso ✅
- `collected`: número de notícias coletadas
- `message`: mensagem de sucesso
- `news`: array com as notícias coletadas

### Erro ❌
- `error`: mensagem de erro
- `details`: detalhes adicionais (se houver)

Possíveis erros:
- "API key inválida" → Verifique a API key
- "Não autenticado" → Faça login primeiro
- "Nenhuma notícia encontrada" → Normal, pode não haver resultados

---

## Checklist

- [ ] Servidor Next.js rodando (npm run dev)
- [ ] Logado no sistema
- [ ] API key do Media Cloud válida
- [ ] Console do navegador aberto (F12)
