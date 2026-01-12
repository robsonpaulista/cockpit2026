# 🔧 Solução: Erro "fetch failed" Media Cloud API

## ❌ Erro Identificado

```
Erro ao buscar histórias do Media Cloud: fetch failed
```

Este erro indica que a requisição para a API do Media Cloud falhou. Pode ser causado por:

1. **Problemas de conexão** (rede, DNS)
2. **API do Media Cloud temporariamente indisponível**
3. **Firewall/proxy bloqueando**
4. **Timeout** (requisição demorou muito)
5. **API key inválida ou expirada**

## 🔍 Diagnóstico

### 1. **Verificar Logs do Servidor**

No terminal onde o Next.js está rodando, procure por:

```
❌ [Media Cloud] Erro ao buscar histórias:
```

Isso mostrará detalhes do erro.

### 2. **Testar API do Media Cloud Diretamente**

Teste se a API do Media Cloud está funcionando:

```javascript
// No console do navegador
fetch('https://api.mediacloud.org/api/v2/stories_public/search?key=f7dc85ed00f79b8bc71b812d5840891bb88d80cf&q=Brasil&rows=5')
  .then(res => res.json())
  .then(data => console.log('✅ Media Cloud funciona:', data))
  .catch(err => console.error('❌ Media Cloud falhou:', err))
```

**Nota**: Este teste pode falhar por CORS, mas se funcionar no servidor, o problema é outra coisa.

### 3. **Verificar API Key**

A API key pode estar inválida. Verifique:
- Se a API key está correta
- Se a conta do Media Cloud está ativa
- Se não excedeu os limites de uso

### 4. **Verificar Conexão**

Teste se há problemas de conexão:
- Internet funcionando?
- Firewall bloqueando?
- Proxy configurado?

## 🔧 Correções Implementadas

Adicionei:
1. **Timeout de 30 segundos** para evitar requisições que ficam travadas
2. **Melhor tratamento de erros** com mensagens mais específicas
3. **Logs mais detalhados** para debug

## ✅ Próximos Passos

1. **Verifique os logs do servidor** para mais detalhes
2. **Teste a API do Media Cloud diretamente** (se possível)
3. **Verifique sua conexão** de internet
4. **Tente novamente** após alguns minutos (pode ser temporário)
5. **Verifique se a API key está válida** no site do Media Cloud

## 🐛 Se o Erro Persistir

### Possível Causa: API Key Inválida

Se a API key estiver inválida ou expirada:
1. Acesse: https://www.mediacloud.org/settings/keys
2. Gere uma nova API key
3. Use a nova API key no teste

### Possível Causa: API do Media Cloud Indisponível

Se a API estiver temporariamente indisponível:
1. Aguarde alguns minutos
2. Tente novamente
3. Verifique status em: https://www.mediacloud.org/

### Possível Causa: Problemas de Rede/Firewall

Se houver problemas de rede:
1. Verifique sua conexão
2. Teste de outro dispositivo/rede
3. Verifique firewall/proxy

## 📝 Notas

- O erro "fetch failed" é genérico e pode ter várias causas
- O timeout de 30s ajuda a evitar requisições travadas
- Os logs do servidor devem mostrar mais detalhes
- Media Cloud pode ter limites de taxa de requisições
