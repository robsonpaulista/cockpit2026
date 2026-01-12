# 🔍 Debug: Media Cloud API não retorna resposta

## ⚠️ Problema

A requisição está pendente (`Promise {<pending>}`) e não retorna resultado.

## 🔍 Como Diagnosticar

### 1. **Verificar Aba Network (DevTools)**

1. Abra DevTools (F12)
2. Vá na aba **Network**
3. Execute a requisição novamente
4. Procure pela requisição `collect/media-cloud`
5. Clique nela e verifique:
   - **Status Code**: 200, 400, 401, 500?
   - **Response**: O que retorna?
   - **Headers**: Há algum erro?

### 2. **Verificar Logs do Servidor**

No terminal onde o Next.js está rodando (`npm run dev`), procure por:

```
[Media Cloud] Buscando histórias:
[Media Cloud] URL da requisição:
[Media Cloud] Resposta recebida:
[Media Cloud] Erro ao buscar histórias:
Erro ao coletar notícias do Media Cloud:
```

### 3. **Testar Autenticação**

A API requer autenticação. Teste se você está autenticado:

```javascript
// No console do navegador
fetch('/api/noticias?limit=1')
  .then(res => res.json())
  .then(data => console.log('✅ Autenticado:', data))
  .catch(err => console.error('❌ Não autenticado:', err))
```

### 4. **Testar com Timeout**

A API do Media Cloud pode demorar. Teste com timeout:

```javascript
// Teste com timeout
Promise.race([
  fetch('/api/noticias/collect/media-cloud', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: 'f7dc85ed00f79b8bc71b812d5840891bb88d80cf',
      query: 'Jadyel Alencar',
      days: 7,
      limit: 10,
    })
  }),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout após 30s')), 30000)
  )
])
  .then(res => res.json())
  .then(data => {
    console.log('✅ Resultado:', data)
  })
  .catch(err => {
    console.error('❌ Erro ou Timeout:', err)
  })
```

### 5. **Verificar Erros no Console**

Procure por erros vermelhos no console do navegador:
- Erros de CORS
- Erros de autenticação
- Erros de rede
- Erros 401, 403, 500

## 🐛 Possíveis Problemas

### ❌ **Não autenticado**
- **Sintoma**: Status 401
- **Solução**: Faça login no sistema

### ❌ **API Key inválida**
- **Sintoma**: Status 400, mensagem sobre API key
- **Solução**: Verifique a API key do Media Cloud

### ❌ **API do Media Cloud lenta**
- **Sintoma**: Requisição demora muito
- **Solução**: Aguarde (pode levar 10-30 segundos)

### ❌ **Erro na API do Media Cloud**
- **Sintoma**: Erro 500 ou erro do Media Cloud
- **Solução**: Verifique logs do servidor para detalhes

### ❌ **CORS ou Network Error**
- **Sintoma**: Erro de rede no console
- **Solução**: Verifique se o servidor está rodando

## ✅ Próximos Passos

1. **Verifique a aba Network** primeiro
2. **Verifique os logs do servidor** Next.js
3. **Execute o teste de autenticação**
4. **Tente com timeout** para ver se está demorando
5. **Compartilhe o erro** se encontrar algo nos logs

## 📝 Checklist de Debug

- [ ] Aba Network aberta (F12 → Network)
- [ ] Requisição executada e visível na Network
- [ ] Status code verificado
- [ ] Response verificada
- [ ] Logs do servidor verificados
- [ ] Teste de autenticação executado
- [ ] Erros no console verificados
