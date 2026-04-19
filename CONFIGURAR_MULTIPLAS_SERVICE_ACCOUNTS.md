# 🔧 Como Configurar Múltiplas Service Accounts no Vercel

## 📋 Problema

Você tem **múltiplas Service Accounts do Google**, cada uma com:
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` diferente
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` diferente

E precisa usar cada uma para diferentes planilhas/funcionalidades.

---

## 🎯 Solução: Variáveis com Sufixos

No Vercel, você pode criar variáveis com sufixos para cada Service Account:

### **Opção 1: Por Funcionalidade (Recomendado)**

#### **Service Account 1 - Território:**
```
GOOGLE_SERVICE_ACCOUNT_TERRITORIO_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GOOGLE_SERVICE_ACCOUNT_TERRITORIO_EMAIL=territorio@projeto.iam.gserviceaccount.com
GOOGLE_SHEETS_SPREADSHEET_ID=1a2b3c4d5e6f7g8h9i0j
GOOGLE_SHEETS_NAME=Sheet1
```

#### **Service Account 2 - Demandas:**
```
GOOGLE_SERVICE_ACCOUNT_DEMANDAS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GOOGLE_SERVICE_ACCOUNT_DEMANDAS_EMAIL=demandas@projeto.iam.gserviceaccount.com
GOOGLE_SHEETS_DEMANDAS_SPREADSHEET_ID=9z8y7x6w5v4u3t2s1r0q
GOOGLE_SHEETS_DEMANDAS_NAME=Demandas
```

#### **Service Account 3 - Outra funcionalidade:**
```
GOOGLE_SERVICE_ACCOUNT_OUTRA_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GOOGLE_SERVICE_ACCOUNT_OUTRA_EMAIL=outra@projeto.iam.gserviceaccount.com
GOOGLE_SHEETS_OUTRA_SPREADSHEET_ID=abc123def456
GOOGLE_SHEETS_OUTRA_NAME=Sheet1
```

---

## 🔧 Atualizar o Código

Preciso atualizar o código para suportar essas variáveis com sufixos. Vou fazer isso agora:

### **Estrutura Proposta:**

```typescript
// Para Território
GOOGLE_SERVICE_ACCOUNT_TERRITORIO_PRIVATE_KEY
GOOGLE_SERVICE_ACCOUNT_TERRITORIO_EMAIL

// Para Demandas
GOOGLE_SERVICE_ACCOUNT_DEMANDAS_PRIVATE_KEY
GOOGLE_SERVICE_ACCOUNT_DEMANDAS_EMAIL

// Fallback genérico (compatibilidade)
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_SERVICE_ACCOUNT_EMAIL
```

---

## 📝 Como Configurar no Vercel

### **Passo a Passo:**

1. **Acesse**: https://vercel.com/dashboard
2. **Seu projeto** → **Settings** → **Environment Variables**
3. **Adicione cada variável separadamente:**

#### **Território:**
```
Nome: GOOGLE_SERVICE_ACCOUNT_TERRITORIO_PRIVATE_KEY
Valor: -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
Ambientes: Production, Preview, Development

Nome: GOOGLE_SERVICE_ACCOUNT_TERRITORIO_EMAIL
Valor: territorio@projeto.iam.gserviceaccount.com
Ambientes: Production, Preview, Development

Nome: GOOGLE_SHEETS_SPREADSHEET_ID
Valor: 1a2b3c4d5e6f7g8h9i0j
Ambientes: Production, Preview, Development
```

#### **Demandas:**
```
Nome: GOOGLE_SERVICE_ACCOUNT_DEMANDAS_PRIVATE_KEY
Valor: -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
Ambientes: Production, Preview, Development

Nome: GOOGLE_SERVICE_ACCOUNT_DEMANDAS_EMAIL
Valor: demandas@projeto.iam.gserviceaccount.com
Ambientes: Production, Preview, Development

Nome: GOOGLE_SHEETS_DEMANDAS_SPREADSHEET_ID
Valor: 9z8y7x6w5v4u3t2s1r0q
Ambientes: Production, Preview, Development
```

---

## 💡 Alternativa: Passar Credenciais via Body

Se preferir **não configurar no Vercel**, pode passar as credenciais diretamente na requisição:

```javascript
fetch('/api/territorio/google-sheets', {
  method: 'POST',
  body: JSON.stringify({
    spreadsheetId: 'id-da-planilha',
    sheetName: 'Sheet1',
    credentials: JSON.stringify({
      type: 'service_account',
      private_key: '-----BEGIN PRIVATE KEY-----\n...\n',
      client_email: 'service-account@projeto.iam.gserviceaccount.com',
      token_uri: 'https://oauth2.googleapis.com/token'
    })
  })
})
```

**Vantagem**: Máxima flexibilidade, não precisa configurar no Vercel.

---

**Quer que eu atualize o código para suportar variáveis com sufixos?** Assim você pode ter:
- `GOOGLE_SERVICE_ACCOUNT_TERRITORIO_*` para Território
- `GOOGLE_SERVICE_ACCOUNT_DEMANDAS_*` para Demandas
- E assim por diante...
