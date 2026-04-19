# 🔧 Como Configurar Múltiplas Planilhas no Vercel

## 📋 Entendendo o Sistema

O sistema já suporta múltiplas planilhas usando **variáveis de ambiente separadas por contexto**:

### **Credenciais (Compartilhadas)**
As mesmas credenciais do Service Account podem ser usadas para todas as planilhas:
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`

### **Planilhas Específicas**
Cada funcionalidade tem sua própria variável:
- **Território**: `GOOGLE_SHEETS_SPREADSHEET_ID`
- **Demandas**: `GOOGLE_SHEETS_DEMANDAS_SPREADSHEET_ID`

---

## 🎯 Configuração no Vercel

### **Opção 1: Usar Variáveis de Ambiente (Recomendado)**

No Vercel, você pode configurar **uma variável de ambiente por nome**. Como o sistema já separa por contexto, configure assim:

#### **Credenciais (Uma para todas as planilhas):**
```
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@projeto.iam.gserviceaccount.com
```

#### **Planilhas Específicas:**
```
# Planilha do Território
GOOGLE_SHEETS_SPREADSHEET_ID=1a2b3c4d5e6f7g8h9i0j
GOOGLE_SHEETS_NAME=Sheet1
GOOGLE_SHEETS_RANGE=A1:Z1000

# Planilha de Demandas
GOOGLE_SHEETS_DEMANDAS_SPREADSHEET_ID=9z8y7x6w5v4u3t2s1r0q
GOOGLE_SHEETS_DEMANDAS_NAME=Demandas
GOOGLE_SHEETS_DEMANDAS_RANGE=A1:Z1000
```

**No Vercel:**
1. Vá em **Settings** → **Environment Variables**
2. Adicione cada variável **separadamente**
3. Selecione os ambientes (Production, Preview, Development)

---

### **Opção 2: Passar via Body da Requisição (Flexível)**

Se você tem **muitas planilhas diferentes**, pode passar a configuração diretamente na requisição:

```javascript
// No frontend ou API
fetch('/api/territorio/google-sheets', {
  method: 'POST',
  body: JSON.stringify({
    spreadsheetId: 'sua-planilha-id',
    sheetName: 'Sheet1',
    range: 'A1:Z1000',
    credentials: '...' // JSON string das credenciais
  })
})
```

**Vantagem**: Não precisa configurar no Vercel, pode mudar dinamicamente.

---

## 🔍 Como o Sistema Funciona

### **Prioridade de Configuração:**

1. **Body da requisição** (mais alta prioridade)
2. **Variáveis de ambiente específicas** (ex: `GOOGLE_SHEETS_DEMANDAS_SPREADSHEET_ID`)
3. **Variáveis de ambiente genéricas** (ex: `GOOGLE_SHEETS_SPREADSHEET_ID`)

### **Exemplo: Território**

```typescript
// 1. Tenta usar do body
spreadsheetId = body.spreadsheetId

// 2. Se não tiver, usa variável de ambiente
spreadsheetId = body.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID
```

### **Exemplo: Demandas**

```typescript
// Usa variável específica para demandas
spreadsheetId = process.env.GOOGLE_SHEETS_DEMANDAS_SPREADSHEET_ID
```

---

## 📝 Configuração Completa no Vercel

### **Variáveis Obrigatórias (Supabase):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### **Variáveis Google Sheets (Se usar):**

**Credenciais (uma para todas):**
```
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_SERVICE_ACCOUNT_EMAIL
```

**Planilhas (uma por funcionalidade):**
```
# Território
GOOGLE_SHEETS_SPREADSHEET_ID
GOOGLE_SHEETS_NAME
GOOGLE_SHEETS_RANGE

# Demandas
GOOGLE_SHEETS_DEMANDAS_SPREADSHEET_ID
GOOGLE_SHEETS_DEMANDAS_NAME
GOOGLE_SHEETS_DEMANDAS_RANGE
```

---

## 💡 Dicas

### **Se você tem MUITAS planilhas:**

**Opção A**: Use variáveis com sufixos
```
GOOGLE_SHEETS_TERRITORIO_SPREADSHEET_ID
GOOGLE_SHEETS_DEMANDAS_SPREADSHEET_ID
GOOGLE_SHEETS_OUTRA_SPREADSHEET_ID
```

**Opção B**: Passe sempre via body da requisição
- Mais flexível
- Não precisa configurar no Vercel
- Pode mudar dinamicamente

### **Se você tem UMA planilha para cada funcionalidade:**

Use as variáveis específicas já existentes:
- `GOOGLE_SHEETS_SPREADSHEET_ID` → Território
- `GOOGLE_SHEETS_DEMANDAS_SPREADSHEET_ID` → Demandas

---

## ✅ Resumo

**No Vercel, configure:**
1. ✅ **Uma variável por nome** (não pode ter duplicatas)
2. ✅ **Use sufixos** para diferenciar (`_TERRITORIO`, `_DEMANDAS`, etc.)
3. ✅ **Ou passe via body** da requisição para máxima flexibilidade

**O sistema já suporta múltiplas planilhas!** Basta configurar as variáveis corretas no Vercel. 🎉
