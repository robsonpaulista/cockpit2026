# 🧪 Como Testar Coleta de Notícias na Página

## 📋 Passo a Passo

### 1️⃣ **Acessar a Página de Notícias**

1. Abra seu navegador
2. Acesse: `http://localhost:3000/dashboard/noticias`
3. Faça login se necessário

### 2️⃣ **Abrir o Console do Navegador**

1. Pressione **F12** (ou `Ctrl+Shift+I` no Windows/Linux, `Cmd+Option+I` no Mac)
2. Vá na aba **Console**

### 3️⃣ **Executar o Teste de Coleta**

Cole e execute este código no console:

```javascript
// Teste Coleta Unificada (Google Alerts + GDELT)
console.log('🔄 Iniciando coleta de notícias...')

fetch('/api/noticias/collect/all-sources', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    include_gdelt: true,
    include_media_cloud: false,  // Media Cloud com problemas de conexão
    maxRecords: 10,
    hours: 24,
  })
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ RESULTADO DA COLETA:', data)
    console.log('📊 Total coletado:', data.collected, 'notícias')
    console.log('📰 Resultados por fonte:')
    data.results?.forEach(result => {
      console.log(`  - ${result.source}: ${result.collected} notícias`)
      if (result.error) {
        console.error(`    ⚠️ Erro: ${result.error}`)
      }
    })
    
    // Alert visual
    alert(`✅ Coleta concluída!\n\nTotal: ${data.collected} notícias\n\nRecarregue a página (F5) para ver as notícias.`)
  })
  .catch(err => {
    console.error('❌ ERRO:', err)
    alert('❌ Erro ao coletar notícias. Verifique o console para detalhes.')
  })
```

### 4️⃣ **Verificar Resultado**

Após executar, você verá:
- ✅ No console: resultado detalhado da coleta
- ✅ Alert: mensagem com total de notícias coletadas
- ✅ Recarregue a página (F5) para ver as notícias na lista

---

## 🔍 O que Verificar Após a Coleta

### 1. **Na Lista de Notícias**

Após recarregar a página (F5):

- ✅ **Novas notícias aparecem** na lista
- ✅ **Fonte mostra**: "gdelt" ou "google_alerts"
- ✅ **Título e URL** estão preenchidos
- ✅ **Data de publicação** está correta

### 2. **Filtrar por Fonte**

Na página de notícias, use os filtros:
- Filtrar por feed (se houver checkbox)
- Verificar se notícias do GDELT aparecem
- Verificar se notícias do Google Alerts aparecem

### 3. **Verificar Detalhes**

Clique em uma notícia:
- ✅ URL funciona (abre o link)
- ✅ Título está completo
- ✅ Fonte está correta
- ✅ Data está correta

---

## 📊 Teste Específico: GDELT com Filtro Brasil

Para testar se o GDELT está filtrando por Brasil:

```javascript
// Teste GDELT específico
fetch('/api/noticias/collect/gdelt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Jadyel Alencar',
    maxRecords: 10,
    hours: 24,
  })
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Resultado GDELT:', data)
    
    // Ver notícias coletadas
    return fetch('/api/noticias?source_type=gdelt&limit=5')
  })
  .then(res => res.json())
  .then(news => {
    console.log('📰 Notícias GDELT coletadas:', news)
    alert(`${news.length} notícias do GDELT encontradas!\n\nRecarregue a página (F5) para ver.`)
  })
  .catch(err => console.error('❌ Erro:', err))
```

---

## 🎯 Teste Completo (Todas as Fontes)

Execute este teste completo que mostra tudo:

```javascript
(async function testeCompleto() {
  console.log('🧪 TESTE COMPLETO - COLETA DE NOTÍCIAS')
  console.log('=====================================\n')
  
  try {
    // 1. Coletar
    console.log('1️⃣ Coletando notícias...')
    const collectRes = await fetch('/api/noticias/collect/all-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        include_gdelt: true,
        include_media_cloud: false,
        maxRecords: 10,
        hours: 24,
      })
    })
    const collectData = await collectRes.json()
    console.log('✅ Coleta:', collectData)
    
    // 2. Verificar notícias GDELT
    console.log('\n2️⃣ Verificando notícias GDELT...')
    const gdeltRes = await fetch('/api/noticias?source_type=gdelt&limit=5')
    const gdeltNews = await gdeltRes.json()
    console.log(`📰 Notícias GDELT: ${gdeltNews.length}`)
    
    // 3. Verificar notícias Google Alerts
    console.log('\n3️⃣ Verificando notícias Google Alerts...')
    const alertsRes = await fetch('/api/noticias?source_type=google_alerts&limit=5')
    const alertsNews = await alertsRes.json()
    console.log(`📰 Notícias Google Alerts: ${alertsNews.length}`)
    
    // 4. Resumo
    console.log('\n📊 RESUMO:')
    console.log(`  - Total coletado: ${collectData.collected}`)
    console.log(`  - GDELT: ${gdeltNews.length} notícias`)
    console.log(`  - Google Alerts: ${alertsNews.length} notícias`)
    
    alert(`✅ Teste completo!\n\nTotal coletado: ${collectData.collected}\nGDELT: ${gdeltNews.length}\nGoogle Alerts: ${alertsNews.length}\n\nRecarregue a página (F5) para ver!`)
  } catch (err) {
    console.error('❌ Erro:', err)
    alert('❌ Erro no teste. Verifique o console.')
  }
})()
```

---

## ✅ Checklist de Teste

### Teste Básico
- [ ] Executar coleta unificada no console
- [ ] Ver resultado no console (deve mostrar `collected` > 0)
- [ ] Ver alert de sucesso
- [ ] Recarregar página (F5)
- [ ] Verificar novas notícias na lista

### Teste de Filtros
- [ ] Filtrar por fonte GDELT
- [ ] Filtrar por fonte Google Alerts
- [ ] Verificar se filtros funcionam

### Teste de Detalhes
- [ ] Clicar em uma notícia
- [ ] Verificar URL funciona
- [ ] Verificar dados estão corretos

---

## 🐛 Se Não Funcionar

### ❌ Erro 401 (Não autenticado)
- **Solução**: Faça login novamente

### ❌ `collected: 0`
- **Pode ser normal**: Não há notícias novas
- **Teste**: Tente com termo mais genérico

### ❌ Erro 500
- **Solução**: Verifique logs do servidor (terminal do Next.js)

---

## 💡 Dica Rápida

**Atalho**: Você pode criar um bookmark no navegador com o código JavaScript para executar rapidamente sempre que precisar testar!

---

## 📝 Resumo

1. ✅ Acesse `/dashboard/noticias`
2. ✅ Abra console (F12)
3. ✅ Execute o código de teste
4. ✅ Recarregue a página (F5)
5. ✅ Verifique as notícias na lista

**Pronto!** Agora você pode testar a coleta diretamente na página! 🎉
