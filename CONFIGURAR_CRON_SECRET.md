# 🔐 Configurar CRON_SECRET - Guia Rápido

## O que é CRON_SECRET?

O `CRON_SECRET` é um **token de segurança** que você cria para proteger a API de coleta agendada (`/api/noticias/collect/schedule`). 

Ele garante que apenas chamadas autorizadas (como cron jobs) possam executar a coleta automática de notícias.

---

## Como Criar o Secret

### Opção 1: Gerar um Token Aleatório (Recomendado)

Você pode gerar um token seguro de várias formas:

#### No Terminal (Linux/Mac):
```bash
openssl rand -hex 32
```

#### No PowerShell (Windows):
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

#### Online:
- Acesse: https://randomkeygen.com/
- Use um "CodeIgniter Encryption Keys" (64 caracteres)

#### Exemplo de token gerado:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

## Como Configurar

### 1. Criar arquivo `.env.local` (se não existir)

Na raiz do projeto, crie ou edite o arquivo `.env.local`:

```env
# Google Alerts - URLs dos feeds RSS (separadas por vírgula)
GOOGLE_ALERTS_RSS_URLS=https://www.google.com/alerts/feeds/123/abc,https://www.google.com/alerts/feeds/456/def

# Secret para proteger API de coleta agendada
CRON_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**⚠️ IMPORTANTE:**
- **NUNCA** commite o arquivo `.env.local` no Git
- O arquivo `.gitignore` já deve ter `.env*.local` (verifique se está lá)
- Use um token diferente para produção

### 2. Verificar se está no .gitignore

Verifique se o arquivo `.gitignore` contém:

```
.env*.local
```

Se não tiver, adicione essa linha.

---

## Como Usar

### Ao chamar a API de coleta agendada:

```bash
POST /api/noticias/collect/schedule
Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### Exemplo com cURL:

```bash
curl -X POST https://seu-dominio.com/api/noticias/collect/schedule \
  -H "Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

### Exemplo com Vercel Cron:

No arquivo `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/noticias/collect/schedule",
    "schedule": "0 */6 * * *"
  }]
}
```

E configure a variável de ambiente no painel da Vercel:
- Nome: `CRON_SECRET`
- Valor: `seu-token-aqui`

---

## Segurança

✅ **FAÇA:**
- Use um token longo e aleatório (mínimo 32 caracteres)
- Use tokens diferentes para desenvolvimento e produção
- Mantenha o token em segredo
- Use variáveis de ambiente (não hardcode no código)

❌ **NÃO FAÇA:**
- Não compartilhe o token publicamente
- Não commite o `.env.local` no Git
- Não use tokens simples como "123" ou "secret"
- Não reutilize tokens de outros projetos

---

## Testando

Para testar se está funcionando:

1. Configure o `CRON_SECRET` no `.env.local`
2. Reinicie o servidor de desenvolvimento (`npm run dev`)
3. Faça uma requisição sem o token (deve retornar 401):
   ```bash
   curl -X POST http://localhost:3000/api/noticias/collect/schedule
   ```
4. Faça uma requisição com o token correto (deve funcionar):
   ```bash
   curl -X POST http://localhost:3000/api/noticias/collect/schedule \
     -H "Authorization: Bearer seu-token-aqui"
   ```

---

## Resumo

1. **Gere um token aleatório** (32+ caracteres)
2. **Adicione no `.env.local`** como `CRON_SECRET=seu-token`
3. **Use o token** no header `Authorization: Bearer seu-token` ao chamar a API
4. **Nunca commite** o `.env.local` no Git

Pronto! 🎉




