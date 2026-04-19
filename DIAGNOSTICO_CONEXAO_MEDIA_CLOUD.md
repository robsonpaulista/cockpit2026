# 🔍 Diagnóstico: Erro de Conexão Media Cloud

## ❌ Erro Atual

```
Erro de conexão com Media Cloud. Verifique sua conexão ou se a API está disponível.
```

Este erro indica que o servidor **não consegue se conectar** à API do Media Cloud.

## 🔍 Como Diagnosticar

### 1. **Verificar Logs do Servidor**

No terminal onde o Next.js está rodando (`npm run dev`), procure por:

```
❌ [Media Cloud] Erro ao buscar histórias:
📡 [Media Cloud] URL da requisição:
```

Isso mostrará:
- A URL completa (com API key mascarada)
- O erro exato que está ocorrendo

### 2. **Verificar se o Media Cloud está Acessível**

O problema pode ser:
- **API do Media Cloud temporariamente indisponível**
- **Bloqueio de firewall/proxy**
- **Problemas de rede DNS**
- **API key inválida** (mas geralmente daria outro erro)

### 3. **Possíveis Causas**

#### ❌ **API do Media Cloud Indisponível**
- Serviço pode estar em manutenção
- Pode estar temporariamente fora do ar
- Limites de taxa excedidos

#### ❌ **Bloqueio de Firewall/Proxy**
- Se você está em uma rede corporativa
- Firewall bloqueando requisições externas
- Proxy configurado incorretamente

#### ❌ **Problemas de DNS**
- DNS não resolvendo `api.mediacloud.org`
- Problemas de rede

#### ❌ **API Key Inválida**
- API key pode estar incorreta
- Conta pode estar inativa
- API key pode ter expirado

## ✅ Próximos Passos

### 1. **Verificar Logs do Servidor**

**IMPORTANTE**: Veja o terminal onde o Next.js está rodando e procure por:
```
❌ [Media Cloud] Erro ao buscar histórias:
```

Isso mostrará o erro completo.

### 2. **Testar API Key Manualmente**

Acesse no navegador (pode falhar por CORS, mas vemos se a API responde):
```
https://api.mediacloud.org/api/v2/stories_public/search?key=f7dc85ed00f79b8bc71b812d5840891bb88d80cf&q=Brasil&rows=5
```

### 3. **Verificar API Key no Site**

1. Acesse: https://www.mediacloud.org/settings/keys
2. Faça login
3. Verifique se a API key está ativa
4. Se necessário, gere uma nova

### 4. **Verificar Conexão de Rede**

Teste se consegue acessar outros sites externos do servidor:
- Verifique se outras APIs funcionam (GDELT, por exemplo)
- Teste ping ou curl para `api.mediacloud.org`

### 5. **Tentar Novamente Após Alguns Minutos**

Pode ser um problema temporário. Aguarde alguns minutos e tente novamente.

## 🐛 Se o Erro Persistir

Se o erro continuar, pode ser necessário:

1. **Verificar se está em rede corporativa** que bloqueia APIs externas
2. **Testar de outro ambiente** (se possível)
3. **Entrar em contato com Media Cloud** para verificar se há problemas conhecidos
4. **Considerar usar apenas GDELT e Google Alerts** temporariamente

## 📝 Nota Importante

Media Cloud é uma ferramenta **complementar** e **não é essencial** para o funcionamento básico do sistema:
- ✅ **Google Alerts** funciona normalmente
- ✅ **GDELT** funciona normalmente
- ⚠️ **Media Cloud** é opcional e pode ser usado depois

Você pode continuar usando o sistema normalmente com Google Alerts e GDELT enquanto o problema do Media Cloud é resolvido.
