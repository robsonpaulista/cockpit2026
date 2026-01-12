# 🔒 Auditoria de Segurança e Preparação para Produção

## ⚠️ PROBLEMAS CRÍTICOS ENCONTRADOS

### 🔴 **CRÍTICO 1: Token do Instagram Hardcoded**

**Localização**: `lib/instagramApi.ts` (linhas 138-139)

**Problema**:
```typescript
const DEFAULT_INSTAGRAM_CONFIG = {
  token: process.env.NEXT_PUBLIC_INSTAGRAM_TOKEN || 'EAAH0ZCYS7AIoBPHat72ae03bCYeaOwPqRNPX1Cpgjbm3R6a47q2tNPK1tygbmb2YiPVvGIqzaronYi5ZClJUSoDlYP8zmmFbB0ZAna8L6ZChbgSEaoBjZA5EOXbT0eb0L4y5fFMZBKsoIOPgWLh83h2VGLdfqMjrdhlbZBYqKxGHHfdizveZAiJCY9Vf4WRr',
  businessAccountId: process.env.NEXT_PUBLIC_INSTAGRAM_BUSINESS_ID || '104597578951001'
}
```

**Risco**: Token exposto no código, acessível no bundle do cliente.

**Solução**: 
- ❌ **REMOVER** valores hardcoded
- ✅ Usar apenas variáveis de ambiente
- ✅ Nunca usar `NEXT_PUBLIC_` para tokens sensíveis (expõe no cliente)
- ✅ Armazenar tokens no servidor apenas

---

### 🔴 **CRÍTICO 2: API Key do Media Cloud em Arquivos de Teste**

**Localização**: 
- `teste-media-cloud-rapido.js`
- `teste-media-cloud-node.js`
- `COMO_OBTER_MEDIA_CLOUD_API_KEY.md` (exemplos)
- `DIAGNOSTICO_CONEXAO_MEDIA_CLOUD.md` (exemplos)

**Problema**: API key exposta em arquivos que podem ser commitados.

**Solução**:
- ❌ **REMOVER** API keys de arquivos de teste
- ✅ Usar variáveis de ambiente
- ✅ Adicionar arquivos de teste ao `.gitignore` se necessário

---

### 🟡 **MÉDIO 1: Muitos console.log em Produção**

**Problema**: 176 ocorrências de `console.log/error/warn` em APIs.

**Risco**: 
- Exposição de informações sensíveis em logs
- Performance degradada
- Logs desnecessários em produção

**Solução**:
- ✅ Criar sistema de logging condicional (dev vs prod)
- ✅ Remover logs de debug
- ✅ Manter apenas logs de erro críticos

---

### 🟡 **MÉDIO 2: Falta de Rate Limiting**

**Problema**: APIs públicas sem proteção contra abuso.

**Risco**: 
- DDoS
- Abuso de recursos
- Custos elevados

**Solução**:
- ✅ Implementar rate limiting (ex: `@upstash/ratelimit`)
- ✅ Limitar requisições por IP/usuário
- ✅ Proteger endpoints de coleta

---

### 🟡 **MÉDIO 3: Validação de Entrada Incompleta**

**Problema**: Algumas APIs não validam completamente entrada.

**Risco**: 
- SQL Injection (mitigado pelo Supabase, mas verificar)
- XSS
- Dados inválidos

**Solução**:
- ✅ Usar Zod para validação (já usado em alguns lugares)
- ✅ Validar todos os inputs
- ✅ Sanitizar dados

---

## ✅ PONTOS POSITIVOS

### ✅ **Autenticação**
- Todas as APIs verificam autenticação (`supabase.auth.getUser()`)
- Middleware protege rotas

### ✅ **Variáveis de Ambiente**
- Uso correto de `process.env` para secrets
- `.gitignore` protege `.env*.local`

### ✅ **Validação com Zod**
- Muitas APIs usam Zod para validação
- Schemas bem definidos

### ✅ **Proteção de Cron Jobs**
- `CRON_SECRET` implementado
- Verificação de autorização

---

## 🔧 CORREÇÕES NECESSÁRIAS

### 1. **Remover Token Hardcoded do Instagram**

**Ação Imediata**:
```typescript
// ❌ REMOVER ISSO:
const DEFAULT_INSTAGRAM_CONFIG = {
  token: process.env.NEXT_PUBLIC_INSTAGRAM_TOKEN || 'EAAH...',
  businessAccountId: process.env.NEXT_PUBLIC_INSTAGRAM_BUSINESS_ID || '104597578951001'
}

// ✅ SUBSTITUIR POR:
const DEFAULT_INSTAGRAM_CONFIG = {
  token: process.env.INSTAGRAM_TOKEN || '', // Sem fallback hardcoded
  businessAccountId: process.env.INSTAGRAM_BUSINESS_ID || ''
}
```

**Nota**: `NEXT_PUBLIC_` expõe no cliente. Para tokens, use variáveis sem prefixo.

---

### 2. **Remover API Keys de Arquivos de Teste**

**Ação Imediata**:
- Remover API keys de `teste-media-cloud-rapido.js`
- Remover API keys de `teste-media-cloud-node.js`
- Usar variáveis de ambiente nos testes

---

### 3. **Sistema de Logging Condicional**

**Implementar**:
```typescript
// lib/logger.ts
const isDev = process.env.NODE_ENV === 'development'

export const logger = {
  log: (...args: any[]) => isDev && console.log(...args),
  error: (...args: any[]) => console.error(...args), // Sempre logar erros
  warn: (...args: any[]) => isDev && console.warn(...args),
}
```

---

### 4. **Rate Limiting**

**Implementar** (exemplo com Upstash):
```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
})

// Usar em APIs críticas
const { success } = await ratelimit.limit(identifier)
if (!success) {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
}
```

---

### 5. **Variáveis de Ambiente Documentadas**

**Criar `.env.example`**:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Instagram (NUNCA usar NEXT_PUBLIC_ para tokens!)
INSTAGRAM_TOKEN=
INSTAGRAM_BUSINESS_ID=

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SHEETS_SPREADSHEET_ID=

# Cron Jobs
CRON_SECRET=

# Media Cloud (opcional)
MEDIA_CLOUD_API_KEY=

# GDELT (opcional)
GDELT_QUERIES=
```

---

## 📋 CHECKLIST DE PRODUÇÃO

### Segurança
- [ ] ❌ **URGENTE**: Remover token Instagram hardcoded
- [ ] ❌ **URGENTE**: Remover API keys de arquivos de teste
- [ ] ✅ Verificar todas as APIs têm autenticação
- [ ] ✅ Verificar `.gitignore` protege `.env*.local`
- [ ] ⚠️ Implementar rate limiting
- [ ] ⚠️ Revisar logs (remover informações sensíveis)
- [ ] ⚠️ Validar todos os inputs
- [ ] ⚠️ Sanitizar dados de saída

### Configuração
- [ ] ✅ Criar `.env.example` com todas as variáveis
- [ ] ✅ Documentar variáveis de ambiente necessárias
- [ ] ⚠️ Configurar variáveis no ambiente de produção (Vercel, etc.)
- [ ] ⚠️ Usar secrets diferentes para dev/prod

### Performance
- [ ] ⚠️ Implementar cache onde apropriado
- [ ] ⚠️ Otimizar queries do banco
- [ ] ⚠️ Implementar paginação em listas grandes
- [ ] ⚠️ Compressão de respostas

### Monitoramento
- [ ] ⚠️ Configurar logging estruturado
- [ ] ⚠️ Configurar alertas de erro
- [ ] ⚠️ Monitorar performance
- [ ] ⚠️ Configurar health checks

### Backup e Recuperação
- [ ] ⚠️ Configurar backup automático do Supabase
- [ ] ⚠️ Documentar processo de restore
- [ ] ⚠️ Testar restore

---

## 🚨 AÇÕES IMEDIATAS (ANTES DE PRODUÇÃO)

### 1. **Remover Token Hardcoded** (CRÍTICO)
```bash
# Editar lib/instagramApi.ts
# Remover valores hardcoded
```

### 2. **Limpar Arquivos de Teste**
```bash
# Remover API keys de:
# - teste-media-cloud-rapido.js
# - teste-media-cloud-node.js
# Ou adicionar ao .gitignore
```

### 3. **Criar .env.example**
```bash
# Criar arquivo com todas as variáveis (sem valores)
```

### 4. **Revisar .gitignore**
```bash
# Garantir que .env*.local está ignorado
# Adicionar arquivos de teste se necessário
```

---

## 📝 Variáveis de Ambiente Necessárias

### Obrigatórias
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Opcionais (mas recomendadas)
- `INSTAGRAM_TOKEN` (sem `NEXT_PUBLIC_`)
- `INSTAGRAM_BUSINESS_ID` (sem `NEXT_PUBLIC_`)
- `CRON_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `MEDIA_CLOUD_API_KEY`

---

## 🔐 Boas Práticas de Segurança

### ✅ **FAZER**
- Usar variáveis de ambiente para secrets
- Validar todos os inputs
- Autenticar todas as APIs
- Logar erros (sem dados sensíveis)
- Usar HTTPS em produção
- Implementar rate limiting
- Manter dependências atualizadas

### ❌ **NÃO FAZER**
- Hardcodar tokens/secrets
- Expor tokens com `NEXT_PUBLIC_`
- Commitar `.env.local`
- Logar dados sensíveis
- Confiar em validação do cliente
- Expor stack traces em produção

---

## 📊 Status Atual

| Categoria | Status | Prioridade |
|-----------|--------|------------|
| **Autenticação** | ✅ OK | - |
| **Tokens Hardcoded** | ❌ CRÍTICO | 🔴 URGENTE |
| **Rate Limiting** | ⚠️ FALTANDO | 🟡 MÉDIO |
| **Logging** | ⚠️ MELHORAR | 🟡 MÉDIO |
| **Validação** | ✅ OK | - |
| **Variáveis de Ambiente** | ⚠️ DOCUMENTAR | 🟡 MÉDIO |

---

## 🎯 Próximos Passos

1. **URGENTE**: Remover token hardcoded do Instagram
2. **URGENTE**: Limpar API keys de arquivos de teste
3. **IMPORTANTE**: Criar `.env.example`
4. **IMPORTANTE**: Implementar rate limiting
5. **IMPORTANTE**: Melhorar sistema de logging
6. **RECOMENDADO**: Configurar monitoramento
7. **RECOMENDADO**: Documentar processo de deploy

---

## 📚 Referências

- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
