# 🔍 Diagnóstico - GDELT retornando 0 resultados

## ✅ Problema Identificado e Corrigido

### Bug corrigido:
- **Problema**: Quando não havia URLs existentes no banco, o código não processava as notícias (estava dentro de `if (existingUrls.length > 0)`)
- **Solução**: Ajustada a lógica para sempre processar notícias, verificando duplicatas apenas quando necessário

---

## 📊 Possíveis Razões para GDELT retornar 0

### 1. **Termo de busca muito específico**
O GDELT pode não ter muitos resultados para "Jadyel Alencar" nas últimas 24 horas. Isso é normal!

**Soluções:**
- Tentar termos mais genéricos para testar
- Aumentar o período de busca (ex: 7 dias)
- Verificar se o nome está escrito corretamente

### 2. **API do GDELT temporariamente indisponível**
A API do GDELT pode estar sobrecarregada ou em manutenção.

**Soluções:**
- Tentar novamente em alguns minutos
- Verificar logs do servidor para erros específicos

### 3. **Formato da resposta diferente**
A API do GDELT pode retornar dados em formato diferente do esperado.

**Como verificar:**
- Ver logs do servidor (console do Next.js)
- Verificar a URL da requisição no log
- Testar manualmente a API do GDELT

---

## 🧪 Como Diagnosticar

### 1. Verificar logs do servidor
Procure por logs como:
- `[GDELT] Buscando artigos:`
- `[GDELT] Resposta recebida:`
- `[GDELT] Erro ao buscar artigos:`

### 2. Testar API do GDELT diretamente
Teste no navegador ou curl:

```bash
# Teste básico
curl "https://api.gdeltproject.org/api/v2/doc/doc?query=Brazil&mode=artlist&maxrecords=10&format=json"
```

### 3. Testar com termo mais genérico
Tente com termos que devem ter muitos resultados:

```javascript
// No console do navegador
fetch('/api/noticias/collect/gdelt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Brasil', // Termo mais genérico
    maxRecords: 10,
    hours: 24,
  })
})
  .then(res => res.json())
  .then(data => console.log('Resultado:', data))
```

---

## 🔧 Configuração Necessária

### GDELT: ✅ Nenhuma configuração necessária
- Não requer API key
- Não requer autenticação
- Gratuito e público

### Media Cloud: ⚠️ Requer API key
- Precisa obter API key em: https://www.mediacloud.org/
- Não foi testado porque `include_media_cloud` estava `false`

---

## 💡 O que fazer agora

1. **Verificar logs do servidor** para ver se há erros do GDELT
2. **Testar com termo mais genérico** para confirmar que a API funciona
3. **Testar diretamente a API do GDELT** no navegador
4. **Aumentar período de busca** (ex: 7 dias em vez de 24 horas)

---

## 📝 Notas

- **É normal** o GDELT retornar 0 resultados para termos muito específicos
- O GDELT tem milhões de fontes, mas pode não ter cobertura completa para termos específicos
- O Google Alerts é mais direcionado e pode ter resultados que o GDELT não tem
- O GDELT complementa, não substitui o Google Alerts
